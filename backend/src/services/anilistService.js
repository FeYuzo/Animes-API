import dotenv from 'dotenv';

dotenv.config();

const ANILIST_GRAPHQL_URL = 'https://graphql.anilist.co';
const ANILIST_CLIENT_ID = process.env.ANILIST_CLIENT_ID || '56253';
const ANILIST_CLIENT_SECRET = process.env.ANILIST_CLIENT_SECRET || 'kQSkVbWDjm4Zw5MZ7b1ZsNAHxpAeGaCH8yjElpxq';

// Cache em memória para evitar exceder o rate limit da AniList (90 req/min)
const cache = new Map();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutos

function getFromCache(key) {
  const cached = cache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.data;
  }
  return null;
}

function setInCache(key, data) {
  cache.set(key, { data, timestamp: Date.now() });
}

/**
 * Executa uma consulta GraphQL na API pública do AniList.
 */
async function queryAniList(query, variables = {}) {
  const headers = {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    'X-Client-Id': ANILIST_CLIENT_ID
  };

  const response = await fetch(ANILIST_GRAPHQL_URL, {
    method: 'POST',
    headers,
    body: JSON.stringify({ query, variables })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Erro na API AniList (${response.status}): ${errorText}`);
  }

  const json = await response.json();
  if (json.errors && json.errors.length > 0) {
    throw new Error(`AniList GraphQL Error: ${json.errors[0].message}`);
  }

  return json.data;
}

/**
 * Formata um objeto de Media retornado pela AniList para o padrão do AniTrack.
 */
function formatMedia(media) {
  if (!media) return null;

  const titleEnglish = media.title?.english || null;
  const titleRomaji = media.title?.romaji || null;
  const titleNative = media.title?.native || null;
  const primaryTitle = titleEnglish || titleRomaji || titleNative || 'Título Indisponível';

  // Remove tags HTML da descrição da AniList se existirem
  const cleanDescription = media.description
    ? media.description.replace(/<[^>]*>/g, '').trim()
    : 'Sinopse não disponível.';

  return {
    id: media.id,
    anime_id: media.id,
    titulo: primaryTitle,
    title: primaryTitle,
    titulo_original: titleRomaji || titleNative,
    titulo_ingles: titleEnglish,
    titulo_romaji: titleRomaji,
    titulo_japones: titleNative,
    sinopse: cleanDescription,
    overview: cleanDescription,
    poster_url: media.coverImage?.extraLarge || media.coverImage?.large || media.coverImage?.medium || null,
    poster_path: media.coverImage?.large || null,
    banner_url: media.bannerImage || null,
    formato: media.format || 'TV',
    status: media.status || 'UNKNOWN',
    total_episodios: media.episodes || 12,
    episodes: media.episodes || null,
    duracao_minutos: media.duration || null,
    temporada: media.season || null,
    ano_temporada: media.seasonYear || null,
    generos: media.genres || [],
    score_medio: media.averageScore || 0,
    vote_average: media.averageScore ? Number((media.averageScore / 10).toFixed(1)) : 0,
    popularidade: media.popularity || 0,
    popularity: media.popularity || 0,
    data_estreia: media.startDate?.year ? `${media.startDate.year}-${String(media.startDate.month || 1).padStart(2, '0')}-${String(media.startDate.day || 1).padStart(2, '0')}` : null,
    proximo_episodio: media.nextAiringEpisode ? {
      episodio: media.nextAiringEpisode.episode,
      airing_at: media.nextAiringEpisode.airingAt,
      tempo_restante_segundos: media.nextAiringEpisode.timeUntilAiring
    } : null
  };
}

/**
 * Busca o catálogo geral de animes na AniList (com suporte a busca, filtros e ordenação).
 */
export async function getAnimeCatalog({
  page = 1,
  perPage = 20,
  search = null,
  sort = ['POPULARITY_DESC'],
  season = null,
  seasonYear = null,
  genre = null
} = {}) {
  const cacheKey = `catalog_${page}_${perPage}_${search}_${sort?.join(',')}_${season}_${seasonYear}_${genre}`;
  const cached = getFromCache(cacheKey);
  if (cached) return cached;

  const query = `
    query getCatalog(
      $page: Int,
      $perPage: Int,
      $search: String,
      $sort: [MediaSort],
      $season: MediaSeason,
      $seasonYear: Int,
      $genre: String
    ) {
      Page(page: $page, perPage: $perPage) {
        pageInfo {
          total
          currentPage
          lastPage
          hasNextPage
          perPage
        }
        media(
          type: ANIME,
          search: $search,
          sort: $sort,
          season: $season,
          seasonYear: $seasonYear,
          genre: $genre
        ) {
          id
          title {
            romaji
            english
            native
          }
          description
          coverImage {
            large
            extraLarge
          }
          bannerImage
          format
          episodes
          duration
          status
          season
          seasonYear
          genres
          averageScore
          popularity
          startDate {
            year
            month
            day
          }
          nextAiringEpisode {
            episode
            airingAt
            timeUntilAiring
          }
        }
      }
    }
  `;

  const variables = {
    page: parseInt(page, 10) || 1,
    perPage: Math.min(Math.max(parseInt(perPage, 10) || 20, 1), 50),
    sort
  };

  if (search && search.trim()) variables.search = search.trim();
  if (season) variables.season = season.toUpperCase();
  if (seasonYear) variables.seasonYear = parseInt(seasonYear, 10);
  if (genre) variables.genre = genre;

  const data = await queryAniList(query, variables);
  const mediaList = data?.Page?.media || [];
  const pageInfo = data?.Page?.pageInfo || {};

  const result = {
    pageInfo,
    animes: mediaList.map(formatMedia)
  };

  setInCache(cacheKey, result);
  return result;
}

/**
 * Busca detalhes completos de um anime pelo ID da AniList.
 */
export async function getAnimeById(id) {
  const animeId = parseInt(id, 10);
  if (isNaN(animeId)) {
    throw new Error('ID do anime inválido.');
  }

  const cacheKey = `anime_${animeId}`;
  const cached = getFromCache(cacheKey);
  if (cached) return cached;

  const query = `
    query getAnimeDetails($id: Int) {
      Media(id: $id, type: ANIME) {
        id
        title {
          romaji
          english
          native
        }
        description
        coverImage {
          large
          extraLarge
        }
        bannerImage
        format
        episodes
        duration
        status
        season
        seasonYear
        genres
        averageScore
        popularity
        startDate {
          year
          month
          day
        }
        endDate {
          year
          month
          day
        }
        studios(isMain: true) {
          nodes {
            id
            name
          }
        }
        trailer {
          id
          site
        }
        nextAiringEpisode {
          episode
          airingAt
          timeUntilAiring
        }
      }
    }
  `;

  const data = await queryAniList(query, { id: animeId });
  if (!data?.Media) {
    return null;
  }

  const baseMedia = formatMedia(data.Media);
  const detailed = {
    ...baseMedia,
    estudio: data.Media.studios?.nodes?.[0]?.name || null,
    trailer: data.Media.trailer ? {
      id: data.Media.trailer.id,
      site: data.Media.trailer.site,
      url: data.Media.trailer.site === 'youtube' ? `https://www.youtube.com/watch?v=${data.Media.trailer.id}` : null
    } : null
  };

  setInCache(cacheKey, detailed);
  return detailed;
}

/**
 * Grade Semanal de Transmissão Simultânea (Simulcast).
 * Retorna as obras da temporada agrupadas por dia da semana (segunda a domingo).
 */
export async function getSimulcastWeekly() {
  const cacheKey = 'simulcast_weekly';
  const cached = getFromCache(cacheKey);
  if (cached) return cached;

  // Calcula o início e o fim da semana atual no fuso do servidor
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
  const startOfWeekSec = Math.floor(startOfDay.getTime() / 1000);
  const endOfWeekSec = startOfWeekSec + 7 * 86400;

  const query = `
    query getWeeklySimulcast($airingAt_greater: Int, $airingAt_lesser: Int, $page: Int) {
      Page(page: $page, perPage: 50) {
        pageInfo {
          hasNextPage
        }
        airingSchedules(airingAt_greater: $airingAt_greater, airingAt_lesser: $airingAt_lesser, sort: TIME) {
          id
          airingAt
          episode
          media {
            id
            title {
              romaji
              english
              native
            }
            description
            coverImage {
              large
              extraLarge
            }
            bannerImage
            episodes
            status
            genres
            averageScore
            popularity
          }
        }
      }
    }
  `;

  let page = 1;
  const rawSchedules = [];

  // Busca até 3 páginas (150 itens) para cobrir integralmente a semana de simulcast
  while (page <= 3) {
    const data = await queryAniList(query, {
      airingAt_greater: startOfWeekSec,
      airingAt_lesser: endOfWeekSec,
      page
    });

    const list = data?.Page?.airingSchedules || [];
    rawSchedules.push(...list);

    if (!data?.Page?.pageInfo?.hasNextPage || list.length === 0) {
      break;
    }
    page++;
  }

  // Mapeamento dos dias da semana em português
  const dayNamesPt = ['domingo', 'segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado'];
  const grouped = {
    segunda: [],
    terca: [],
    quarta: [],
    quinta: [],
    sexta: [],
    sabado: [],
    domingo: []
  };

  // Previne duplicatas de mesmo anime no mesmo dia
  const seenPerDay = new Set();

  for (const item of rawSchedules) {
    if (!item?.media) continue;

    const airDate = new Date(item.airingAt * 1000);
    const dayName = dayNamesPt[airDate.getDay()];
    const uniqueKey = `${dayName}_${item.media.id}`;

    if (seenPerDay.has(uniqueKey)) continue;
    seenPerDay.add(uniqueKey);

    const formatted = {
      schedule_id: item.id,
      anime_id: item.media.id,
      id: item.media.id,
      titulo: item.media.title?.english || item.media.title?.romaji || item.media.title?.native,
      titulo_romaji: item.media.title?.romaji,
      titulo_ingles: item.media.title?.english,
      episodio: item.episode,
      total_episodios: item.media.episodes || null,
      poster_url: item.media.coverImage?.extraLarge || item.media.coverImage?.large,
      banner_url: item.media.bannerImage,
      generos: item.media.genres || [],
      score: item.media.averageScore || 0,
      popularidade: item.media.popularity || 0,
      airing_at: item.airingAt,
      airing_time: airDate.toISOString(),
      horario_exibicao: airDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
      dia_semana: dayName
    };

    if (grouped[dayName]) {
      grouped[dayName].push(formatted);
    }
  }

  const totalWeekly = Object.values(grouped).reduce((acc, curr) => acc + curr.length, 0);

  const result = {
    success: true,
    total: totalWeekly,
    periodo: {
      inicio: new Date(startOfWeekSec * 1000).toISOString(),
      fim: new Date(endOfWeekSec * 1000).toISOString()
    },
    days: grouped
  };

  setInCache(cacheKey, result);
  return result;
}

/**
 * Lançamentos de Simulcast com episódio HOJE na data atual do servidor.
 */
export async function getSimulcastToday() {
  const cacheKey = 'simulcast_today';
  const cached = getFromCache(cacheKey);
  if (cached) return cached;

  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
  const startOfDaySec = Math.floor(startOfDay.getTime() / 1000);
  const endOfDaySec = startOfDaySec + 86400;

  const dayNamesPt = ['domingo', 'segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado'];
  const todayDayName = dayNamesPt[startOfDay.getDay()];

  const query = `
    query getTodaySimulcast($airingAt_greater: Int, $airingAt_lesser: Int) {
      Page(page: 1, perPage: 50) {
        airingSchedules(airingAt_greater: $airingAt_greater, airingAt_lesser: $airingAt_lesser, sort: TIME) {
          id
          airingAt
          episode
          media {
            id
            title {
              romaji
              english
              native
            }
            description
            coverImage {
              large
              extraLarge
            }
            bannerImage
            episodes
            status
            genres
            averageScore
            popularity
          }
        }
      }
    }
  `;

  const data = await queryAniList(query, {
    airingAt_greater: startOfDaySec,
    airingAt_lesser: endOfDaySec
  });

  const schedules = data?.Page?.airingSchedules || [];
  const episodes = schedules.map((item) => {
    const airDate = new Date(item.airingAt * 1000);
    return {
      schedule_id: item.id,
      anime_id: item.media.id,
      id: item.media.id,
      titulo: item.media.title?.english || item.media.title?.romaji || item.media.title?.native,
      titulo_romaji: item.media.title?.romaji,
      titulo_ingles: item.media.title?.english,
      episodio: item.episode,
      total_episodios: item.media.episodes || null,
      poster_url: item.media.coverImage?.extraLarge || item.media.coverImage?.large,
      banner_url: item.media.bannerImage,
      generos: item.media.genres || [],
      score: item.media.averageScore || 0,
      airing_at: item.airingAt,
      airing_time: airDate.toISOString(),
      horario_exibicao: airDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
      dia_semana: todayDayName
    };
  });

  const result = {
    success: true,
    total: episodes.length,
    date: startOfDay.toISOString().split('T')[0],
    day_of_week: todayDayName,
    episodes
  };

  setInCache(cacheKey, result);
  return result;
}

export { ANILIST_CLIENT_ID, ANILIST_CLIENT_SECRET };
