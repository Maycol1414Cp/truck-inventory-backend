import { brandRepository } from '../repositories/brand.repository.js';
import { AppError } from '../../../common/errors/AppError.js';

export const brandService = {
  async getAllBrands() {
    return await brandRepository.findAll();
  },

  async getBrandById(idBrand) {
    const brand = await brandRepository.findById(idBrand);
    if (!brand) {
      throw new AppError(`Marca con ID ${idBrand} no encontrada.`, 404, 'BRAND_NOT_FOUND');
    }
    return brand;
  },

  async createBrand(brandData) {
    if (!brandData.brandName || !brandData.brandName.trim()) {
      throw new AppError('El nombre de la marca es obligatorio.', 422, 'VALIDATION_FAILED', [
        { field: 'brandName', message: 'No puede estar vacío.' }
      ]);
    }

    const existing = await brandRepository.findByName(brandData.brandName.trim());
    if (existing) {
      throw new AppError(`La marca '${brandData.brandName}' ya existe.`, 409, 'BRAND_ALREADY_EXISTS');
    }

    return await brandRepository.create({
      brandName: brandData.brandName.trim(),
      country: brandData.country ? brandData.country.trim() : null,
      logoUrl: brandData.logoUrl ? brandData.logoUrl.trim() : null
    });
  }
};
