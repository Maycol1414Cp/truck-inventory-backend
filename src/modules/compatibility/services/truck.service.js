import { truckRepository } from '../repositories/truck.repository.js';
import { toTruckDTO, toTruckListDTO } from '../mappers/truck.mapper.js';
import { AppError } from '../../../common/errors/AppError.js';

export const truckService = {
  /**
   * Obtiene listado de camiones con paginación y filtros.
   */
  async getTrucks(queryParams = {}) {
    const { rows, meta } = await truckRepository.findAll(queryParams);
    return {
      trucks: toTruckListDTO(rows),
      meta
    };
  },

  /**
   * Obtiene detalle de un camión por ID.
   */
  async getTruckById(idTruck) {
    const id = parseInt(idTruck, 10);
    if (isNaN(id) || id <= 0) {
      throw new AppError('El ID del camión debe ser un entero positivo válido.', 400, 'INVALID_TRUCK_ID');
    }

    const truck = await truckRepository.findById(id);
    if (!truck) {
      throw new AppError(`Camión con ID ${id} no encontrado en el sistema.`, 404, 'TRUCK_NOT_FOUND');
    }

    return toTruckDTO(truck);
  },

  /**
   * Registra un nuevo modelo de camión y su motorización.
   */
  async createTruck(data) {
    const { truckBrand, truckModel, engineModel, firstYear, lastYear, notes } = data;

    if (!truckBrand || typeof truckBrand !== 'string' || truckBrand.trim() === '') {
      throw new AppError('La marca del camión es obligatoria (ej: Kenworth, Freightliner).', 400, 'INVALID_TRUCK_BRAND');
    }

    if (!truckModel || typeof truckModel !== 'string' || truckModel.trim() === '') {
      throw new AppError('El modelo del camión es obligatorio (ej: T680, Cascadia).', 400, 'INVALID_TRUCK_MODEL');
    }

    const firstYearNum = parseInt(firstYear, 10);
    if (isNaN(firstYearNum) || firstYearNum < 1950 || firstYearNum > new Date().getFullYear() + 2) {
      throw new AppError('El año inicial (firstYear) no es un año válido.', 400, 'INVALID_FIRST_YEAR');
    }

    let lastYearNum = null;
    if (lastYear !== undefined && lastYear !== null && lastYear !== '') {
      lastYearNum = parseInt(lastYear, 10);
      if (isNaN(lastYearNum) || lastYearNum < firstYearNum) {
        throw new AppError('El año final (lastYear) no puede ser menor al año inicial.', 400, 'INVALID_LAST_YEAR');
      }
    }

    // Verificar si ya existe este camión con idéntica configuración
    const existing = await truckRepository.findExact(truckBrand, truckModel, engineModel, firstYearNum);
    if (existing) {
      throw new AppError(
        `Ya existe un camión registrado con marca '${truckBrand}', modelo '${truckModel}', motor '${engineModel || 'N/A'}' y año '${firstYearNum}'.`,
        409,
        'TRUCK_ALREADY_EXISTS'
      );
    }

    const created = await truckRepository.create({
      truckBrand,
      truckModel,
      engineModel,
      firstYear: firstYearNum,
      lastYear: lastYearNum,
      notes
    });

    return toTruckDTO(created);
  },

  /**
   * Actualiza los datos de un camión.
   */
  async updateTruck(idTruck, data) {
    const id = parseInt(idTruck, 10);
    if (isNaN(id) || id <= 0) {
      throw new AppError('ID de camión inválido.', 400, 'INVALID_TRUCK_ID');
    }

    const existing = await truckRepository.findById(id);
    if (!existing) {
      throw new AppError(`Camión con ID ${id} no encontrado.`, 404, 'TRUCK_NOT_FOUND');
    }

    let firstYearNum = undefined;
    if (data.firstYear !== undefined) {
      firstYearNum = parseInt(data.firstYear, 10);
      if (isNaN(firstYearNum) || firstYearNum < 1950) {
        throw new AppError('El año inicial (firstYear) no es válido.', 400, 'INVALID_FIRST_YEAR');
      }
    }

    let lastYearNum = undefined;
    if (data.lastYear !== undefined && data.lastYear !== null && data.lastYear !== '') {
      lastYearNum = parseInt(data.lastYear, 10);
      const effectiveFirst = firstYearNum !== undefined ? firstYearNum : existing.first_year;
      if (isNaN(lastYearNum) || lastYearNum < effectiveFirst) {
        throw new AppError('El año final no puede ser menor al año inicial.', 400, 'INVALID_LAST_YEAR');
      }
    }

    const updated = await truckRepository.update(id, {
      truckBrand: data.truckBrand,
      truckModel: data.truckModel,
      engineModel: data.engineModel,
      firstYear: firstYearNum,
      lastYear: lastYearNum,
      notes: data.notes
    });

    return toTruckDTO(updated);
  },

  /**
   * Elimina un camión del catálogo.
   */
  async deleteTruck(idTruck) {
    const id = parseInt(idTruck, 10);
    if (isNaN(id) || id <= 0) {
      throw new AppError('ID de camión inválido.', 400, 'INVALID_TRUCK_ID');
    }

    const deleted = await truckRepository.delete(id);
    if (!deleted) {
      throw new AppError(`Camión con ID ${id} no encontrado para eliminar.`, 404, 'TRUCK_NOT_FOUND');
    }

    return {
      idTruck: id,
      deleted: true,
      message: `El camión '${deleted.truck_brand} ${deleted.truck_model}' fue eliminado correctamente.`
    };
  },

  /**
   * Retorna lista de marcas únicas de camiones.
   */
  async getTruckBrands() {
    return await truckRepository.getDistinctBrands();
  }
};
