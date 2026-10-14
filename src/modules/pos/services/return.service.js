import { withTransaction } from '../../../common/utils/transactionHelper.js';
import { returnRepository } from '../repositories/return.repository.js';
import { saleRepository } from '../repositories/sale.repository.js';
import { kardexRepository } from '../../inventory/repositories/kardex.repository.js';
import { AppError } from '../../../common/errors/AppError.js';

export const returnService = {
  async processReturn(returnPayload, authorizedBy = 'SUPERVISOR_POS') {
    const { idVenta, items, motivo, metodoReembolso = 'EFECTIVO' } = returnPayload;

    if (!idVenta) {
      throw new AppError('El idVenta es obligatorio.', 422, 'VALIDATION_FAILED', [
        { field: 'idVenta', message: 'Debe especificar la venta original.' }
      ]);
    }

    if (!Array.isArray(items) || items.length === 0) {
      throw new AppError('Debe incluir al menos un ítem a devolver en el arreglo items.', 422, 'VALIDATION_FAILED', [
        { field: 'items', message: 'No puede estar vacío.' }
      ]);
    }

    if (!motivo || !motivo.trim()) {
      throw new AppError('El motivo de la devolución es obligatorio.', 422, 'VALIDATION_FAILED', [
        { field: 'motivo', message: 'No puede estar vacío.' }
      ]);
    }

    for (const it of items) {
      if (!it.idDetalleVenta || !it.quantity || it.quantity <= 0) {
        throw new AppError('Cada ítem a devolver debe incluir idDetalleVenta y quantity > 0.', 422, 'VALIDATION_FAILED');
      }
    }

    return await withTransaction(async (client) => {
      // 1. Bloqueo pesimista de la venta original
      const saleLockQuery = `SELECT * FROM venta WHERE id_venta = $1 FOR UPDATE;`;
      const { rows: saleRows } = await client.query(saleLockQuery, [idVenta]);

      if (saleRows.length === 0) {
        throw new AppError(`Venta con ID ${idVenta} no encontrada.`, 404, 'SALE_NOT_FOUND');
      }

      const sale = saleRows[0];
      if (sale.estado === 'ANULADA') {
        throw new AppError('No se pueden procesar devoluciones sobre una venta anulada.', 409, 'SALE_ALREADY_ANNULLED');
      }
      if (sale.estado === 'DEVUELTA_TOTAL') {
        throw new AppError('Esta venta ya fue reembolsada y devuelta en su totalidad.', 409, 'SALE_ALREADY_REFUNDED');
      }

      // 2. Obtener detalles originales de la venta
      const detailsQuery = `SELECT * FROM venta_detalle WHERE id_venta = $1 ORDER BY id_detalle ASC;`;
      const { rows: saleDetails } = await client.query(detailsQuery, [idVenta]);

      // 3. Obtener cantidades devueltas previas
      const previousReturns = await returnRepository.getReturnedQuantitiesBySale(idVenta, client);

      let totalRefund = 0;
      const processedReturnLines = [];

      for (const returnReq of items) {
        const detail = saleDetails.find(d => d.id_detalle === returnReq.idDetalleVenta);
        if (!detail) {
          throw new AppError(
            `El detalle de venta ID ${returnReq.idDetalleVenta} no pertenece a la venta #${idVenta}.`,
            404,
            'SALE_DETAIL_NOT_FOUND'
          );
        }

        const prev = previousReturns.find(p => p.id_detalle_venta === returnReq.idDetalleVenta);
        const alreadyReturnedQty = prev ? prev.total_devuelto : 0;
        const availableToReturn = detail.cantidad - alreadyReturnedQty;

        if (returnReq.quantity > availableToReturn) {
          throw new AppError(
            `Cantidad a devolver (${returnReq.quantity}) excede el remanente disponible (${availableToReturn}) para el ítem ID ${detail.id_item}.`,
            409,
            'RETURN_QUANTITY_EXCEEDED',
            [
              {
                idDetalleVenta: returnReq.idDetalleVenta,
                requested: returnReq.quantity,
                maxAllowed: availableToReturn
              }
            ]
          );
        }

        const unitRefund = parseFloat(detail.precio_unitario);
        const lineRefund = unitRefund * returnReq.quantity;
        totalRefund += lineRefund;

        const destinoAlmacen = returnReq.destinoAlmacen ? returnReq.destinoAlmacen.trim().toUpperCase() : 'TIENDA';
        if (!['TIENDA', 'DEPOSITO', 'CUARENTENA'].includes(destinoAlmacen)) {
          throw new AppError('destinoAlmacen debe ser TIENDA, DEPOSITO o CUARENTENA.', 422, 'INVALID_WAREHOUSE_TYPE');
        }

        processedReturnLines.push({
          idDetalleVenta: detail.id_detalle,
          idItem: detail.id_item,
          quantity: returnReq.quantity,
          destinoAlmacen,
          unitRefund,
          lineRefund
        });
      }

      // 4. Evaluar si con esta devolución se completa el 100% de la venta
      let totalOriginalItems = 0;
      let totalReturnedAllTime = 0;

      for (const d of saleDetails) {
        totalOriginalItems += d.cantidad;
        const prev = previousReturns.find(p => p.id_detalle_venta === d.id_detalle);
        const prevQty = prev ? prev.total_devuelto : 0;
        const currentReq = items.find(i => i.idDetalleVenta === d.id_detalle);
        const currentQty = currentReq ? currentReq.quantity : 0;
        totalReturnedAllTime += (prevQty + currentQty);
      }

      const tipoDevolucion = totalReturnedAllTime >= totalOriginalItems ? 'TOTAL' : 'PARCIAL';

      // 5. Insertar cabecera de devolución
      const returnHeader = await returnRepository.createHeader({
        idVenta,
        idSucursal: sale.id_sucursal,
        tipoDevolucion,
        motivo: motivo.trim(),
        montoReembolso: totalRefund,
        metodoReembolso: metodoReembolso.trim().toUpperCase(),
        autorizadoPor: authorizedBy,
        estado: 'APROBADA'
      }, client);

      // 6. Procesar cada línea: insertar detalle y reintegrar stock al almacén indicado
      for (const line of processedReturnLines) {
        await returnRepository.createDetail({
          idDevolucion: returnHeader.id_devolucion,
          idDetalleVenta: line.idDetalleVenta,
          idItem: line.idItem,
          cantidad: line.quantity,
          destinoAlmacen: line.destinoAlmacen,
          montoUnitario: line.unitRefund,
          subtotal: line.lineRefund
        }, client);

        if (line.destinoAlmacen === 'TIENDA' || line.destinoAlmacen === 'DEPOSITO') {
          // Reintegrar al stock
          const stockQuery = `
            SELECT id_inventario, cantidad 
            FROM inventario_stock 
            WHERE id_sucursal = $1 AND id_item = $2 AND tipo_almacen = $3
            LIMIT 1
            FOR UPDATE;
          `;
          const { rows: stockRows } = await client.query(stockQuery, [sale.id_sucursal, line.idItem, line.destinoAlmacen]);

          let stockPrevio = 0;
          let stockPosterior = line.quantity;

          if (stockRows.length > 0) {
            stockPrevio = stockRows[0].cantidad;
            stockPosterior = stockPrevio + line.quantity;
            await client.query(`
              UPDATE inventario_stock
              SET cantidad = $1, updated_at = CURRENT_TIMESTAMP
              WHERE id_inventario = $2;
            `, [stockPosterior, stockRows[0].id_inventario]);
          } else {
            await client.query(`
              INSERT INTO inventario_stock (id_item, id_sucursal, tipo_almacen, cantidad, stock_minimo)
              VALUES ($1, $2, $3, $4, 0);
            `, [line.idItem, sale.id_sucursal, line.destinoAlmacen, line.quantity]);
          }

          // Asentar reintegro en Kardex
          await kardexRepository.createMovement({
            idItem: line.idItem,
            idSucursal: sale.id_sucursal,
            movementType: 'DEVOLUCION_POS',
            originType: 'CLIENTE',
            destinationType: line.destinoAlmacen,
            quantity: line.quantity,
            stockPrevio,
            stockPosterior,
            referenceId: returnHeader.id_devolucion,
            userResponsible: authorizedBy,
            reason: `Reintegro por Devolución #${returnHeader.id_devolucion} de Venta #${idVenta}`
          }, client);
        } else if (line.destinoAlmacen === 'CUARENTENA') {
          // Registro en Kardex hacia cuarentena (sin sumar a piso de venta disponible)
          await kardexRepository.createMovement({
            idItem: line.idItem,
            idSucursal: sale.id_sucursal,
            movementType: 'DEVOLUCION_POS',
            originType: 'CLIENTE',
            destinationType: 'CUARENTENA',
            quantity: line.quantity,
            stockPrevio: 0,
            stockPosterior: 0,
            referenceId: returnHeader.id_devolucion,
            userResponsible: authorizedBy,
            reason: `Devolución por defecto a Cuarentena #${returnHeader.id_devolucion}`
          }, client);
        }
      }

      // 7. Actualizar estado de la venta
      const nuevoEstadoVenta = tipoDevolucion === 'TOTAL' ? 'DEVUELTA_TOTAL' : 'DEVUELTA_PARCIAL';
      await saleRepository.updateStatus(idVenta, nuevoEstadoVenta, client);

      return await returnRepository.findById(returnHeader.id_devolucion, client);
    });
  },

  async getReturnById(idDevolucion) {
    const dev = await returnRepository.findById(idDevolucion);
    if (!dev) {
      throw new AppError(`Devolución con ID ${idDevolucion} no encontrada.`, 404, 'RETURN_NOT_FOUND');
    }
    return dev;
  },

  async getReturnsBySale(idVenta) {
    const sale = await saleRepository.findById(idVenta);
    if (!sale) {
      throw new AppError(`Venta con ID ${idVenta} no encontrada.`, 404, 'SALE_NOT_FOUND');
    }
    return await returnRepository.findBySaleId(idVenta);
  }
};
