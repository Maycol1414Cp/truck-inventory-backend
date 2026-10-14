import { branchRepository } from '../repositories/branch.repository.js';
import { AppError } from '../../../common/errors/AppError.js';

export const branchService = {
  async getAllBranches(options = {}) {
    return await branchRepository.findAll(options);
  },

  async getBranchById(idSucursal) {
    const branch = await branchRepository.findById(idSucursal);
    if (!branch) {
      throw new AppError(`Sucursal con ID ${idSucursal} no encontrada.`, 404, 'BRANCH_NOT_FOUND');
    }
    return branch;
  },

  async createBranch(branchData) {
    if (!branchData.code || !branchData.code.trim()) {
      throw new AppError('El código de la sucursal es obligatorio.', 422, 'VALIDATION_FAILED', [
        { field: 'code', message: 'No puede estar vacío.' }
      ]);
    }

    if (!branchData.name || !branchData.name.trim()) {
      throw new AppError('El nombre de la sucursal es obligatorio.', 422, 'VALIDATION_FAILED', [
        { field: 'name', message: 'No puede estar vacío.' }
      ]);
    }

    if (!branchData.address || !branchData.address.trim()) {
      throw new AppError('La dirección de la sucursal es obligatoria.', 422, 'VALIDATION_FAILED', [
        { field: 'address', message: 'No puede estar vacía.' }
      ]);
    }

    const existingCode = await branchRepository.findByCode(branchData.code.trim());
    if (existingCode) {
      throw new AppError(`El código de sucursal '${branchData.code}' ya existe.`, 409, 'BRANCH_CODE_ALREADY_EXISTS');
    }

    return await branchRepository.create({
      code: branchData.code.trim().toUpperCase(),
      name: branchData.name.trim(),
      address: branchData.address.trim(),
      phone: branchData.phone ? branchData.phone.trim() : null,
      isMainHub: Boolean(branchData.isMainHub),
      isActive: branchData.isActive !== undefined ? Boolean(branchData.isActive) : true
    });
  }
};
