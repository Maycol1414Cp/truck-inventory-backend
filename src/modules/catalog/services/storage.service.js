import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../../../../');
const uploadsDir = path.join(rootDir, 'uploads');
const originalDir = path.join(uploadsDir, 'original');
const thumbsDir = path.join(uploadsDir, 'thumbs');

export class StorageService {
  /**
   * Guarda los buffers procesados en disco local y devuelve las URLs relativas
   */
  static async saveProcessedImages(filename, originalBuffer, thumbnailBuffer) {
    await fs.mkdir(originalDir, { recursive: true });
    await fs.mkdir(thumbsDir, { recursive: true });

    const originalPath = path.join(originalDir, filename);
    const thumbPath = path.join(thumbsDir, filename);

    await Promise.all([
      fs.writeFile(originalPath, originalBuffer),
      fs.writeFile(thumbPath, thumbnailBuffer)
    ]);

    return {
      imageUrl: `/uploads/original/${filename}`,
      thumbnailUrl: `/uploads/thumbs/${filename}`,
      filename
    };
  }

  /**
   * Elimina las imágenes asociadas del disco
   */
  static async deleteImageFiles(imageUrl, thumbnailUrl) {
    try {
      if (imageUrl) {
        const fullOrigPath = path.join(rootDir, imageUrl);
        await fs.unlink(fullOrigPath).catch(() => {});
      }
      if (thumbnailUrl) {
        const fullThumbPath = path.join(rootDir, thumbnailUrl);
        await fs.unlink(fullThumbPath).catch(() => {});
      }
    } catch (error) {
      console.warn('⚠️ [STORAGE WARNING]: No se pudo borrar archivo físico:', error.message);
    }
  }
}
