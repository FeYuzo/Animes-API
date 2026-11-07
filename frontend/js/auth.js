/**
 * Módulo de Autenticação & Tema — AniTrack
 * Gerencia temas Claro/Noturno, sessão do usuário, login, cadastro, papéis (roles) e recuperação de senha.
 */

import { api } from './api.js';

// Elementos da Interface
const authView = document.getElementById('auth-view');
const appView = document.getElementById('app-view');
const navViews = document.getElementById('nav-views');
const userNav = document.getElementById('user-nav');
const navUserName = document.getElementById('nav-user-name');
const navUserRole = document.getElementById('nav-user-role');
const navUserPremium = document.getElementById('nav-user-premium');
const btnNavPremium = document.getElementById('btn-nav-premium');
const navUserAvatar = document.getElementById('nav-user-avatar');
const navAvatarIcon = document.getElementById('nav-avatar-icon');
const btnLogout = document.getElementById('btn-logout');

// Tema
const btnThemeToggle = document.getElementById('btn-theme-toggle');

// Modal Otaku Pro (Stripe)
const premiumModal = document.getElementById('premium-modal');
const btnClosePremiumModal = document.getElementById('btn-close-premium-modal');
const btnCancelPremiumModal = document.getElementById('btn-cancel-premium-modal');
const btnConfirmCheckout = document.getElementById('btn-confirm-checkout');

// Tabs de Auth
const authNavTabs = document.getElementById('auth-nav-tabs');
const tabLogin = document.getElementById('tab-login');
const tabRegister = document.getElementById('tab-register');
const authAlert = document.getElementById('auth-alert');

// Formulários
const formLogin = document.getElementById('form-login');
const formRegister = document.getElementById('form-register');
const formForgot = document.getElementById('form-forgot');
const formReset = document.getElementById('form-reset');

// Inputs Login
const loginEmail = document.getElementById('login-email');
const loginSenha = document.getElementById('login-senha');
const btnSubmitLogin = document.getElementById('btn-submit-login');
const btnForgotPassword = document.getElementById('btn-forgot-password');

// Inputs Registro
const registerNome = document.getElementById('register-nome');
const registerEmail = document.getElementById('register-email');
const registerRole = document.getElementById('register-role');
const registerSenha = document.getElementById('register-senha');
const btnSubmitRegister = document.getElementById('btn-submit-register');

// Inputs Esqueci Senha
const forgotEmail = document.getElementById('forgot-email');
const btnSubmitForgot = document.getElementById('btn-submit-forgot');
const btnForgotBack = document.getElementById('btn-forgot-back');

// Inputs Reset
const resetNovaSenha = document.getElementById('reset-nova-senha');
const resetConfirmaSenha = document.getElementById('reset-confirma-senha');
const resetTokenInfo = document.getElementById('reset-token-info');
const btnSubmitReset = document.getElementById('btn-submit-reset');
const btnResetBack = document.getElementById('btn-reset-back');

let activeResetToken = null;

// ============================================================================
// 1. GERENCIAMENTO DE TEMA (CLARO / NOTURNO)
// ============================================================================
export function initTheme() {
  const savedTheme = localStorage.getItem('anitrack_theme') || 'dark';
  applyTheme(savedTheme);

  btnThemeToggle?.addEventListener('click', () => {
    const current = document.documentElement.getAttribute('data-theme') || 'dark';
    const nextTheme = current === 'dark' ? 'light' : 'dark';
    applyTheme(nextTheme);
  });
}

export function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('anitrack_theme', theme);

  const label = document.getElementById('theme-toggle-label');
  if (label) {
    label.textContent = theme === 'dark' ? 'Claro' : 'Noturno';
  }
}

// ============================================================================
// 2. ALERTAS DE AUTENTICAÇÃO
// ============================================================================
function showAlert(message, type = 'danger') {
  if (!authAlert) return;
  authAlert.textContent = message;
  authAlert.className = `alert alert-${type}`;
  authAlert.classList.remove('hidden');
}

function hideAlert() {
  if (!authAlert) return;
  authAlert.classList.add('hidden');
  authAlert.textContent = '';
}

export function switchTab(tab) {
  hideAlert();

  formLogin?.classList.add('hidden');
  formRegister?.classList.add('hidden');
  formForgot?.classList.add('hidden');
  formReset?.classList.add('hidden');

  if (tab === 'login') {
    authNavTabs?.classList.remove('hidden');
    tabLogin?.classList.add('active');
    tabRegister?.classList.remove('active');
    formLogin?.classList.remove('hidden');
  } else if (tab === 'register') {
    authNavTabs?.classList.remove('hidden');
    tabRegister?.classList.add('active');
    tabLogin?.classList.remove('active');
    formRegister?.classList.remove('hidden');
  } else if (tab === 'forgot') {
    authNavTabs?.classList.add('hidden');
    formForgot?.classList.remove('hidden');
  } else if (tab === 'reset') {
    authNavTabs?.classList.add('hidden');
    formReset?.classList.remove('hidden');
  }
}

// ============================================================================
// 3. ATUALIZAÇÃO DA INTERFACE & SESSÃO
// ============================================================================
export function showAuthView() {
  authView?.classList.remove('hidden');
  appView?.classList.add('hidden');
  navViews?.classList.add('hidden');
  userNav?.classList.add('hidden');
  switchTab('login');
}

export function showAppView(user) {
  authView?.classList.add('hidden');
  appView?.classList.remove('hidden');
  navViews?.classList.remove('hidden');
  userNav?.classList.remove('hidden');

  if (navUserName) navUserName.textContent = user.nome || 'Otaku';
  if (navUserRole) {
    navUserRole.textContent = user.role || 'usuario';
    navUserRole.className = `user-role-badge role-${user.role || 'usuario'}`;
  }

  // Badge Otaku Pro
  const isPremium = Boolean(user.is_premium);
  if (navUserPremium) {
    navUserPremium.classList.toggle('hidden', !isPremium);
  }
  if (btnNavPremium) {
    btnNavPremium.classList.toggle('hidden', isPremium);
  }

  updateNavUserAvatar(user.foto_url);
}

export function updateNavUserAvatar(fotoUrl) {
  if (!navUserAvatar || !navAvatarIcon) return;
  if (fotoUrl) {
    const cleanUrl = fotoUrl.split('?')[0];
    navUserAvatar.src = `${cleanUrl}?t=${Date.now()}`;
    navUserAvatar.classList.remove('hidden');
    navAvatarIcon.classList.add('hidden');
  } else {
    navUserAvatar.classList.add('hidden');
    navAvatarIcon.classList.remove('hidden');
  }
}

// ============================================================================
// 4. HANDLERS DE FORMULÁRIOS
// ============================================================================
async function handleLogin(e) {
  e.preventDefault();
  hideAlert();

  const email = loginEmail.value.trim();
  const senha = loginSenha.value;

  btnSubmitLogin.disabled = true;
  btnSubmitLogin.innerHTML = '<span class="spinner-sm"></span> Acessando...';

  try {
    const res = await api.login(email, senha);
    formLogin.reset();
    showAppView(res.user);
    window.dispatchEvent(new CustomEvent('auth:login', { detail: res.user }));
  } catch (err) {
    showAlert(err.message || 'Credenciais inválidas. Verifique seu e-mail e senha.');
  } finally {
    btnSubmitLogin.disabled = false;
    btnSubmitLogin.innerHTML = '<span>Acessar Plataforma</span>';
  }
}

async function handleRegister(e) {
  e.preventDefault();
  hideAlert();

  const nome = registerNome.value.trim();
  const email = registerEmail.value.trim();
  const role = registerRole.value || 'usuario';
  const senha = registerSenha.value;

  if (senha.length < 4) {
    showAlert('A senha deve ter no mínimo 4 caracteres.');
    return;
  }

  btnSubmitRegister.disabled = true;
  btnSubmitRegister.innerHTML = '<span class="spinner-sm"></span> Criando conta...';

  try {
    const res = await api.register(nome, email, senha, role);
    formRegister.reset();
    showAppView(res.user);
    window.dispatchEvent(new CustomEvent('auth:login', { detail: res.user }));
  } catch (err) {
    showAlert(err.message || 'Erro ao realizar cadastro.');
  } finally {
    btnSubmitRegister.disabled = false;
    btnSubmitRegister.innerHTML = '<span>Criar Conta Gratuita</span>';
  }
}

async function handleForgot(e) {
  e.preventDefault();
  hideAlert();

  const email = forgotEmail.value.trim();
  btnSubmitForgot.disabled = true;
  btnSubmitForgot.innerHTML = '<span class="spinner-sm"></span> Enviando link...';

  try {
    const res = await api.forgotPassword(email);
    formForgot.reset();
    showAlert(res.message || 'Se o e-mail estiver cadastrado, o link de recuperação foi enviado com validade de 30 minutos.', 'success');
  } catch (err) {
    showAlert(err.message || 'Erro ao processar solicitação de recuperação.');
  } finally {
    btnSubmitForgot.disabled = false;
    btnSubmitForgot.innerHTML = '<span>Enviar Link de Recuperação</span>';
  }
}

async function handleReset(e) {
  e.preventDefault();
  hideAlert();

  const novaSenha = resetNovaSenha.value;
  const confirmaSenha = resetConfirmaSenha.value;

  if (!novaSenha || novaSenha.length < 4) {
    showAlert('A nova senha deve ter no mínimo 4 caracteres.');
    return;
  }

  if (novaSenha !== confirmaSenha) {
    showAlert('As senhas não coincidem. Digite a mesma senha em ambos os campos.');
    return;
  }

  btnSubmitReset.disabled = true;
  btnSubmitReset.innerHTML = '<span class="spinner-sm"></span> Atualizando...';

  try {
    const res = await api.resetPassword(activeResetToken, novaSenha);
    formReset.reset();
    activeResetToken = null;
    switchTab('login');
    showAlert(res.message || 'Senha alterada com sucesso! Faça login com a nova senha.', 'success');
  } catch (err) {
    showAlert(err.message || 'Erro ao redefinir senha. O link pode ter expirado (limite de 30 minutos).');
  } finally {
    btnSubmitReset.disabled = false;
    btnSubmitReset.innerHTML = '<span>Salvar Nova Senha</span>';
  }
}

async function handleLogout() {
  await api.logout();
  showAuthView();
  window.dispatchEvent(new CustomEvent('auth:logout'));
}

// ============================================================================
// 5. MODAL OTAKU PRO & STRIPE CHECKOUT
// ============================================================================
export function openPremiumModal() {
  premiumModal?.classList.remove('hidden');
}

export function closePremiumModal() {
  premiumModal?.classList.add('hidden');
}

async function startStripeCheckout() {
  if (!btnConfirmCheckout) return;
  btnConfirmCheckout.disabled = true;
  btnConfirmCheckout.innerHTML = '<span class="spinner-sm"></span> Conectando ao Stripe...';

  try {
    const res = await api.createStripeCheckout();
    if (res.url) {
      window.location.href = res.url;
    } else {
      throw new Error('URL de checkout não retornada pelo servidor.');
    }
  } catch (err) {
    alert(`Erro ao iniciar checkout: ${err.message}`);
    btnConfirmCheckout.disabled = false;
    btnConfirmCheckout.innerHTML = '<span>⭐ Assinar Otaku Pro por R$ 12,90/mês</span>';
  }
}

// ============================================================================
// 6. EVENT LISTENERS
// ============================================================================
tabLogin?.addEventListener('click', () => switchTab('login'));
tabRegister?.addEventListener('click', () => switchTab('register'));
btnForgotPassword?.addEventListener('click', () => switchTab('forgot'));
btnForgotBack?.addEventListener('click', () => switchTab('login'));
btnResetBack?.addEventListener('click', () => switchTab('login'));

formLogin?.addEventListener('submit', handleLogin);
formRegister?.addEventListener('submit', handleRegister);
formForgot?.addEventListener('submit', handleForgot);
formReset?.addEventListener('submit', handleReset);

btnLogout?.addEventListener('click', handleLogout);
btnNavPremium?.addEventListener('click', openPremiumModal);
btnConfirmCheckout?.addEventListener('click', startStripeCheckout);
btnClosePremiumModal?.addEventListener('click', closePremiumModal);
btnCancelPremiumModal?.addEventListener('click', closePremiumModal);

premiumModal?.addEventListener('click', (e) => {
  if (e.target === premiumModal) closePremiumModal();
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    if (premiumModal && !premiumModal.classList.contains('hidden')) closePremiumModal();
  }
});

window.addEventListener('auth:unauthorized', () => {
  showAuthView();
});

// ============================================================================
// 7. INICIALIZAÇÃO
// ============================================================================
export async function initAuth() {
  initTheme();

  const urlParams = new URLSearchParams(window.location.search);

  // 1. Checa retorno de pagamento Stripe
  const paymentStatus = urlParams.get('payment');
  if (paymentStatus) {
    window.history.replaceState({}, document.title, window.location.pathname);
    if (paymentStatus === 'success') {
      setTimeout(() => {
        alert('🎉 Bem-vindo ao Otaku Pro! Sua assinatura foi aprovada com sucesso. Você agora tem listas ilimitadas, upload de avatar e selo VIP!');
      }, 500);
    } else if (paymentStatus === 'cancel') {
      setTimeout(() => {
        alert('O checkout do Stripe foi cancelado. Você pode assinar o Otaku Pro a qualquer momento.');
      }, 500);
    }
  }

  // 2. Checa token de redefinição de senha
  const resetToken = urlParams.get('reset_token');
  if (resetToken) {
    window.history.replaceState({}, document.title, window.location.pathname);
    showAuthView();
    showAlert('Verificando token de recuperação...', 'info');

    try {
      const check = await api.verifyResetToken(resetToken);
      activeResetToken = resetToken;
      switchTab('reset');
      if (resetTokenInfo) {
        resetTokenInfo.textContent = `Redefinindo senha da conta: ${check.email || ''}`;
      }
      hideAlert();
      return;
    } catch (err) {
      switchTab('login');
      showAlert(err.message || 'Link de recuperação inválido ou expirado (limite de 30 minutos).', 'danger');
      return;
    }
  }

  // 3. Checa sessão ativa
  const token = api.getToken();
  const user = api.getUser();

  if (token && user) {
    showAppView(user);

    try {
      const res = await api.me();
      if (res && res.user) {
        showAppView(res.user);
        window.dispatchEvent(new CustomEvent('auth:login', { detail: res.user }));
      }
    } catch {
      api.clearSession();
      showAuthView();
    }
  } else {
    showAuthView();
  }
}
