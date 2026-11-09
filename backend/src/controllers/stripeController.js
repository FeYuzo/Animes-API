import { stripe } from '../config/stripe.js';
import { pool } from '../config/db.js';
import { logAuditEvent } from '../services/auditService.js';

/**
 * Cria uma Checkout Session do Stripe para o Plano Premium
 * Rota: POST /api/stripe/create-checkout-session (autenticado)
 */
export async function createCheckoutSession(req, res) {
  try {
    const userId = req.user.id;
    const userEmail = req.user.email;
    const userName = req.user.nome;
    const clientOrigin = req.headers.origin || (req.headers.referer ? new URL(req.headers.referer).origin : null);
    const forwardedProto = req.headers['x-forwarded-proto'] || req.protocol;
    const forwardedHost = req.headers['x-forwarded-host'] || req.get('host');
    const detectedUrl = `${forwardedProto}://${forwardedHost}`.replace(/\/$/, '');
    const appUrl = (process.env.APP_URL && !process.env.APP_URL.includes('localhost'))
      ? process.env.APP_URL.replace(/\/$/, '')
      : (clientOrigin || detectedUrl || 'http://localhost:3000');

    const isPlaceholderKey = !process.env.STRIPE_SECRET_KEY || process.env.STRIPE_SECRET_KEY.includes('placeholder');
    if (!stripe || isPlaceholderKey) {
      console.log(`[Stripe] Modo de simulação/teste detectado para o usuário ${userId}. Ativando Otaku Pro imediatamente...`);
      await pool.query('UPDATE usuarios SET is_premium = TRUE WHERE id = ?', [userId]);

      logAuditEvent({
        usuario_id: userId,
        acao: 'simulacao_checkout_sucesso',
        ip: req.headers['x-forwarded-for']?.split(',')[0].trim() || req.socket?.remoteAddress || req.ip,
        detalhes: { modo: 'teste_placeholder_auto_upgrade' }
      });

      return res.json({
        success: true,
        testMode: true,
        message: 'Modo de teste: Sua conta foi atualizada imediatamente para o Plano Otaku Pro!',
        url: `${appUrl}/?payment=success`
      });
    }

    const priceId = process.env.STRIPE_PRICE_ID;
    if (!priceId) {
      return res.status(500).json({
        error: 'Preço do plano não configurado. Adicione STRIPE_PRICE_ID no arquivo .env.'
      });
    }

    const sessionParams = {
      customer_email: userEmail,
      client_reference_id: String(userId),
      line_items: [
        {
          price: priceId,
          quantity: 1
        }
      ],
      mode: 'subscription',
      success_url: `${appUrl}/?payment=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}/?payment=cancel`,
      metadata: {
        userId: String(userId),
        userEmail: userEmail,
        userName: userName
      }
    };

    let session;
    try {
      // Tenta criar como assinatura (recorrente)
      session = await stripe.checkout.sessions.create(sessionParams);
    } catch (err) {
      // Se o plano criado no Stripe for de pagamento único (one-time payment), faz fallback gracioso
      if (err.message && err.message.includes('recurring')) {
        console.log('[Stripe] Preço configurado como pagamento único. Alternando modo para "payment"...');
        sessionParams.mode = 'payment';
        session = await stripe.checkout.sessions.create(sessionParams);
      } else {
        throw err;
      }
    }

    logAuditEvent({
      usuario_id: userId,
      acao: 'iniciar_checkout_stripe',
      ip: req.headers['x-forwarded-for']?.split(',')[0].trim() || req.socket?.remoteAddress || req.ip,
      detalhes: {
        sessionId: session.id,
        priceId
      }
    });

    return res.json({
      success: true,
      url: session.url,
      sessionId: session.id
    });
  } catch (err) {
    console.error('[Stripe] Erro ao criar Checkout Session:', err);
    return res.status(500).json({
      error: `Erro ao criar sessão de pagamento no Stripe: ${err.message}`
    });
  }
}

/**
 * Webhook do Stripe: recebe notificações oficiais do Stripe e atualiza o usuário para premium
 * Rota: POST /api/stripe/webhook
 * IMPORTANTE: Recebe o payload bruto (rawBody) para verificar a assinatura criptográfica.
 */
export async function handleWebhook(req, res) {
  const sig = req.headers['stripe-signature'];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!stripe) {
    console.error('[Stripe-Webhook] Stripe SDK não inicializado.');
    return res.status(500).send('Stripe não inicializado.');
  }

  if (!webhookSecret) {
    console.error('[Stripe-Webhook] STRIPE_WEBHOOK_SECRET não configurado no .env.');
    return res.status(500).send('STRIPE_WEBHOOK_SECRET não configurado.');
  }

  if (!sig) {
    console.error('[Stripe-Webhook] Header stripe-signature ausente.');
    return res.status(400).send('Assinatura do webhook ausente.');
  }

  let event;

  try {
    // Usa req.rawBody se disponível (injetado pelo middleware) ou req.body (se express.raw)
    const rawPayload = req.rawBody || req.body;
    event = stripe.webhooks.constructEvent(rawPayload, sig, webhookSecret);
  } catch (err) {
    console.error(`[Stripe-Webhook] Falha na validação da assinatura: ${err.message}`);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  console.log(`[Stripe-Webhook] Evento verificado com sucesso: ${event.type} [ID: ${event.id}]`);

  try {
    switch (event.type) {
      // 1. Pagamento/Assinatura confirmado via Checkout Session
      case 'checkout.session.completed': {
        const session = event.data.object;
        const userId = session.client_reference_id || session.metadata?.userId;
        const customerId = session.customer;
        const subscriptionId = session.subscription || null;

        console.log(`[Stripe-Webhook] Checkout concluído! Usuário: ${userId}, Customer: ${customerId}, Sub: ${subscriptionId}`);

        if (userId) {
          await pool.query(
            `UPDATE usuarios 
             SET is_premium = TRUE, stripe_customer_id = ?, stripe_subscription_id = ? 
             WHERE id = ?`,
            [customerId, subscriptionId, userId]
          );

          logAuditEvent({
            usuario_id: parseInt(userId, 10),
            acao: 'upgrade_premium_confirmado',
            detalhes: {
              evento: 'checkout.session.completed',
              stripe_customer_id: customerId,
              stripe_subscription_id: subscriptionId,
              sessionId: session.id
            }
          });
        } else if (session.customer_email) {
          // Fallback por e-mail caso client_reference_id não esteja preenchido
          await pool.query(
            `UPDATE usuarios 
             SET is_premium = TRUE, stripe_customer_id = ?, stripe_subscription_id = ? 
             WHERE email = ?`,
            [customerId, subscriptionId, session.customer_email]
          );
        }
        break;
      }

      // 2. Fatura paga com sucesso (renovação mensal de assinatura)
      case 'invoice.payment_succeeded': {
        const invoice = event.data.object;
        const subscriptionId = invoice.subscription;
        const customerId = invoice.customer;

        if (subscriptionId) {
          await pool.query(
            `UPDATE usuarios 
             SET is_premium = TRUE 
             WHERE stripe_subscription_id = ? OR stripe_customer_id = ?`,
            [subscriptionId, customerId]
          );
        }
        break;
      }

      // 3. Assinatura cancelada ou expirada
      case 'customer.subscription.deleted': {
        const subscription = event.data.object;
        const subscriptionId = subscription.id;
        const customerId = subscription.customer;

        console.log(`[Stripe-Webhook] Assinatura cancelada: ${subscriptionId}`);

        await pool.query(
          `UPDATE usuarios 
           SET is_premium = FALSE 
           WHERE stripe_subscription_id = ? OR stripe_customer_id = ?`,
          [subscriptionId, customerId]
        );

        logAuditEvent({
          acao: 'cancelamento_premium',
          detalhes: {
            evento: 'customer.subscription.deleted',
            stripe_subscription_id: subscriptionId,
            stripe_customer_id: customerId
          }
        });
        break;
      }

      default:
        console.log(`[Stripe-Webhook] Evento não manipulado: ${event.type}`);
    }

    return res.json({ received: true });
  } catch (dbErr) {
    console.error('[Stripe-Webhook] Erro ao processar evento no banco de dados:', dbErr);
    return res.status(500).json({ error: 'Erro interno ao persistir dados do webhook.' });
  }
}

/**
 * Consulta status de assinatura premium do usuário atual
 * Rota: GET /api/stripe/status (autenticado)
 */
export async function getSubscriptionStatus(req, res) {
  try {
    const userId = req.user.id;

    const [rows] = await pool.query(
      'SELECT id, nome, email, is_premium, stripe_customer_id, stripe_subscription_id FROM usuarios WHERE id = ?',
      [userId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Usuário não encontrado.' });
    }

    const user = rows[0];
    let isPremium = Boolean(user.is_premium);
    let customerId = user.stripe_customer_id;
    let subscriptionId = user.stripe_subscription_id;

    const isPlaceholderKey = !process.env.STRIPE_SECRET_KEY || process.env.STRIPE_SECRET_KEY.includes('placeholder');

    // Auto-sincronização preventiva com o Stripe se o banco ainda acusar plano Free
    if (!isPremium && stripe && !isPlaceholderKey) {
      try {
        if (subscriptionId) {
          const sub = await stripe.subscriptions.retrieve(subscriptionId).catch(() => null);
          if (sub && (sub.status === 'active' || sub.status === 'trialing')) {
            isPremium = true;
          }
        } else if (customerId) {
          const subs = await stripe.subscriptions.list({ customer: customerId, status: 'active', limit: 1 }).catch(() => ({ data: [] }));
          if (subs.data && subs.data.length > 0) {
            isPremium = true;
            subscriptionId = subs.data[0].id;
          }
        }

        // Se ainda não achou, verifica sessões recentes pagas para este usuário
        if (!isPremium) {
          const recentSessions = await stripe.checkout.sessions.list({ limit: 15 }).catch(() => ({ data: [] }));
          const matchedSession = (recentSessions.data || []).find((s) =>
            (s.client_reference_id === String(userId) || s.metadata?.userId === String(userId) || (s.customer_email && s.customer_email.toLowerCase() === (user.email || '').toLowerCase())) &&
            (s.payment_status === 'paid' || s.status === 'complete')
          );

          if (matchedSession) {
            isPremium = true;
            customerId = typeof matchedSession.customer === 'string' ? matchedSession.customer : matchedSession.customer?.id || customerId;
            subscriptionId = typeof matchedSession.subscription === 'string' ? matchedSession.subscription : matchedSession.subscription?.id || subscriptionId;
          }
        }

        if (isPremium) {
          await pool.query(
            'UPDATE usuarios SET is_premium = TRUE, stripe_customer_id = ?, stripe_subscription_id = ? WHERE id = ?',
            [customerId || null, subscriptionId || null, userId]
          );
          console.log(`[Stripe] Usuário ${userId} sincronizado e promovido a Premium via getSubscriptionStatus.`);
        }
      } catch (syncErr) {
        console.warn('[Stripe] Aviso ao tentar auto-sincronizar assinatura:', syncErr.message);
      }
    }

    return res.json({
      success: true,
      user_id: user.id,
      is_premium: isPremium,
      stripe_customer_id: customerId || null,
      stripe_subscription_id: subscriptionId || null
    });
  } catch (err) {
    console.error('[Stripe] Erro ao consultar status da assinatura:', err);
    return res.status(500).json({ error: 'Erro ao consultar status da assinatura.' });
  }
}

/**
 * Verifica e sincroniza uma Checkout Session do Stripe imediatamente após o retorno do usuário
 * Rota: POST /api/stripe/verify-session
 */
export async function verifyCheckoutSession(req, res) {
  try {
    const { sessionId } = req.body;
    const authUserId = req.user?.id;

    const isPlaceholderKey = !process.env.STRIPE_SECRET_KEY || process.env.STRIPE_SECRET_KEY.includes('placeholder');
    if (!stripe || isPlaceholderKey) {
      if (authUserId) {
        await pool.query('UPDATE usuarios SET is_premium = TRUE WHERE id = ?', [authUserId]);
      }
      return res.json({
        success: true,
        paid: true,
        is_premium: true,
        testMode: true,
        message: 'Modo de teste: Assinatura ativada imediatamente!'
      });
    }

    let session = null;
    if (sessionId && sessionId !== 'sync' && sessionId !== 'latest') {
      try {
        session = await stripe.checkout.sessions.retrieve(sessionId);
      } catch (retrieveErr) {
        console.warn(`[Stripe] Não foi possível recuperar sessão por ID (${sessionId}): ${retrieveErr.message}`);
      }
    }

    const [userRows] = authUserId ? await pool.query('SELECT email FROM usuarios WHERE id = ?', [authUserId]) : [[]];
    const userEmail = userRows[0]?.email;

    // Se não encontrou por sessionId, busca na lista de sessões recentes
    if (!session && authUserId) {
      const recentSessions = await stripe.checkout.sessions.list({ limit: 15 }).catch(() => ({ data: [] }));
      session = (recentSessions.data || []).find((s) =>
        (s.client_reference_id === String(authUserId) || s.metadata?.userId === String(authUserId) || (userEmail && s.customer_email && s.customer_email.toLowerCase() === userEmail.toLowerCase())) &&
        (s.payment_status === 'paid' || s.status === 'complete')
      );
    }

    if (!session) {
      // Se não encontrou sessão paga nem correspondente
      if (sessionId && sessionId !== 'sync') {
        return res.status(404).json({ error: 'Sessão do Stripe não encontrada ou ainda pendente.' });
      }
      return res.json({
        success: true,
        paid: false,
        is_premium: false,
        message: 'Nenhum pagamento confirmado encontrado.'
      });
    }

    const targetUserId = session.client_reference_id || session.metadata?.userId || authUserId;
    const isPaid = session.payment_status === 'paid' || session.status === 'complete';

    if (isPaid && targetUserId) {
      const customerId = typeof session.customer === 'string' ? session.customer : session.customer?.id || null;
      const subscriptionId = typeof session.subscription === 'string' ? session.subscription : session.subscription?.id || null;

      await pool.query(
        `UPDATE usuarios 
         SET is_premium = TRUE, stripe_customer_id = ?, stripe_subscription_id = ? 
         WHERE id = ?`,
        [customerId, subscriptionId, targetUserId]
      );

      logAuditEvent({
        usuario_id: parseInt(targetUserId, 10),
        acao: 'upgrade_premium_confirmado',
        ip: req.headers['x-forwarded-for']?.split(',')[0].trim() || req.socket?.remoteAddress || req.ip,
        detalhes: {
          modo: 'verify_checkout_session',
          sessionId: session.id,
          customerId,
          subscriptionId
        }
      });

      return res.json({
        success: true,
        paid: true,
        is_premium: true,
        message: 'Assinatura Otaku Pro confirmada e ativada com sucesso!'
      });
    }

    return res.json({
      success: true,
      paid: isPaid,
      is_premium: false,
      status: session.payment_status
    });
  } catch (err) {
    console.error('[Stripe] Erro ao verificar checkout session:', err);
    return res.status(500).json({ error: `Erro ao verificar sessão do Stripe: ${err.message}` });
  }
}
