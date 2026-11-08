import { Router } from 'express';
import multer from 'multer';
import {
  getProfile,
  updateProfile,
  uploadProfilePhoto,
  getProfilePhoto,
  uploadProfileBanner,
  getProfileBanner,
  deleteProfileBanner,
  exportUserData
} from '../controllers/profileController.js';
import { authenticate } from '../middleware/auth.js';
import { MAX_FILE_SIZE } from '../utils/fileValidation.js';

const router = Router();

// Configuração do Multer com armazenamento em memória (MemoryStorage)
// O buffer fica em RAM temporariamente para inspeção por Magic Bytes e envio ao MinIO,
// sem poluir o disco com arquivos temporários órfãos.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_FILE_SIZE // 5 MB
  }
});

// Middleware auxiliar para capturar erros do Multer (ex: arquivo maior que o limite)
function handleUploadMiddleware(req, res, next) {
  upload.single('foto')(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({
          error: `O arquivo excede o limite máximo permitido de ${MAX_FILE_SIZE / (1024 * 1024)}MB.`
        });
      }
      return res.status(400).json({ error: `Erro no upload: ${err.message}` });
    } else if (err) {
      return res.status(400).json({ error: `Erro no upload: ${err.message}` });
    }
    next();
  });
}

function handleBannerUploadMiddleware(req, res, next) {
  upload.single('banner')(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({
          error: `O arquivo do banner excede o limite máximo permitido de ${MAX_FILE_SIZE / (1024 * 1024)}MB.`
        });
      }
      return res.status(400).json({ error: `Erro no upload do banner: ${err.message}` });
    } else if (err) {
      return res.status(400).json({ error: `Erro no upload do banner: ${err.message}` });
    }
    next();
  });
}

// 1. Rotas públicas de exibição de foto e banner via streaming
router.get('/photo/{*key}', getProfilePhoto);
router.get('/banner/{*key}', getProfileBanner);

// 2. Exportação da biblioteca em JSON (Recurso exclusivo Otaku Pro)
router.get('/export', authenticate, exportUserData);

// 3. Consulta de perfil (autenticado)
router.get('/me', authenticate, getProfile);
router.get('/:id', authenticate, getProfile);

// 4. Edição de dados do perfil (nome, bio) - Protegido com IDOR check
router.put('/', authenticate, updateProfile);
router.put('/:id', authenticate, updateProfile);

// 5. Upload de foto de perfil - Protegido com IDOR check
router.post('/photo', authenticate, handleUploadMiddleware, uploadProfilePhoto);
router.post('/:id/photo', authenticate, handleUploadMiddleware, uploadProfilePhoto);

// 6. Upload e Gerenciamento de Banner de Perfil (Otaku Pro)
router.post('/banner', authenticate, handleBannerUploadMiddleware, uploadProfileBanner);
router.post('/:id/banner', authenticate, handleBannerUploadMiddleware, uploadProfileBanner);
router.delete('/banner', authenticate, deleteProfileBanner);

export default router;
