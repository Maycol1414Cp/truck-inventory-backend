import sharp from 'sharp';
import { v4 as uuidv4 } from 'uuid';

export class ImageProcessorService {
  /**
   * Procesa un buffer de imagen y genera simultáneamente dos versiones en formato WebP:
   * 1. Original optimizada para web (max ancho 1200px).
   * 2. Thumbnail cuadrado para interfaz POS y catálogos rápidos (300x300px).
   * 
   * @param {Buffer} fileBuffer - Buffer en memoria de la imagen.
   * @returns {Promise<{ filename: string, originalBuffer: Buffer, thumbnailBuffer: Buffer }>}
   */
  static async processPartImage(fileBuffer) {
    const filename = `${uuidv4()}.webp`;

    // 1. Imagen principal optimizada para web
    const originalBuffer = await sharp(fileBuffer)
      .resize({ width: 1200, withoutEnlargement: true })
      .webp({ quality: 82 })
      .toBuffer();

    // 2. Thumbnail rápido para tarjetas POS (300x300)
    const thumbnailBuffer = await sharp(fileBuffer)
      .resize(300, 300, {
        fit: 'contain',
        background: { r: 255, g: 255, b: 255, alpha: 0 }
      })
      .webp({ quality: 80 })
      .toBuffer();

    return {
      filename,
      originalBuffer,
      thumbnailBuffer
    };
  }
}
