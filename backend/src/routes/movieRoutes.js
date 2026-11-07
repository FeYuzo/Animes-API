import { Router } from 'express';
import { listMovies, getMovieById } from '../controllers/movieController.js';
import { optionalAuthenticate } from '../middleware/auth.js';

const router = Router();

// Rota de retrocompatibilidade com o catálogo antigo
router.get('/', optionalAuthenticate, listMovies);
router.get('/:id', optionalAuthenticate, getMovieById);

export default router;
