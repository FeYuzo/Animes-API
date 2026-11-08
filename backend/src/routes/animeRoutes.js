import { Router } from 'express';
import {
  listAnimes,
  getAnimeDetails,
  listWatched,
  addWatched,
  updateWatched,
  removeWatched,
  listPlanToWatch,
  addPlanToWatch,
  removePlanToWatch,
  listFavorites,
  addFavorite,
  removeFavorite,
  togglePinFavorite,
  listSimulcastWeekly,
  listSimulcastToday
} from '../controllers/animeController.js';
import { listMovieComments, addComment } from '../controllers/commentController.js';
import { authenticate, optionalAuthenticate } from '../middleware/auth.js';

const router = Router();

// ============================================================================
// 1. R4: Simulcast da Temporada
// ============================================================================
router.get('/simulcast', optionalAuthenticate, listSimulcastWeekly);
router.get('/simulcast/hoje', optionalAuthenticate, listSimulcastToday);

// ============================================================================
// 2. R1: Animes Assistidos
// ============================================================================
router.get('/assistidos', authenticate, listWatched);
router.post('/assistidos', authenticate, addWatched);
router.patch('/assistidos/:id', authenticate, updateWatched);
router.delete('/assistidos/:id', authenticate, removeWatched);

// ============================================================================
// 3. R2: Animes que Irá Ver (Watchlist / Plan to Watch)
// ============================================================================
router.get('/ira-ver', authenticate, listPlanToWatch);
router.post('/ira-ver', authenticate, addPlanToWatch);
router.delete('/ira-ver/:id', authenticate, removePlanToWatch);

// ============================================================================
// 4. R3: Animes Favoritos
// ============================================================================
router.get('/favoritos', authenticate, listFavorites);
router.post('/favoritos', authenticate, addFavorite);
router.delete('/favoritos/:id', authenticate, removeFavorite);
router.patch('/favoritos/:id/pin', authenticate, togglePinFavorite);

// ============================================================================
// 5. Comentários Comunitários por Anime (/api/animes/:anime_id/comments)
// ============================================================================
router.get('/:anime_id/comments', optionalAuthenticate, listMovieComments);
router.post('/:anime_id/comments', authenticate, addComment);

// ============================================================================
// 6. Catálogo Geral & Detalhes na AniList
// ============================================================================
router.get('/', optionalAuthenticate, listAnimes);
router.get('/:id', optionalAuthenticate, getAnimeDetails);

export default router;
