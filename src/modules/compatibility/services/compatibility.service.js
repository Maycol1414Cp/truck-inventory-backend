import { compatibilityRepository } from '../repositories/compatibility.repository.js';
import { truckRepository } from '../repositories/truck.repository.js';
import { itemRepository } from '../../catalog/repositories/item.repository.js';
import { toTruckDTO } from '../mappers/truck.mapper.js';
import {
  toCompatibilityDTO,
  toCompatibleItemListDTO,
  toCompatibleTruckListDTO
} from '../mappers/compatibility.mapper.js';
import { AppError } from '../../../common/errors/AppError.js';

export const compatibilityService = {
  /**
   * Vincula un repuesto a un camión con una nota de montaje / posición opcional.
   */
  async linkItemToTruck({ idItem, idTruck, positionNote }) {
    const itemId = parseInt(idItem, 10);
    const truckId = parseInt(idTruck, 10);

    if (isNaN(itemId) || itemId <= 0) {
      throw new AppError('El ID del repuesto (idItem) debe ser un entero positivo válido.', 400, 'INVALID_ITEM_ID');
    }

    if (isNaN(truckId) || truckId <= 0) {
      throw new AppError('El ID del camión (idTruck) debe ser un entero positivo válido.', 400, 'INVALID_TRUCK_ID');
    }

    // Validar existencia del repuesto
    const item = await itemRepository.findById(itemId);
    if (!item) {
      throw new AppError(`El repuesto con ID ${itemId} no existe en el catálogo.`, 404, 'ITEM_NOT_FOUND');
    }

    // Validar existencia del camión
    const truck = await truckRepository.findById(truckId);
    if (!truck) {
      throw new AppError(`El camión con ID ${truckId} no existe en el catálogo de vehículos.`, 404, 'TRUCK_NOT_FOUND');
    }

    const linked = await compatibilityRepository.linkItemToTruck(itemId, truckId, positionNote);
    return {
      ...toCompatibilityDTO(linked),
      itemName: item.item_name,
      truckBrand: truck.truck_brand,
      truckModel: truck.truck_model
    };
  },

  /**
   * Desvincula un repuesto de un modelo de camión.
   */
  async unlinkItemFromTruck(idItem, idTruck) {
    const itemId = parseInt(idItem, 10);
    const truckId = parseInt(idTruck, 10);

    if (isNaN(itemId) || itemId <= 0 || isNaN(truckId) || truckId <= 0) {
      throw new AppError('Los IDs de ítem y camión deben ser enteros válidos.', 400, 'INVALID_IDENTIFIERS');
    }

    const unlinked = await compatibilityRepository.unlinkItemFromTruck(itemId, truckId);
    if (!unlinked) {
      throw new AppError(`No existe relación de compatibilidad entre el ítem ${itemId} y el camión ${truckId}.`, 404, 'COMPATIBILITY_NOT_FOUND');
    }

    return {
      idItem: itemId,
      idTruck: truckId,
      unlinked: true,
      message: 'La compatibilidad fue removida exitosamente.'
    };
  },

  /**
   * BÚSQUEDA INVERSA: Obtiene todos los repuestos compatibles con un camión dado.
   */
  async getItemsByTruck(idTruck, queryParams = {}) {
    const truckId = parseInt(idTruck, 10);
    if (isNaN(truckId) || truckId <= 0) {
      throw new AppError('El ID del camión debe ser un entero positivo.', 400, 'INVALID_TRUCK_ID');
    }

    const truck = await truckRepository.findById(truckId);
    if (!truck) {
      throw new AppError(`Camión con ID ${truckId} no encontrado.`, 404, 'TRUCK_NOT_FOUND');
    }

    const { rows, meta } = await compatibilityRepository.findItemsByTruck(truckId, queryParams);

    return {
      truck: toTruckDTO(truck),
      items: toCompatibleItemListDTO(rows),
      meta
    };
  },

  /**
   * Obtiene todos los camiones compatibles con un repuesto dado.
   */
  async getTrucksByItem(idItem) {
    const itemId = parseInt(idItem, 10);
    if (isNaN(itemId) || itemId <= 0) {
      throw new AppError('El ID del repuesto debe ser un entero positivo.', 400, 'INVALID_ITEM_ID');
    }

    const item = await itemRepository.findById(itemId);
    if (!item) {
      throw new AppError(`Repuesto con ID ${itemId} no encontrado.`, 404, 'ITEM_NOT_FOUND');
    }

    const rows = await compatibilityRepository.findTrucksByItem(itemId);

    return {
      idItem: itemId,
      itemName: item.item_name,
      sku: item.sku,
      trucks: toCompatibleTruckListDTO(rows)
    };
  }
};
