import multer from 'multer';
import { AppError } from '../errors/AppError.js';

const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  const allowedMimeTypes = [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/webp',
    'image/heic',
    'image/heif',
  ];
  const ext = (file.originalname || '').toLowerCase();
  const hasValidExt =
    ext.endsWith('.jpg') ||
    ext.endsWith('.jpeg') ||
    ext.endsWith('.png') ||
    ext.endsWith('.webp') ||
    ext.endsWith('.heic');

  if (
    allowedMimeTypes.includes(file.mimetype) ||
    (file.mimetype === 'application/octet-stream' && hasValidExt)
  ) {
    cb(null, true);
  } else {
    cb(
      new AppError(
        'Formato de archivo no soportado. Se permiten únicamente imágenes JPG, PNG o WebP.',
        422,
        'INVALID_IMAGE_FORMAT'
      ),
      false
    );
  }
};

export const uploadItemImages = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB máx por archivo
    files: 5,                   // Hasta 5 imágenes simultáneas
  },
  fileFilter,
}).array('images', 5);
