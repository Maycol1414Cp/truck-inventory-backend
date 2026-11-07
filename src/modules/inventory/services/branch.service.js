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

    let finalCode = branchData.code && branchData.code.trim()
      ? branchData.code.trim().toUpperCase()
      : null;

    const allBranches = await branchRepository.findAll({ includeInactive: true });

    if (!finalCode) {
      let maxNum = allBranches.length;
      for (const b of allBranches) {
        const match = String(b.code || '').match(/(\d+)/);
        if (match) {
          const num = parseInt(match[1], 10);
          if (!isNaN(num) && num > maxNum) {
            maxNum = num;
          }
        }
        if (b.idSucursal && b.idSucursal > maxNum) {
          maxNum = b.idSucursal;
        }
      }
      finalCode = `SUC-${String(maxNum + 1).padStart(2, '0')}`;
    }

    let existingCode = await branchRepository.findByCode(finalCode);
    let attempt = 1;
    while (existingCode) {
      const nextNum = allBranches.length + attempt + 1;
      finalCode = `SUC-${String(nextNum).padStart(2, '0')}`;
      existingCode = await branchRepository.findByCode(finalCode);
      attempt++;
    }

    return await branchRepository.create({
      code: finalCode,
      name: branchData.name.trim(),
      address: branchData.address.trim(),
      phone: branchData.phone ? branchData.phone.trim() : null,
      isMainHub: Boolean(branchData.isMainHub),
      isActive: branchData.isActive !== undefined ? Boolean(branchData.isActive) : true
    });
  }
};
