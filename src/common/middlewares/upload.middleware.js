import multer from 'multer';
import { AppError } from '../errors/AppError.js';

const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp'];

  if (allowedMimeTypes.includes(file.mimetype)) {
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
