import { pool } from '../config/db.js';
import {
  getAnimeCatalog,
  getAnimeById,
  getSimulcastWeekly,
  getSimulcastToday
} from '../services/anilistService.js';
import { logAuditEvent } from '../services/auditService.js';

function getClientIp(req) {
  return req.headers['x-forwarded-for']?.split(',')[0].trim() || req.socket?.remoteAddress || req.ip || 'desconhecido';
}

/**
 * Retorna se o usuário logado possui assinatura Otaku Pro ativa.
 */
async function checkUserIsPremium(userId) {
  if (!userId) return false;
  try {
    const [rows] = await pool.query('SELECT is_premium FROM usuarios WHERE id = ?', [userId]);
    return rows.length > 0 && Boolean(rows[0].is_premium);
  } catch (err) {
    console.warn('[AnimeController] Erro ao checar status premium:', err.message);
    return false;
  }
}

// ============================================================================
// 1. CATÁLOGO GERAL & DETALHES DE ANIMES (AniList + MariaDB)
// ============================================================================

/**
 * Lista animes da AniList enriquecidos com status do usuário logado (assistido, irá ver, favorito).
 * Rota: GET /api/animes
 */
export async function listAnimes(req, res) {
  try {
    const {
      page = 1,
      perPage = 20,
      search = '',
      sort = 'POPULARITY_DESC',
      season,
      seasonYear,
      genre
    } = req.query;

    const sortList = typeof sort === 'string' ? sort.split(',') : ['POPULARITY_DESC'];

    const catalog = await getAnimeCatalog({
      page: parseInt(page, 10) || 1,
      perPage: parseInt(perPage, 10) || 20,
      search: search || null,
      sort: sortList,
      season: season || null,
      seasonYear: seasonYear ? parseInt(seasonYear, 10) : null,
      genre: genre || null
    });

    const userId = req.user?.id;
    let enrichedAnimes = catalog.animes;

    // Se o usuário estiver autenticado, enriquece a lista com dados relacionais do MariaDB
    if (userId && catalog.animes.length > 0) {
      const animeIds = catalog.animes.map((a) => a.id);

      // 1. Animes assistidos
      const [watchedRows] = await pool.query(
        'SELECT anime_id, episodios_vistos, total_episodios, nota, status FROM animes_assistidos WHERE usuario_id = ? AND anime_id IN (?)',
        [userId, animeIds]
      );
      const watchedMap = new Map();
      watchedRows.forEach((r) => watchedMap.set(r.anime_id, r));

      // 2. Animes na fila de espera (Irá Ver)
      const [planRows] = await pool.query(
        'SELECT anime_id, previsao_estreia FROM animes_ira_ver WHERE usuario_id = ? AND anime_id IN (?)',
        [userId, animeIds]
      );
      const planMap = new Map();
      planRows.forEach((r) => planMap.set(r.anime_id, r));

      // 3. Animes favoritos
      const [favRows] = await pool.query(
        'SELECT anime_id FROM animes_favoritos WHERE usuario_id = ? AND anime_id IN (?)',
        [userId, animeIds]
      );
      const favSet = new Set(favRows.map((r) => r.anime_id));

      // 4. Quantidade de comentários comunitários
      const [commRows] = await pool.query(
        'SELECT anime_id, COUNT(*) as total FROM comentarios WHERE anime_id IN (?) GROUP BY anime_id',
        [animeIds]
      );
      const commMap = new Map();
      commRows.forEach((r) => commMap.set(r.anime_id, r.total));

      enrichedAnimes = catalog.animes.map((anime) => ({
        ...anime,
        is_assistido: watchedMap.has(anime.id),
        dados_assistido: watchedMap.get(anime.id) || null,
        is_ira_ver: planMap.has(anime.id),
        dados_ira_ver: planMap.get(anime.id) || null,
        is_favorito: favSet.has(anime.id),
        is_favorite: favSet.has(anime.id),
        comments_count: commMap.get(anime.id) || 0
      }));
    }

    return res.json({
      success: true,
      pageInfo: catalog.pageInfo,
      total: enrichedAnimes.length,
      animes: enrichedAnimes,
      movies: enrichedAnimes // retrocompatibilidade com clientes legados
    });
  } catch (err) {
    console.error('[AnimeController] Erro ao listar animes:', err);
    return res.status(500).json({
      error: 'Erro ao buscar catálogo de animes na AniList.',
      details: err.message
    });
  }
}

/**
 * Detalhes completos de um anime pelo ID.
 * Rota: GET /api/animes/:id
 */
export async function getAnimeDetails(req, res) {
  try {
    const animeId = parseInt(req.params.id, 10);
    if (isNaN(animeId)) {
      return res.status(400).json({ error: 'ID de anime inválido.' });
    }

    const anime = await getAnimeById(animeId);
    if (!anime) {
      return res.status(404).json({ error: 'Anime não encontrado na AniList.' });
    }

    const userId = req.user?.id;
    let userStatus = {
      is_assistido: false,
      dados_assistido: null,
      is_ira_ver: false,
      dados_ira_ver: null,
      is_favorito: false
    };

    if (userId) {
      const [wRows] = await pool.query(
        'SELECT id, episodios_vistos, total_episodios, nota, status FROM animes_assistidos WHERE usuario_id = ? AND anime_id = ?',
        [userId, animeId]
      );
      const [pRows] = await pool.query(
        'SELECT id, previsao_estreia FROM animes_ira_ver WHERE usuario_id = ? AND anime_id = ?',
        [userId, animeId]
      );
      const [fRows] = await pool.query(
        'SELECT id FROM animes_favoritos WHERE usuario_id = ? AND anime_id = ?',
        [userId, animeId]
      );

      userStatus = {
        is_assistido: wRows.length > 0,
        dados_assistido: wRows[0] || null,
        is_ira_ver: pRows.length > 0,
        dados_ira_ver: pRows[0] || null,
        is_favorito: fRows.length > 0
      };
    }

    // Busca comentários comunitários do anime
    const [comments] = await pool.query(
      `SELECT c.id, c.usuario_id, c.anime_id, c.texto, c.criado_em,
              u.nome AS autor_nome,
              u.is_premium AS autor_is_premium,
              u.foto_perfil AS autor_foto,
              IF(? = 'admin', u.email, NULL) AS autor_email
       FROM comentarios c
       LEFT JOIN usuarios u ON c.usuario_id = u.id
       WHERE c.anime_id = ? OR c.tmdb_movie_id = ?
       ORDER BY c.criado_em DESC`,
      [req.user?.role || 'usuario', animeId, animeId]
    );

    return res.json({
      ...anime,
      ...userStatus,
      is_favorite: userStatus.is_favorito,
      comments_count: comments.length,
      comments
    });
  } catch (err) {
    console.error('[AnimeController] Erro ao obter detalhes do anime:', err);
    return res.status(500).json({ error: 'Erro ao obter detalhes do anime.', details: err.message });
  }
}

// ============================================================================
// 2. R1: ANIMES ASSISTIDOS (/api/animes/assistidos)
// ============================================================================

/**
 * Lista animes assistidos do usuário autenticado.
 * Rota: GET /api/animes/assistidos
 */
export async function listWatched(req, res) {
  try {
    const userId = req.user.id;
    const isPremium = await checkUserIsPremium(userId);

    const [rows] = await pool.query(
      `SELECT id, usuario_id, anime_id, titulo, poster_url, episodios_vistos, total_episodios, nota, status, criado_em
       FROM animes_assistidos
       WHERE usuario_id = ?
       ORDER BY criado_em DESC`,
      [userId]
    );

    return res.json({
      success: true,
      total: rows.length,
      is_premium: isPremium,
      limit: null, // Ilimitado para todos os usuários (Plano Free e Pro)
      animes: rows
    });
  } catch (err) {
    console.error('[Watched] Erro ao listar animes assistidos:', err);
    return res.status(500).json({ error: 'Erro ao listar animes assistidos.' });
  }
}

/**
 * Cadastra anime concluído ou em progresso no histórico do usuário.
 * Regra: Ilimitado para todos os usuários (Free e Pro).
 * Emite evento Redis Streams: anime_marcado_assistido
 * Rota: POST /api/animes/assistidos
 */
export async function addWatched(req, res) {
  try {
    const userId = req.user.id;
    const clientIp = getClientIp(req);
    const { anime_id, titulo, poster_url, episodios_vistos = 0, total_episodios = 12, nota = null, status = 'concluido' } = req.body;

    if (!anime_id || !titulo) {
      return res.status(400).json({ error: 'anime_id e titulo são obrigatórios.' });
    }

    const parsedAnimeId = parseInt(anime_id, 10);
    if (isNaN(parsedAnimeId)) {
      return res.status(400).json({ error: 'anime_id deve ser um número inteiro.' });
    }

    // Salva ou atualiza no MariaDB
    await pool.query(
      `INSERT INTO animes_assistidos (usuario_id, anime_id, titulo, poster_url, episodios_vistos, total_episodios, nota, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         titulo = VALUES(titulo),
         poster_url = VALUES(poster_url),
         episodios_vistos = VALUES(episodios_vistos),
         total_episodios = VALUES(total_episodios),
         nota = VALUES(nota),
         status = VALUES(status)`,
      [
        userId,
        parsedAnimeId,
        String(titulo).trim(),
        poster_url || null,
        parseInt(episodios_vistos, 10) || 0,
        parseInt(total_episodios, 10) || 12,
        nota !== null && !isNaN(Number(nota)) ? Number(nota) : null,
        status || 'concluido'
      ]
    );

    // Auditoria comportamental via Redis Streams
    logAuditEvent({
      usuario_id: userId,
      acao: 'anime_marcado_assistido',
      ip: clientIp,
      detalhes: {
        anime_id: parsedAnimeId,
        titulo: String(titulo).trim(),
        episodios_vistos,
        total_episodios,
        nota,
        status
      }
    });

    const [saved] = await pool.query(
      'SELECT id, usuario_id, anime_id, titulo, poster_url, episodios_vistos, total_episodios, nota, status, criado_em FROM animes_assistidos WHERE usuario_id = ? AND anime_id = ?',
      [userId, parsedAnimeId]
    );

    return res.status(201).json({
      success: true,
      message: 'Anime registrado nos assistidos com sucesso.',
      anime: saved[0]
    });
  } catch (err) {
    console.error('[Watched] Erro ao cadastrar anime assistido:', err);
    return res.status(500).json({ error: 'Erro ao cadastrar anime assistido.', details: err.message });
  }
}

/**
 * Atualiza número de episódios vistos, nota ou status de um anime assistido.
 * Rota: PATCH /api/animes/assistidos/:id
 */
export async function updateWatched(req, res) {
  try {
    const userId = req.user.id;
    const targetId = parseInt(req.params.id, 10);
    const { episodios_vistos, total_episodios, nota, status } = req.body;

    if (isNaN(targetId)) {
      return res.status(400).json({ error: 'Identificador de anime inválido.' });
    }

    const [existing] = await pool.query(
      'SELECT id, anime_id, titulo FROM animes_assistidos WHERE usuario_id = ? AND (id = ? OR anime_id = ?)',
      [userId, targetId, targetId]
    );

    if (existing.length === 0) {
      return res.status(404).json({ error: 'Registro de anime assistido não encontrado.' });
    }

    const updates = [];
    const params = [];

    if (episodios_vistos !== undefined) {
      updates.push('episodios_vistos = ?');
      params.push(parseInt(episodios_vistos, 10) || 0);
    }
    if (total_episodios !== undefined) {
      updates.push('total_episodios = ?');
      params.push(parseInt(total_episodios, 10) || 12);
    }
    if (nota !== undefined) {
      updates.push('nota = ?');
      params.push(nota !== null && !isNaN(Number(nota)) ? Number(nota) : null);
    }
    if (status !== undefined) {
      updates.push('status = ?');
      params.push(status);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'Nenhum campo fornecido para atualização.' });
    }

    params.push(existing[0].id);
    await pool.query(
      `UPDATE animes_assistidos SET ${updates.join(', ')} WHERE id = ?`,
      params
    );

    const [updatedRows] = await pool.query(
      'SELECT * FROM animes_assistidos WHERE id = ?',
      [existing[0].id]
    );

    return res.json({
      success: true,
      message: 'Registro de anime assistido atualizado com sucesso.',
      anime: updatedRows[0]
    });
  } catch (err) {
    console.error('[Watched] Erro ao atualizar anime assistido:', err);
    return res.status(500).json({ error: 'Erro ao atualizar anime assistido.', details: err.message });
  }
}

/**
 * Remove anime do histórico de assistidos.
 * Rota: DELETE /api/animes/assistidos/:id
 */
export async function removeWatched(req, res) {
  try {
    const userId = req.user.id;
    const targetId = parseInt(req.params.id, 10);

    if (isNaN(targetId)) {
      return res.status(400).json({ error: 'Identificador de anime inválido.' });
    }

    const [result] = await pool.query(
      'DELETE FROM animes_assistidos WHERE usuario_id = ? AND (id = ? OR anime_id = ?)',
      [userId, targetId, targetId]
    );

    return res.json({
      success: true,
      message: 'Anime removido do histórico de assistidos.',
      affectedRows: result.affectedRows
    });
  } catch (err) {
    console.error('[Watched] Erro ao remover anime assistido:', err);
    return res.status(500).json({ error: 'Erro ao remover anime assistido.', details: err.message });
  }
}

// ============================================================================
// 3. R2: ANIMES QUE IRÁ VER (/api/animes/ira-ver)
// ============================================================================

/**
 * Lista fila de espera / Plan to Watch do usuário autenticado.
 * Rota: GET /api/animes/ira-ver
 */
export async function listPlanToWatch(req, res) {
  try {
    const userId = req.user.id;
    const isPremium = await checkUserIsPremium(userId);

    const [rows] = await pool.query(
      `SELECT id, usuario_id, anime_id, titulo, poster_url, previsao_estreia, criado_em
       FROM animes_ira_ver
       WHERE usuario_id = ?
       ORDER BY criado_em DESC`,
      [userId]
    );

    return res.json({
      success: true,
      total: rows.length,
      is_premium: isPremium,
      limit: null, // Ilimitado para todos os usuários (Plano Free e Pro)
      animes: rows
    });
  } catch (err) {
    console.error('[PlanToWatch] Erro ao listar animes que irá ver:', err);
    return res.status(500).json({ error: 'Erro ao listar fila de espera.' });
  }
}

/**
 * Adiciona anime à fila de espera (Plan to Watch).
 * Regra: Ilimitado para todos os usuários (Free e Pro).
 * Emite evento Redis Streams: anime_adicionado_ira_ver
 * Rota: POST /api/animes/ira-ver
 */
export async function addPlanToWatch(req, res) {
  try {
    const userId = req.user.id;
    const clientIp = getClientIp(req);
    const { anime_id, titulo, poster_url, previsao_estreia = null } = req.body;

    if (!anime_id || !titulo) {
      return res.status(400).json({ error: 'anime_id e titulo são obrigatórios.' });
    }

    const parsedAnimeId = parseInt(anime_id, 10);
    if (isNaN(parsedAnimeId)) {
      return res.status(400).json({ error: 'anime_id deve ser um número inteiro.' });
    }

    await pool.query(
      `INSERT INTO animes_ira_ver (usuario_id, anime_id, titulo, poster_url, previsao_estreia)
       VALUES (?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         titulo = VALUES(titulo),
         poster_url = VALUES(poster_url),
         previsao_estreia = VALUES(previsao_estreia)`,
      [userId, parsedAnimeId, String(titulo).trim(), poster_url || null, previsao_estreia || null]
    );

    logAuditEvent({
      usuario_id: userId,
      acao: 'anime_adicionado_ira_ver',
      ip: clientIp,
      detalhes: {
        anime_id: parsedAnimeId,
        titulo: String(titulo).trim(),
        previsao_estreia
      }
    });

    const [saved] = await pool.query(
      'SELECT id, usuario_id, anime_id, titulo, poster_url, previsao_estreia, criado_em FROM animes_ira_ver WHERE usuario_id = ? AND anime_id = ?',
      [userId, parsedAnimeId]
    );

    return res.status(201).json({
      success: true,
      message: 'Anime adicionado à fila de espera (Irá Ver).',
      anime: saved[0]
    });
  } catch (err) {
    console.error('[PlanToWatch] Erro ao adicionar anime à fila de espera:', err);
    return res.status(500).json({ error: 'Erro ao adicionar anime à fila de espera.', details: err.message });
  }
}

/**
 * Remove anime da fila de espera.
 * Rota: DELETE /api/animes/ira-ver/:id
 */
export async function removePlanToWatch(req, res) {
  try {
    const userId = req.user.id;
    const targetId = parseInt(req.params.id, 10);

    if (isNaN(targetId)) {
      return res.status(400).json({ error: 'Identificador de anime inválido.' });
    }

    const [result] = await pool.query(
      'DELETE FROM animes_ira_ver WHERE usuario_id = ? AND (id = ? OR anime_id = ?)',
      [userId, targetId, targetId]
    );

    return res.json({
      success: true,
      message: 'Anime removido da fila de espera com sucesso.',
      affectedRows: result.affectedRows
    });
  } catch (err) {
    console.error('[PlanToWatch] Erro ao remover anime da fila:', err);
    return res.status(500).json({ error: 'Erro ao remover anime da fila.', details: err.message });
  }
}

// ============================================================================
// 4. R3: ANIMES FAVORITOS (/api/animes/favoritos)
// ============================================================================

/**
 * Lista os animes favoritos do usuário autenticado.
 * Rota: GET /api/animes/favoritos
 */
export async function listFavorites(req, res) {
  try {
    const userId = req.user.id;
    const isPremium = await checkUserIsPremium(userId);

    const [rows] = await pool.query(
      `SELECT id, usuario_id, anime_id, titulo, poster_url, fixado, criado_em
       FROM animes_favoritos
       WHERE usuario_id = ?
       ORDER BY fixado DESC, criado_em DESC`,
      [userId]
    );

    const pinnedCount = rows.filter((r) => Boolean(r.fixado)).length;

    return res.json({
      success: true,
      total: rows.length,
      is_premium: isPremium,
      limit: null, // Ilimitado para todos os usuários (Plano Free e Pro)
      pinned_count: pinnedCount,
      pinned_limit: isPremium ? 6 : 2,
      favorites: rows.map((r) => ({ ...r, fixado: Boolean(r.fixado) }))
    });
  } catch (err) {
    console.error('[Favorites] Erro ao listar favoritos:', err);
    return res.status(500).json({ error: 'Erro ao listar favoritos.' });
  }
}

/**
 * Adiciona anime aos favoritos.
 * Regra: Ilimitado para todos os usuários (Free e Pro).
 * Emite evento Redis Streams: anime_favoritado
 * Rota: POST /api/animes/favoritos
 */
export async function addFavorite(req, res) {
  try {
    const userId = req.user.id;
    const clientIp = getClientIp(req);
    const { anime_id, tmdb_movie_id, titulo, poster_url, poster_path } = req.body;

    const rawId = anime_id || tmdb_movie_id;
    if (!rawId || !titulo) {
      return res.status(400).json({ error: 'anime_id e titulo são obrigatórios.' });
    }

    const parsedId = parseInt(rawId, 10);
    if (isNaN(parsedId)) {
      return res.status(400).json({ error: 'anime_id deve ser um número inteiro.' });
    }

    const resolvedPoster = poster_url || poster_path || null;

    await pool.query(
      `INSERT INTO animes_favoritos (usuario_id, anime_id, titulo, poster_url)
       VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         titulo = VALUES(titulo),
         poster_url = VALUES(poster_url)`,
      [userId, parsedId, String(titulo).trim(), resolvedPoster]
    );

    // Também sincroniza com a tabela 'favoritos' legada para compatibilidade retroativa
    try {
      await pool.query(
        `INSERT INTO favoritos (usuario_id, tmdb_movie_id, titulo, poster_path)
         VALUES (?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           titulo = VALUES(titulo),
           poster_path = VALUES(poster_path)`,
        [userId, parsedId, String(titulo).trim(), resolvedPoster]
      );
    } catch (_) {
      // Ignora falhas na tabela legada
    }

    logAuditEvent({
      usuario_id: userId,
      acao: 'anime_favoritado',
      ip: clientIp,
      detalhes: {
        anime_id: parsedId,
        titulo: String(titulo).trim()
      }
    });

    const [saved] = await pool.query(
      'SELECT id, usuario_id, anime_id, titulo, poster_url, criado_em FROM animes_favoritos WHERE usuario_id = ? AND anime_id = ?',
      [userId, parsedId]
    );

    return res.status(201).json({
      success: true,
      message: 'Anime adicionado aos favoritos com sucesso.',
      favorite: saved[0]
    });
  } catch (err) {
    console.error('[Favorites] Erro ao favoritar anime:', err);
    return res.status(500).json({ error: 'Erro ao salvar anime nos favoritos.', details: err.message });
  }
}

/**
 * Remove anime dos favoritos.
 * Rota: DELETE /api/animes/favoritos/:id
 */
export async function removeFavorite(req, res) {
  try {
    const userId = req.user.id;
    const clientIp = getClientIp(req);
    const targetId = parseInt(req.params.id, 10);

    if (isNaN(targetId)) {
      return res.status(400).json({ error: 'Identificador de anime inválido.' });
    }

    const [result] = await pool.query(
      'DELETE FROM animes_favoritos WHERE usuario_id = ? AND (id = ? OR anime_id = ?)',
      [userId, targetId, targetId]
    );

    // Também remove da tabela de favoritos legada
    try {
      await pool.query(
        'DELETE FROM favoritos WHERE usuario_id = ? AND (id = ? OR tmdb_movie_id = ?)',
        [userId, targetId, targetId]
      );
    } catch (_) {}

    logAuditEvent({
      usuario_id: userId,
      acao: 'desfavoritar_anime',
      ip: clientIp,
      detalhes: {
        anime_id: targetId
      }
    });

    return res.json({
      success: true,
      message: 'Anime removido dos favoritos com sucesso.',
      affectedRows: result.affectedRows
    });
  } catch (err) {
    console.error('[Favorites] Erro ao remover favorito:', err);
    return res.status(500).json({ error: 'Erro ao remover favorito.', details: err.message });
  }
}

/**
 * Alterna ou define se um anime favorito está fixado no perfil.
 * Regra: Usuários Free podem fixar até 2 animes. Usuários Otaku Pro podem fixar até 6 animes.
 * Rota: PATCH /api/animes/favoritos/:id/pin
 */
export async function togglePinFavorite(req, res) {
  try {
    const userId = req.user.id;
    const clientIp = getClientIp(req);
    const targetId = parseInt(req.params.id, 10);

    if (isNaN(targetId)) {
      return res.status(400).json({ error: 'Identificador de favorito inválido.' });
    }

    const [favRows] = await pool.query(
      'SELECT id, anime_id, titulo, fixado FROM animes_favoritos WHERE usuario_id = ? AND (id = ? OR anime_id = ?)',
      [userId, targetId, targetId]
    );

    if (favRows.length === 0) {
      return res.status(404).json({ error: 'Anime favorito não encontrado na sua lista.' });
    }

    const currentFav = favRows[0];
    const isPremium = await checkUserIsPremium(userId);
    const maxAllowed = isPremium ? 6 : 2;

    const newFixadoState = req.body.fixado !== undefined ? Boolean(req.body.fixado) : !Boolean(currentFav.fixado);

    if (newFixadoState) {
      // Contabiliza quantos animes já estão fixados (excluindo este registro)
      const [countRows] = await pool.query(
        'SELECT COUNT(*) as total FROM animes_favoritos WHERE usuario_id = ? AND fixado = TRUE AND id != ?',
        [userId, currentFav.id]
      );
      const currentlyPinned = countRows[0]?.total || 0;

      if (!isPremium && currentlyPinned >= 2) {
        logAuditEvent({
          usuario_id: userId,
          acao: 'tentativa_acesso_negada',
          ip: clientIp,
          detalhes: {
            motivo: 'limite_animes_fixados_plano_free',
            limite: 2,
            atual: currentlyPinned
          }
        });

        return res.status(403).json({
          error: 'Usuários do Plano Gratuito podem fixar até 2 animes favoritos no perfil. Assine o Plano Otaku Pro para fixar até 6 animes!',
          code: 'PREMIUM_REQUIRED',
          limit: 2,
          current: currentlyPinned,
          is_premium: false
        });
      }

      if (currentlyPinned >= maxAllowed) {
        return res.status(400).json({
          error: `Você já atingiu o limite de ${maxAllowed} animes fixados no perfil.`,
          code: 'PIN_LIMIT_REACHED',
          limit: maxAllowed
        });
      }
    }

    await pool.query(
      'UPDATE animes_favoritos SET fixado = ? WHERE id = ? AND usuario_id = ?',
      [newFixadoState, currentFav.id, userId]
    );

    logAuditEvent({
      usuario_id: userId,
      acao: newFixadoState ? 'anime_favorito_fixado' : 'anime_favorito_desfixado',
      ip: clientIp,
      detalhes: {
        favorito_id: currentFav.id,
        anime_id: currentFav.anime_id,
        titulo: currentFav.titulo,
        fixado: newFixadoState
      }
    });

    return res.json({
      success: true,
      message: newFixadoState ? 'Anime fixado no topo do perfil com sucesso!' : 'Anime desfixado do perfil.',
      id: currentFav.id,
      anime_id: currentFav.anime_id,
      fixado: newFixadoState
    });
  } catch (err) {
    console.error('[Favorites Pin] Erro ao alternar fixação de favorito:', err);
    return res.status(500).json({ error: 'Erro ao atualizar destaque do anime no perfil.', details: err.message });
  }
}

// ============================================================================
// 5. R4: ANIMES DE SIMULCAST (/api/animes/simulcast)
// ============================================================================

/**
 * Grade semanal de transmissão simultânea japonesa (segunda a domingo).
 * Rota: GET /api/animes/simulcast
 */
export async function listSimulcastWeekly(req, res) {
  try {
    const data = await getSimulcastWeekly();
    return res.json(data);
  } catch (err) {
    console.error('[Simulcast] Erro ao buscar simulcast semanal:', err);
    return res.status(500).json({
      error: 'Erro ao obter grade de simulcast da temporada na AniList.',
      details: err.message
    });
  }
}

/**
 * Lançamentos com episódio hoje na data atual do servidor.
 * Rota: GET /api/animes/simulcast/hoje
 */
export async function listSimulcastToday(req, res) {
  try {
    const data = await getSimulcastToday();
    return res.json(data);
  } catch (err) {
    console.error('[Simulcast] Erro ao buscar simulcast de hoje:', err);
    return res.status(500).json({
      error: 'Erro ao obter lançamentos de simulcast de hoje na AniList.',
      details: err.message
    });
  }
}
