import { pool } from '../config/db.js';
import { minioClient, BUCKET_NAME, getPhotoPublicUrl } from '../config/minio.js';
import { validateImageMagicBytes } from '../utils/fileValidation.js';
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
    const [rows] = await pool.query('SELECT is_premium, role FROM usuarios WHERE id = ?', [userId]);
    return rows.length > 0 && (Boolean(rows[0].is_premium) || rows[0].role === 'admin');
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
      perPage = 30,
      search = '',
      sort = 'POPULARITY_DESC',
      season,
      seasonYear,
      genre
    } = req.query;

    const sortList = typeof sort === 'string' ? sort.split(',') : ['POPULARITY_DESC'];

    // 1. Busca animes locais cadastrados no MariaDB
    let localAnimes = [];
    try {
      let localSql = 'SELECT * FROM animes';
      let localParams = [];
      if (search && search.trim().length > 0) {
        localSql += ' WHERE titulo LIKE ? OR titulo_romaji LIKE ?';
        localParams.push(`%${search.trim()}%`, `%${search.trim()}%`);
      }
      localSql += ' ORDER BY id DESC LIMIT 50';
      const [lRows] = await pool.query(localSql, localParams);
      localAnimes = lRows.map((r) => ({
        id: r.id,
        title: { romaji: r.titulo_romaji || r.titulo, english: r.titulo, native: r.titulo },
        description: r.sinopse,
        coverImage: { large: r.poster_url, extraLarge: r.poster_url, medium: r.poster_url },
        bannerImage: r.banner_url || r.poster_url,
        episodes: r.episodios,
        status: r.status,
        format: r.formato,
        season: r.temporada,
        seasonYear: r.ano,
        genres: r.generos ? r.generos.split(',').map((g) => g.trim()) : [],
        averageScore: r.score,
        is_local: true
      }));
    } catch (lErr) {
      console.warn('[Catalog-DB] Aviso ao buscar animes locais:', lErr.message);
    }

    // 2. Busca catálogo geral na AniList
    let catalog = { pageInfo: { total: 0, currentPage: 1, lastPage: 1, hasNextPage: false }, animes: [] };
    try {
      catalog = await getAnimeCatalog({
        page: parseInt(page, 10) || 1,
        perPage: parseInt(perPage, 10) || 30,
        search: search || null,
        sort: sortList,
        season: season || null,
        seasonYear: seasonYear ? parseInt(seasonYear, 10) : null,
        genre: genre || null
      });
    } catch (apiErr) {
      console.warn('[AniList] Falha ao consultar catálogo externo, exibindo animes locais:', apiErr.message);
    }

    // Combina locais e externos evitando duplicidade de ID
    const localIds = new Set(localAnimes.map((a) => a.id));
    const combinedAnimes = [...localAnimes, ...catalog.animes.filter((a) => !localIds.has(a.id))];

    const userId = req.user?.id;
    let enrichedAnimes = combinedAnimes;

    // Se o usuário estiver autenticado, enriquece a lista com dados relacionais do MariaDB
    if (userId && combinedAnimes.length > 0) {
      const animeIds = combinedAnimes.map((a) => a.id);

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

      enrichedAnimes = combinedAnimes.map((anime) => ({
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
      total: catalog.pageInfo?.total || enrichedAnimes.length,
      animes: enrichedAnimes
    });
  } catch (err) {
    console.error('[AnimeController] Erro ao listar animes:', err);
    return res.status(500).json({
      error: 'Erro ao buscar catálogo de animes.',
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

    let anime = null;
    try {
      const [localRows] = await pool.query('SELECT * FROM animes WHERE id = ?', [animeId]);
      if (localRows.length > 0) {
        const r = localRows[0];
        anime = {
          id: r.id,
          title: { romaji: r.titulo_romaji || r.titulo, english: r.titulo, native: r.titulo },
          description: r.sinopse,
          coverImage: { large: r.poster_url, extraLarge: r.poster_url, medium: r.poster_url },
          bannerImage: r.banner_url || r.poster_url,
          episodes: r.episodios,
          status: r.status,
          format: r.formato,
          season: r.temporada,
          seasonYear: r.ano,
          genres: r.generos ? r.generos.split(',').map((g) => g.trim()) : [],
          averageScore: r.score,
          is_local: true
        };
      }
    } catch (_) {}

    if (!anime) {
      anime = await getAnimeById(animeId);
    }

    if (!anime) {
      return res.status(404).json({ error: 'Anime não encontrado no catálogo.' });
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
       WHERE c.anime_id = ?
       ORDER BY c.criado_em DESC`,
      [req.user?.role || 'otaku', animeId]
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
    const { anime_id, titulo, poster_url } = req.body;

    if (!anime_id || !titulo) {
      return res.status(400).json({ error: 'anime_id e titulo são obrigatórios.' });
    }

    const parsedId = parseInt(anime_id, 10);
    if (isNaN(parsedId)) {
      return res.status(400).json({ error: 'anime_id deve ser um número inteiro.' });
    }

    const resolvedPoster = poster_url || null;

    await pool.query(
      `INSERT INTO animes_favoritos (usuario_id, anime_id, titulo, poster_url)
       VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         titulo = VALUES(titulo),
         poster_url = VALUES(poster_url)`,
      [userId, parsedId, String(titulo).trim(), resolvedPoster]
    );

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
      'SELECT id, anime_id, titulo, poster_url, fixado FROM animes_favoritos WHERE usuario_id = ? AND (id = ? OR anime_id = ?)',
      [userId, targetId, targetId]
    );

    const isPremium = await checkUserIsPremium(userId);
    const maxAllowed = isPremium ? 6 : 2;

    if (favRows.length === 0) {
      // O anime ainda não estava em favoritos: adiciona e fixa diretamente
      const titulo = req.body.titulo || req.body.title || `Anime #${targetId}`;
      const posterUrl = req.body.poster_url || req.body.poster_path || null;

      const [countRows] = await pool.query(
        'SELECT COUNT(*) as total FROM animes_favoritos WHERE usuario_id = ? AND fixado = TRUE',
        [userId]
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

      const [insertResult] = await pool.query(
        'INSERT INTO animes_favoritos (usuario_id, anime_id, titulo, poster_url, fixado) VALUES (?, ?, ?, ?, TRUE)',
        [userId, targetId, titulo, posterUrl]
      );

      logAuditEvent({
        usuario_id: userId,
        acao: 'anime_adicionado_favorito_e_fixado',
        ip: clientIp,
        detalhes: {
          anime_id: targetId,
          titulo,
          fixado: true
        }
      });

      return res.json({
        success: true,
        message: 'Anime adicionado aos favoritos e fixado no topo do seu perfil!',
        id: insertResult.insertId,
        anime_id: targetId,
        fixado: true,
        favoritado: true
      });
    }

    const currentFav = favRows[0];

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

// ============================================================================
// 6. CRUD COMPLETO DA ENTIDADE PRINCIPAL: ANIMES (/api/animes)
// ============================================================================

/**
 * Cadastra um novo anime no catálogo próprio.
 * Rota: POST /api/animes
 */
export async function createAnime(req, res) {
  try {
    const userId = req.user.id;
    const clientIp = getClientIp(req);
    const {
      titulo,
      titulo_romaji,
      sinopse,
      poster_url,
      banner_url,
      episodios = 12,
      status = 'RELEASING',
      formato = 'TV',
      temporada = 'FALL',
      ano = 2026,
      generos = 'Ação, Fantasia',
      score = 80
    } = req.body;

    if (!titulo || typeof titulo !== 'string' || titulo.trim().length === 0) {
      return res.status(400).json({ error: 'O título do anime é obrigatório.' });
    }

    const newId = Math.floor(Date.now() / 1000) + Math.floor(Math.random() * 1000);

    await pool.query(
      `INSERT INTO animes (id, titulo, titulo_romaji, sinopse, poster_url, banner_url, episodios, status, formato, temporada, ano, generos, score)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        newId,
        titulo.trim(),
        titulo_romaji ? titulo_romaji.trim() : titulo.trim(),
        sinopse ? sinopse.trim() : '',
        poster_url || null,
        banner_url || null,
        parseInt(episodios, 10) || 12,
        status || 'RELEASING',
        formato || 'TV',
        temporada || 'FALL',
        parseInt(ano, 10) || 2026,
        generos || 'Ação, Fantasia',
        parseInt(score, 10) || 80
      ]
    );

    const [rows] = await pool.query('SELECT * FROM animes WHERE id = ?', [newId]);

    logAuditEvent({
      usuario_id: userId,
      acao: 'anime_criado',
      ip: clientIp,
      detalhes: {
        anime_id: newId,
        titulo: titulo.trim()
      }
    });

    return res.status(201).json({
      success: true,
      message: 'Anime cadastrado com sucesso no catálogo.',
      anime: rows[0]
    });
  } catch (err) {
    console.error('[AnimeController] Erro ao cadastrar anime:', err);
    return res.status(500).json({ error: 'Erro ao cadastrar anime.', details: err.message });
  }
}

/**
 * Atualiza os dados de um anime existente no catálogo.
 * Ação restrita a administradores e críticos: ação proibida responde 403.
 * Rota: PUT /api/animes/:id ou PATCH /api/animes/:id
 */
export async function updateAnime(req, res) {
  try {
    const userId = req.user.id;
    const userRole = req.user.role || 'otaku';
    const clientIp = getClientIp(req);
    const animeId = parseInt(req.params.id, 10);

    if (isNaN(animeId)) {
      return res.status(400).json({ error: 'ID de anime inválido.' });
    }

    if (userRole !== 'admin' && userRole !== 'critico') {
      logAuditEvent({
        usuario_id: userId,
        acao: 'permissao_negada',
        ip: clientIp,
        detalhes: {
          motivo: 'tentativa_edicao_anime_sem_permissao',
          anime_id: animeId,
          role: userRole
        }
      });
      return res.status(403).json({
        error: `Acesso proibido. O papel '${userRole}' não possui permissão para editar obras no catálogo.`
      });
    }

    const [existing] = await pool.query('SELECT * FROM animes WHERE id = ?', [animeId]);
    if (existing.length === 0) {
      return res.status(404).json({ error: 'Anime não encontrado no catálogo local.' });
    }

    const {
      titulo,
      titulo_romaji,
      sinopse,
      poster_url,
      banner_url,
      episodios,
      status,
      formato,
      temporada,
      ano,
      generos,
      score
    } = req.body;

    const updates = [];
    const params = [];

    if (titulo !== undefined) { updates.push('titulo = ?'); params.push(titulo.trim()); }
    if (titulo_romaji !== undefined) { updates.push('titulo_romaji = ?'); params.push(titulo_romaji.trim()); }
    if (sinopse !== undefined) { updates.push('sinopse = ?'); params.push(sinopse.trim()); }
    if (poster_url !== undefined) { updates.push('poster_url = ?'); params.push(poster_url); }
    if (banner_url !== undefined) { updates.push('banner_url = ?'); params.push(banner_url); }
    if (episodios !== undefined) { updates.push('episodios = ?'); params.push(parseInt(episodios, 10) || 12); }
    if (status !== undefined) { updates.push('status = ?'); params.push(status); }
    if (formato !== undefined) { updates.push('formato = ?'); params.push(formato); }
    if (temporada !== undefined) { updates.push('temporada = ?'); params.push(temporada); }
    if (ano !== undefined) { updates.push('ano = ?'); params.push(parseInt(ano, 10) || 2026); }
    if (generos !== undefined) { updates.push('generos = ?'); params.push(generos); }
    if (score !== undefined) { updates.push('score = ?'); params.push(parseInt(score, 10) || 80); }

    if (updates.length > 0) {
      params.push(animeId);
      await pool.query(`UPDATE animes SET ${updates.join(', ')} WHERE id = ?`, params);
    }

    const [updated] = await pool.query('SELECT * FROM animes WHERE id = ?', [animeId]);

    logAuditEvent({
      usuario_id: userId,
      acao: 'anime_atualizado',
      ip: clientIp,
      detalhes: {
        anime_id: animeId,
        campos_alterados: Object.keys(req.body)
      }
    });

    return res.json({
      success: true,
      message: 'Anime atualizado com sucesso.',
      anime: updated[0]
    });
  } catch (err) {
    console.error('[AnimeController] Erro ao atualizar anime:', err);
    return res.status(500).json({ error: 'Erro ao atualizar anime.', details: err.message });
  }
}

/**
 * Remove um anime do catálogo.
 * Ação restrita a administradores: tentativa não autorizada responde 403.
 * Rota: DELETE /api/animes/:id
 */
export async function deleteAnime(req, res) {
  try {
    const userId = req.user.id;
    const userRole = req.user.role || 'otaku';
    const clientIp = getClientIp(req);
    const animeId = parseInt(req.params.id, 10);

    if (isNaN(animeId)) {
      return res.status(400).json({ error: 'ID de anime inválido.' });
    }

    if (userRole !== 'admin') {
      logAuditEvent({
        usuario_id: userId,
        acao: 'permissao_negada',
        ip: clientIp,
        detalhes: {
          motivo: 'tentativa_exclusao_anime_sem_permissao',
          anime_id: animeId,
          role: userRole
        }
      });
      return res.status(403).json({
        error: `Acesso proibido. Somente administradores podem excluir animes do catálogo.`
      });
    }

    const [existing] = await pool.query('SELECT id, titulo FROM animes WHERE id = ?', [animeId]);
    if (existing.length === 0) {
      return res.status(404).json({ error: 'Anime não encontrado no catálogo local.' });
    }

    await pool.query('DELETE FROM animes WHERE id = ?', [animeId]);

    logAuditEvent({
      usuario_id: userId,
      acao: 'anime_excluido',
      ip: clientIp,
      detalhes: {
        anime_id: animeId,
        titulo: existing[0].titulo
      }
    });

    return res.json({
      success: true,
      message: 'Anime removido do catálogo com sucesso.'
    });
  } catch (err) {
    console.error('[AnimeController] Erro ao excluir anime:', err);
    return res.status(500).json({ error: 'Erro ao excluir anime.', details: err.message });
  }
}

/**
 * Upload de poster/capa do anime diretamente no MinIO (Object Storage) ligado ao domínio.
 * Rota: POST /api/animes/:id/cover
 */
export async function uploadAnimeCover(req, res) {
  try {
    const userId = req.user.id;
    const userRole = req.user.role || 'otaku';
    const clientIp = getClientIp(req);
    const animeId = parseInt(req.params.id, 10);

    if (isNaN(animeId)) {
      return res.status(400).json({ error: 'ID de anime inválido.' });
    }

    if (!req.file || !req.file.buffer) {
      return res.status(400).json({ error: 'Nenhum arquivo enviado. Utilize o campo "cover" ou "foto".' });
    }

    const magicCheck = validateImageMagicBytes(req.file.buffer);
    if (!magicCheck.valid) {
      return res.status(400).json({ error: magicCheck.error || 'Formato de imagem inválido.' });
    }

    const timestamp = Date.now();
    const objectKey = `covers/anime-${animeId}-${timestamp}.${magicCheck.ext}`;

    try {
      const exists = await minioClient.bucketExists(BUCKET_NAME);
      if (!exists) {
        await minioClient.makeBucket(BUCKET_NAME, 'us-east-1');
      }
    } catch (bErr) {
      console.warn('[MinIO] Verificação de bucket:', bErr.message);
    }

    await minioClient.putObject(
      BUCKET_NAME,
      objectKey,
      req.file.buffer,
      req.file.buffer.length,
      { 'Content-Type': magicCheck.mime }
    );

    const publicUrl = getPhotoPublicUrl(objectKey);

    // Atualiza tabela animes se existir no banco local
    await pool.query(
      'UPDATE animes SET poster_url = ? WHERE id = ?',
      [publicUrl, animeId]
    );

    logAuditEvent({
      usuario_id: userId,
      acao: 'upload_capa_anime',
      ip: clientIp,
      detalhes: {
        anime_id: animeId,
        chave_objeto: objectKey,
        url: publicUrl
      }
    });

    return res.json({
      success: true,
      message: 'Capa do anime salva no MinIO com sucesso.',
      poster_url: publicUrl,
      objectKey
    });
  } catch (err) {
    console.error('[Anime Cover Upload] Erro:', err);
    return res.status(500).json({ error: 'Erro ao realizar upload da capa no MinIO.', details: err.message });
  }
}

/**
 * Detalha um registro específico de anime assistido pelo ID.
 * Rota: GET /api/animes/assistidos/:id
 */
export async function getWatchedDetails(req, res) {
  try {
    const userId = req.user.id;
    const targetId = parseInt(req.params.id, 10);

    if (isNaN(targetId)) {
      return res.status(400).json({ error: 'Identificador de registro inválido.' });
    }

    const [rows] = await pool.query(
      'SELECT * FROM animes_assistidos WHERE usuario_id = ? AND (id = ? OR anime_id = ?)',
      [userId, targetId, targetId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Registro de anime assistido não encontrado.' });
    }

    return res.json({
      success: true,
      assistido: rows[0]
    });
  } catch (err) {
    console.error('[Watched] Erro ao detalhar anime assistido:', err);
    return res.status(500).json({ error: 'Erro ao buscar detalhes do anime assistido.' });
  }
}
