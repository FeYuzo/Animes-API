import { Router } from 'express';
import { listFavorites, addFavorite, removeFavorite, togglePinFavorite } from '../controllers/favoriteController.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

router.use(authenticate);

router.get('/', listFavorites);
router.post('/', addFavorite);
router.delete('/:id', removeFavorite);
router.delete('/:tmdb_movie_id', removeFavorite);
router.patch('/:id/pin', togglePinFavorite);

export default router;
