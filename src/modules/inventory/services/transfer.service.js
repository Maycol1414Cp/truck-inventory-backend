import { withTransaction } from '../../../common/utils/transactionHelper.js';
import { branchRepository } from '../repositories/branch.repository.js';
import { itemRepository } from '../../catalog/repositories/item.repository.js';
import { kardexRepository } from '../repositories/kardex.repository.js';
import { AppError } from '../../../common/errors/AppError.js';

export const transferService = {
  async executeInternalTransfer({ idSucursal, idItem, quantity, userResponsible = 'SISTEMA', reason = null }) {
    if (!idSucursal || !idItem || !quantity) {
      throw new AppError('idSucursal, idItem y quantity son obligatorios.', 422, 'VALIDATION_FAILED');
    }

    const qty = parseInt(quantity, 10);
    if (isNaN(qty) || qty <= 0) {
      throw new AppError('La cantidad a transferir debe ser un número entero mayor a 0.', 422, 'VALIDATION_FAILED', [
        { field: 'quantity', message: 'Debe ser > 0.' }
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

    return await withTransaction(async (client) => {
      // 1. Bloqueo determinista ordenado por id_inventario para evitar deadlocks
      const lockQuery = `
        SELECT id_inventario, id_item, id_sucursal, tipo_almacen, pasillo, estante, seccion, cantidad, stock_minimo
        FROM inventario_stock
        WHERE id_sucursal = $1 AND id_item = $2 AND tipo_almacen IN ('TIENDA', 'DEPOSITO')
        ORDER BY id_inventario ASC
        FOR UPDATE;
      `;
      const { rows: stockRows } = await client.query(lockQuery, [idSucursal, idItem]);

      const depositoRow = stockRows.find(s => s.tipo_almacen === 'DEPOSITO');
      const tiendaRow = stockRows.find(s => s.tipo_almacen === 'TIENDA');

      if (!depositoRow || depositoRow.cantidad < qty) {
        throw new AppError(
          `Stock insuficiente en depósito para transferir. Disponible: ${depositoRow ? depositoRow.cantidad : 0}, Solicitado: ${qty}`,
          409,
          'INSUFFICIENT_STOCK'
        );
      }

      // 2. Descontar de DEPOSITO
      const depPrevio = depositoRow.cantidad;
      const depPosterior = depPrevio - qty;

      await client.query(`
        UPDATE inventario_stock
        SET cantidad = $1, updated_at = CURRENT_TIMESTAMP
        WHERE id_inventario = $2;
      `, [depPosterior, depositoRow.id_inventario]);

      // 3. Sumar en TIENDA (actualizar o crear si no existía)
      let tiendaId = tiendaRow ? tiendaRow.id_inventario : null;
      let tiendaPrevio = tiendaRow ? tiendaRow.cantidad : 0;
      let tiendaPosterior = tiendaPrevio + qty;

      if (tiendaRow) {
        await client.query(`
          UPDATE inventario_stock
          SET cantidad = $1, updated_at = CURRENT_TIMESTAMP
          WHERE id_inventario = $2;
        `, [tiendaPosterior, tiendaRow.id_inventario]);
      } else {
        const insertTienda = await client.query(`
          INSERT INTO inventario_stock (id_item, id_sucursal, tipo_almacen, cantidad, stock_minimo)
          VALUES ($1, $2, 'TIENDA', $3, 1)
          RETURNING id_inventario;
        `, [idItem, idSucursal, tiendaPosterior]);
        tiendaId = insertTienda.rows[0].id_inventario;
      }

      // 4. Asentar en Kardex (auditoría atómica del traspaso)
      const transferReason = reason || `Traspaso interno de reabastecimiento: Bodega -> Mostrador (+${qty})`;

      const kardexEntry = await kardexRepository.createMovement({
        idItem,
        idSucursal,
        movementType: 'TRASPASO_TIENDA_DEPOSITO',
        originType: 'DEPOSITO',
        destinationType: 'TIENDA',
        quantity: qty,
        stockPrevio: depPrevio,
        stockPosterior: depPosterior,
        referenceId: null,
        userResponsible,
        reason: transferReason
      }, client);

      return {
        idItem,
        idSucursal,
        cantidadTransferida: qty,
        deposito: {
          idInventario: depositoRow.id_inventario,
          stockPrevio: depPrevio,
          stockActual: depPosterior,
          ubicacion: `${depositoRow.pasillo}-${depositoRow.estante}-${depositoRow.seccion}`
        },
        tienda: {
          idInventario: tiendaId,
          stockPrevio: tiendaPrevio,
          stockActual: tiendaPosterior,
          ubicacion: tiendaRow ? `${tiendaRow.pasillo}-${tiendaRow.estante}-${tiendaRow.seccion}` : 'S/P-S/E-S/S'
        },
        kardex: {
          idMovimiento: kardexEntry.id_movimiento,
          tipoMovimiento: kardexEntry.tipo_movimiento,
          createdAt: kardexEntry.created_at
        }
      };
    });
  },

  async getKardexByItem(idSucursal, idItem, options = {}) {
    return await kardexRepository.findByItemAndBranch(idItem, idSucursal, options);
  }
};
