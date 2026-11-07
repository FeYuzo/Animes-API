import { getAnimeCatalog } from './anilistService.js';

/**
 * Módulo de compatibilidade com versões legadas do serviço de catálogo.
 * Redireciona chamadas legadas para a API AniList.
 */
export async function getTomHanksMovies(forceRefresh = false) {
  const result = await getAnimeCatalog({ page: 1, perPage: 50 });
  return result.animes || [];
}

export async function getTomHanksPersonId() {
  return 1;
}

export default {
  getTomHanksMovies,
  getTomHanksPersonId
};
