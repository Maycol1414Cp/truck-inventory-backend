import { itemRepository } from '../repositories/item.repository.js';
import { brandRepository } from '../repositories/brand.repository.js';
import { oemRepository } from '../repositories/oem.repository.js';
import { ImageProcessorService } from './imageProcessor.service.js';
import { StorageService } from './storage.service.js';
import { cleanOemCode } from '../../../common/utils/stringSanitizer.js';
import { withTransaction } from '../../../common/utils/transactionHelper.js';
import { AppError } from '../../../common/errors/AppError.js';

export const itemService = {
  async getAllItems(queryParams = {}) {
    const page = Math.max(1, parseInt(queryParams.page || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(queryParams.limit || '20', 10)));
    const brandId = queryParams.brandId ? parseInt(queryParams.brandId, 10) : null;
    const isActive = queryParams.isActive !== undefined ? queryParams.isActive === 'true' : true;

    return await itemRepository.findAll({ page, limit, brandId, isActive });
  },

  async getItemById(idItem) {
    const item = await itemRepository.findById(idItem);
    if (!item) {
      throw new AppError(`Repuesto con ID ${idItem} no encontrado.`, 404, 'ITEM_NOT_FOUND');
    }
    return item;
  },

  async createItem(itemData) {
    if (!itemData.itemName || !itemData.itemName.trim()) {
      throw new AppError('El nombre del repuesto es obligatorio.', 422, 'VALIDATION_FAILED', [
        { field: 'itemName', message: 'No puede estar vacío.' }
      ]);
    }
    if (!itemData.idBrand) {
      throw new AppError('La marca fabricante (idBrand) es obligatoria.', 422, 'VALIDATION_FAILED', [
        { field: 'idBrand', message: 'Debe seleccionar una marca válida.' }
      ]);
    }

    const brand = await brandRepository.findById(itemData.idBrand);
    if (!brand) {
      throw new AppError(`La marca con ID ${itemData.idBrand} no existe.`, 404, 'BRAND_NOT_FOUND');
    }

    if (itemData.sku && itemData.sku.trim()) {
      const existingSku = await itemRepository.findBySku(itemData.sku.trim());
      if (existingSku) {
        throw new AppError(`El SKU '${itemData.sku}' ya está registrado.`, 409, 'SKU_ALREADY_EXISTS');
      }
    }

    return await withTransaction(async (client) => {
      const newItem = await itemRepository.create({
        itemName: itemData.itemName.trim(),
        itemDescription: itemData.itemDescription ? itemData.itemDescription.trim() : '',
        idBrand: itemData.idBrand,
        sku: itemData.sku ? itemData.sku.trim().toUpperCase() : null,
        cost: itemData.cost !== undefined ? parseFloat(itemData.cost) : 0,
        price: itemData.price !== undefined ? parseFloat(itemData.price) : 0,
        isActive: itemData.isActive !== undefined ? Boolean(itemData.isActive) : true
      }, client);

      // Si se envían códigos OEM iniciales en la creación
      if (Array.isArray(itemData.oems) && itemData.oems.length > 0) {
        for (const o of itemData.oems) {
          if (o.oemCode) {
            await oemRepository.create({
              idItem: newItem.idItem,
              oemCode: o.oemCode.trim(),
              cleanOemCode: cleanOemCode(o.oemCode),
              brandOrigin: o.brandOrigin ? o.brandOrigin.trim() : null,
              oemType: o.oemType || 'ORIGINAL',
              isMain: Boolean(o.isMain)
            }, client);
          }
        }
      }

      return await itemRepository.findById(newItem.idItem, client);
    });
  },

  async updateItem(idItem, itemData) {
    const item = await itemRepository.findById(idItem);
    if (!item) {
      throw new AppError(`Repuesto con ID ${idItem} no encontrado.`, 404, 'ITEM_NOT_FOUND');
    }

    if (itemData.idBrand) {
      const brand = await brandRepository.findById(itemData.idBrand);
      if (!brand) {
        throw new AppError(`La marca con ID ${itemData.idBrand} no existe.`, 404, 'BRAND_NOT_FOUND');
      }
    }

    if (itemData.sku && itemData.sku.trim() !== item.sku) {
      const existingSku = await itemRepository.findBySku(itemData.sku.trim());
      if (existingSku && existingSku.id_item !== idItem) {
        throw new AppError(`El SKU '${itemData.sku}' ya está en uso por otro repuesto.`, 409, 'SKU_ALREADY_EXISTS');
      }
    }

    const payload = {};
    if (itemData.itemName !== undefined) payload.itemName = itemData.itemName.trim();
    if (itemData.itemDescription !== undefined) payload.itemDescription = itemData.itemDescription.trim();
    if (itemData.idBrand !== undefined) payload.idBrand = itemData.idBrand;
    if (itemData.sku !== undefined) payload.sku = itemData.sku.trim().toUpperCase();
    if (itemData.cost !== undefined) payload.cost = parseFloat(itemData.cost);
    if (itemData.price !== undefined) payload.price = parseFloat(itemData.price);
    if (itemData.isActive !== undefined) payload.isActive = Boolean(itemData.isActive);

    await itemRepository.update(idItem, payload);
    return await itemRepository.findById(idItem);
  },

  async uploadItemImages(idItem, files = []) {
    const item = await itemRepository.findById(idItem);
    if (!item) {
      throw new AppError(`Repuesto con ID ${idItem} no encontrado.`, 404, 'ITEM_NOT_FOUND');
    }

    if (!files || files.length === 0) {
      throw new AppError('Debe enviar al menos un archivo de imagen en el campo "images".', 400, 'NO_FILES_UPLOADED');
    }

    const savedImages = [];
    let orderIndex = item.images.length;

    for (const file of files) {
      // 1. Procesar con Sharp (generar WebP original y thumbnail)
      const { filename, originalBuffer, thumbnailBuffer } = await ImageProcessorService.processPartImage(file.buffer);

      // 2. Guardar en disco local
      const { imageUrl, thumbnailUrl } = await StorageService.saveProcessedImages(filename, originalBuffer, thumbnailBuffer);

      // 3. Registrar en base de datos (la primera es principal si no hay ninguna previa)
      const isPrimary = item.images.length === 0 && savedImages.length === 0;

      const record = await itemRepository.addImage({
        idItem,
        imageUrl,
        thumbnailUrl,
        isPrimary,
        displayOrder: ++orderIndex
      });

      savedImages.push(record);
    }

    return await itemRepository.findById(idItem);
  },

  async deleteItemImage(idItem, idImage) {
    const item = await itemRepository.findById(idItem);
    if (!item) {
      throw new AppError(`Repuesto con ID ${idItem} no encontrado.`, 404, 'ITEM_NOT_FOUND');
    }

    const img = await itemRepository.findImageById(idImage);
    if (!img || img.id_item !== idItem) {
      throw new AppError(`Imagen con ID ${idImage} no pertenece a este repuesto.`, 404, 'IMAGE_NOT_FOUND');
    }

    // Borrar archivos físicos
    await StorageService.deleteImageFiles(img.image_url, img.thumbnail_url);

    // Borrar registro DB
    await itemRepository.removeImage(idImage);

    // Si se borró la principal, marcar la siguiente como principal
    if (img.is_primary) {
      const remaining = await itemRepository.findById(idItem);
      if (remaining && remaining.images && remaining.images.length > 0) {
        await itemRepository.resetPrimaryImages(idItem);
        const firstRemainingId = remaining.images[0].idImage;
        await pool.query('UPDATE item_image SET is_primary = TRUE WHERE id_image = $1;', [firstRemainingId]);
      }
    }

    return { idImage, message: 'Imagen eliminada exitosamente.' };
  },

  async searchItems(queryText, limit = 20) {
    if (!queryText || !queryText.trim()) {
      return [];
    }

    const trimmed = queryText.trim();
    const cleanCode = cleanOemCode(trimmed);

    return await itemRepository.searchAdvanced(trimmed, cleanCode, { limit });
  }
};
