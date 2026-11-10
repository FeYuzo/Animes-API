import { Router } from 'express';
import multer from 'multer';
import { MAX_FILE_SIZE } from '../utils/fileValidation.js';
import {
  listAnimes,
  getAnimeDetails,
  createAnime,
  updateAnime,
  deleteAnime,
  uploadAnimeCover,
  listWatched,
  addWatched,
  updateWatched,
  removeWatched,
  getWatchedDetails,
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
import { listAnimeComments, addComment } from '../controllers/commentController.js';
import { authenticate, optionalAuthenticate } from '../middleware/auth.js';

const router = Router();

// Configuração do upload de capas via Multer em memória
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE }
});

function handleCoverUpload(req, res, next) {
  upload.single('cover')(req, res, (err) => {
    if (err) return res.status(400).json({ error: `Erro no upload da capa: ${err.message}` });
    next();
  });
}

// ============================================================================
// 1. R4: Simulcast da Temporada
// ============================================================================
router.get('/simulcast', optionalAuthenticate, listSimulcastWeekly);
router.get('/simulcast/hoje', optionalAuthenticate, listSimulcastToday);

// ============================================================================
// 2. R1: Animes Assistidos
// ============================================================================
router.get('/assistidos', authenticate, listWatched);
router.get('/assistidos/:id', authenticate, getWatchedDetails);
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
router.get('/:anime_id/comments', optionalAuthenticate, listAnimeComments);
router.post('/:anime_id/comments', authenticate, addComment);

// ============================================================================
// 6. CRUD Completo de Animes do Negócio & Upload MinIO
// ============================================================================
router.get('/', optionalAuthenticate, listAnimes);
router.get('/:id', optionalAuthenticate, getAnimeDetails);
router.post('/', authenticate, createAnime);
router.put('/:id', authenticate, updateAnime);
router.delete('/:id', authenticate, deleteAnime);
router.post('/:id/cover', authenticate, handleCoverUpload, uploadAnimeCover);

export default router;
