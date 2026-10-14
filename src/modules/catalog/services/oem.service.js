import { oemRepository } from '../repositories/oem.repository.js';
import { cleanOemCode } from '../../../common/utils/stringSanitizer.js';
import { AppError } from '../../../common/errors/AppError.js';

export const oemService = {
  async getOemsByItem(idItem) {
    return await oemRepository.findByItemId(idItem);
  },

  async addOemToItem(idItem, oemData) {
    if (!oemData.oemCode || !oemData.oemCode.trim()) {
      throw new AppError('El código OEM es obligatorio.', 422, 'VALIDATION_FAILED', [
        { field: 'oemCode', message: 'No puede estar vacío.' }
      ]);
    }

    const sanitizedClean = cleanOemCode(oemData.oemCode);
    const existing = await oemRepository.findDuplicate(idItem, sanitizedClean);
    if (existing) {
      throw new AppError(
        `El código OEM '${oemData.oemCode}' ya se encuentra registrado para este repuesto.`,
        409,
        'OEM_CODE_DUPLICATED'
      );
    }

    if (oemData.isMain) {
      await oemRepository.resetMainFlags(idItem);
    }

    return await oemRepository.create({
      idItem,
      oemCode: oemData.oemCode.trim(),
      cleanOemCode: sanitizedClean,
      brandOrigin: oemData.brandOrigin ? oemData.brandOrigin.trim() : null,
      oemType: oemData.oemType || 'ORIGINAL',
      isMain: Boolean(oemData.isMain)
    });
  },

  async removeOem(idItemOem) {
    const oem = await oemRepository.findById(idItemOem);
    if (!oem) {
      throw new AppError(`Código OEM con ID ${idItemOem} no encontrado.`, 404, 'OEM_NOT_FOUND');
    }
    await oemRepository.delete(idItemOem);
    return { idItemOem, message: 'Código OEM eliminado exitosamente.' };
  }
};
