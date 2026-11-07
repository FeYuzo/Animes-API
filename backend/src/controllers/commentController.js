import { pool } from '../config/db.js';
import { checkUserPermission } from '../services/authService.js';
import { logAuditEvent } from '../services/auditService.js';

function getClientIp(req) {
  return req.headers['x-forwarded-for']?.split(',')[0].trim() || req.socket?.remoteAddress || req.ip || 'desconhecido';
}

/**
 * Lista os comentários de um anime específico.
 * Todos os usuários autenticados (comuns e administradores) podem visualizar
 * os comentários da comunidade com o nome do autor e selo VIP Pro.
 * Rota: GET /api/animes/:anime_id/comments ou GET /api/movies/:tmdb_movie_id/comments
 */
export async function listMovieComments(req, res) {
  try {
    const userRole = req.user?.role || 'usuario';
    const rawId = req.params.anime_id || req.params.tmdb_movie_id || req.params.id;
    const animeId = parseInt(rawId, 10);

    if (isNaN(animeId)) {
      return res.status(400).json({ error: 'Identificador de anime inválido.' });
    }

    const query = `
      SELECT c.id, c.usuario_id, COALESCE(c.anime_id, c.tmdb_movie_id) AS anime_id, c.texto, c.criado_em,
             u.nome AS autor_nome,
             u.is_premium AS autor_is_premium,
             u.foto_perfil AS autor_foto,
             IF(? = 'admin', u.email, NULL) AS autor_email
      FROM comentarios c
      LEFT JOIN usuarios u ON c.usuario_id = u.id
      WHERE c.anime_id = ? OR c.tmdb_movie_id = ?
      ORDER BY c.criado_em DESC
    `;
    const params = [userRole, animeId, animeId];

    const [rows] = await pool.query(query, params);

    return res.json({
      success: true,
      total: rows.length,
      comments: rows
    });
  } catch (err) {
    console.error('[Comments] Erro ao listar comentários:', err);
    return res.status(500).json({ error: 'Erro ao buscar comentários do anime.' });
  }
}

/**
 * Adiciona um comentário para um anime específico vinculado ao usuário logado.
 * Rota: POST /api/animes/:anime_id/comments ou POST /api/movies/:tmdb_movie_id/comments
 */
export async function addComment(req, res) {
  try {
    const userId = req.user.id;
    const clientIp = getClientIp(req);
    const rawId = req.params.anime_id || req.params.tmdb_movie_id || req.body.anime_id || req.body.tmdb_movie_id;
    const animeId = parseInt(rawId, 10);
    const { texto } = req.body;

    if (isNaN(animeId)) {
      return res.status(400).json({ error: 'Identificador de anime inválido.' });
    }

    if (!texto || typeof texto !== 'string' || texto.trim().length === 0) {
      return res.status(400).json({ error: 'O texto do comentário não pode ser vazio.' });
    }

    const [result] = await pool.query(
      `INSERT INTO comentarios (usuario_id, anime_id, tmdb_movie_id, texto)
       VALUES (?, ?, ?, ?)`,
      [userId, animeId, animeId, texto.trim()]
    );

    const [newCommentRows] = await pool.query(
      'SELECT id, usuario_id, anime_id, texto, criado_em FROM comentarios WHERE id = ?',
      [result.insertId]
    );

    // Auditoria comportamental no Redis Streams: 'comentario_postado'
    logAuditEvent({
      usuario_id: userId,
      acao: 'comentario_postado',
      ip: clientIp,
      detalhes: {
        comentario_id: result.insertId,
        anime_id: animeId
      }
    });

    return res.status(201).json({
      success: true,
      message: 'Comentário salvo com sucesso.',
      comment: newCommentRows[0]
    });
  } catch (err) {
    console.error('[Comments] Erro ao adicionar comentário:', err);
    return res.status(500).json({ error: 'Erro ao salvar comentário.' });
  }
}

/**
 * Remove um comentário com Enforcement Centralizado de Permissões RBAC (Padrão A).
 * - Usuário comum: só pode apagar o próprio comentário (comentarios:excluir_proprio).
 * - Moderação (Admin): pode apagar comentários de qualquer usuário (comentarios:excluir_qualquer).
 * Rota: DELETE /api/comments/:id
 */
export async function deleteComment(req, res) {
  try {
    const userId = req.user.id;
    const commentId = parseInt(req.params.id, 10);
    const clientIp = getClientIp(req);

    if (isNaN(commentId)) {
      return res.status(400).json({ error: 'ID do comentário inválido.' });
    }

    // 1. Busca o comentário no banco de dados
    const [rows] = await pool.query(
      'SELECT id, usuario_id, anime_id, tmdb_movie_id, texto FROM comentarios WHERE id = ?',
      [commentId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Comentário não encontrado.' });
    }

    const comment = rows[0];
    const targetAnimeId = comment.anime_id || comment.tmdb_movie_id;

    // 2. Se o usuário autenticado for o autor do comentário:
    // Permissão 'comentarios:excluir_proprio' (permitido para usuario e admin)
    if (comment.usuario_id === userId) {
      await pool.query('DELETE FROM comentarios WHERE id = ?', [commentId]);

      logAuditEvent({
        usuario_id: userId,
        acao: 'apagar_comentario',
        ip: clientIp,
        detalhes: {
          comentario_id: commentId,
          anime_id: targetAnimeId,
          tipo: 'proprio'
        }
      });

      return res.json({
        success: true,
        message: 'Comentário removido com sucesso pelo autor.'
      });
    }

    // 3. Se NÃO for o autor, trata-se de tentativa de excluir comentário de outro usuário.
    // Requer permissão exclusiva de moderação: 'comentarios:excluir_qualquer'
    const authCheck = await checkUserPermission(userId, 'comentarios:excluir_qualquer');

    if (!authCheck.allowed) {
      logAuditEvent({
        usuario_id: userId,
        acao: 'permissao_negada',
        ip: clientIp,
        detalhes: {
          motivo: 'tentativa_moderacao_sem_permissao',
          rota: req.originalUrl,
          metodo: req.method,
          comentario_id: commentId,
          autor_comentario_id: comment.usuario_id,
          permissao_requerida: 'comentarios:excluir_qualquer'
        }
      });

      return res.status(403).json({
        error: 'Acesso proibido. Você não tem permissão para excluir comentários de outros usuários.'
      });
    }

    // 4. Autorizado pelo auth-service (papel admin): executa exclusão administrativa
    await pool.query('DELETE FROM comentarios WHERE id = ?', [commentId]);

    logAuditEvent({
      usuario_id: userId,
      acao: 'apagar_comentario_moderacao',
      ip: clientIp,
      detalhes: {
        comentario_id: commentId,
        autor_comentario_id: comment.usuario_id,
        anime_id: targetAnimeId,
        tipo: 'moderacao_admin'
      }
    });

    return res.json({
      success: true,
      message: 'Comentário removido com sucesso (ação de moderação administrativa).'
    });
  } catch (err) {
    console.error('[Comments] Erro ao remover comentário:', err);
    return res.status(500).json({ error: 'Erro ao remover comentário.' });
  }
}
