import { inventoryRepository } from '../repositories/inventory.repository.js';
import { branchRepository } from '../repositories/branch.repository.js';
import { itemRepository } from '../../catalog/repositories/item.repository.js';
import { AppError } from '../../../common/errors/AppError.js';

export const inventoryService = {
  async getStockByBranch(idSucursal, queryParams = {}) {
    const branch = await branchRepository.findById(idSucursal);
    if (!branch) {
      throw new AppError(`Sucursal con ID ${idSucursal} no encontrada.`, 404, 'BRANCH_NOT_FOUND');
    }

    const tipoAlmacen = queryParams.tipoAlmacen ? queryParams.tipoAlmacen.trim().toUpperCase() : null;
    if (tipoAlmacen && !['TIENDA', 'DEPOSITO'].includes(tipoAlmacen)) {
      throw new AppError('El tipo de almacén debe ser TIENDA o DEPOSITO.', 422, 'INVALID_WAREHOUSE_TYPE');
    }

    const page = Math.max(1, parseInt(queryParams.page || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(queryParams.limit || '50', 10)));
    const search = queryParams.search ? queryParams.search.trim() : null;

    return await inventoryRepository.findByBranch(idSucursal, {
      tipoAlmacen,
      search,
      page,
      limit
    });
  },

  async updateItemLocation(idSucursal, idItem, locationData) {
    const branch = await branchRepository.findById(idSucursal);
    if (!branch) {
      throw new AppError(`Sucursal con ID ${idSucursal} no encontrada.`, 404, 'BRANCH_NOT_FOUND');
    }

    const item = await itemRepository.findById(idItem);
    if (!item) {
      throw new AppError(`Repuesto con ID ${idItem} no encontrado.`, 404, 'ITEM_NOT_FOUND');
    }

    const tipoAlmacen = locationData.tipoAlmacen ? locationData.tipoAlmacen.trim().toUpperCase() : 'TIENDA';
    if (!['TIENDA', 'DEPOSITO'].includes(tipoAlmacen)) {
      throw new AppError('El tipo de almacén debe ser TIENDA o DEPOSITO.', 422, 'INVALID_WAREHOUSE_TYPE');
    }

    const existingStock = await inventoryRepository.findByItemAndWarehouseType(idItem, idSucursal, tipoAlmacen);

    if (existingStock) {
      return await inventoryRepository.updateLocation(existingStock.idInventario, {
        pasillo: locationData.pasillo,
        estante: locationData.estante,
        seccion: locationData.seccion
      });
    }

    // Si no existía la ranura, se inicializa con stock 0 y las coordenadas indicadas
    return await inventoryRepository.upsertStock({
      idItem,
      idSucursal,
      tipoAlmacen,
      pasillo: locationData.pasillo,
      estante: locationData.estante,
      seccion: locationData.seccion,
      cantidad: 0,
      stockMinimo: tipoAlmacen === 'TIENDA' ? 1 : 0
    });
  },

  async assignStock(stockPayload) {
    const { idItem, idSucursal, tipoAlmacen = 'TIENDA', cantidad, stockMinimo, stockMaximo, pasillo, estante, seccion } = stockPayload;

    if (!idItem || !idSucursal) {
      throw new AppError('idItem e idSucursal son obligatorios.', 422, 'VALIDATION_FAILED');
    }

    const upperTipo = tipoAlmacen.trim().toUpperCase();
    if (!['TIENDA', 'DEPOSITO'].includes(upperTipo)) {
      throw new AppError('El tipo de almacén debe ser TIENDA o DEPOSITO.', 422, 'INVALID_WAREHOUSE_TYPE');
    }

    if (cantidad !== undefined && cantidad < 0) {
      throw new AppError('La cantidad no puede ser negativa.', 422, 'VALIDATION_FAILED', [
        { field: 'cantidad', message: 'Debe ser >= 0.' }
      ]);
    }

    const branch = await branchRepository.findById(idSucursal);
    if (!branch) {
      throw new AppError(`Sucursal con ID ${idSucursal} no encontrada.`, 404, 'BRANCH_NOT_FOUND');
    }

    const item = await itemRepository.findById(idItem);
    if (!item) {
      throw new AppError(`Repuesto con ID ${idItem} no encontrado.`, 404, 'ITEM_NOT_FOUND');
    }

    return await inventoryRepository.upsertStock({
      idItem,
      idSucursal,
      tipoAlmacen: upperTipo,
      pasillo,
      estante,
      seccion,
      cantidad: cantidad !== undefined ? cantidad : 0,
      stockMinimo: stockMinimo !== undefined ? stockMinimo : 0,
      stockMaximo
    });
  }
};
