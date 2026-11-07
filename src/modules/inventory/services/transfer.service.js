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
      // 1. Verificar si existe depósito local en la misma sucursal
      const localLockQuery = `
        SELECT id_inventario, id_item, id_sucursal, tipo_almacen, pasillo, estante, seccion, cantidad, stock_minimo
        FROM inventario_stock
        WHERE id_sucursal = $1 AND id_item = $2 AND tipo_almacen IN ('TIENDA', 'DEPOSITO')
        ORDER BY id_inventario ASC
        FOR UPDATE;
      `;
      const { rows: stockRows } = await client.query(localLockQuery, [idSucursal, idItem]);

      const localDepositoRow = stockRows.find(s => s.tipo_almacen === 'DEPOSITO');
      const tiendaRow = stockRows.find(s => s.tipo_almacen === 'TIENDA');

      // Determinar si podemos abastecer desde el depósito local
      const canFulfillLocally = localDepositoRow && localDepositoRow.cantidad >= qty;

      if (canFulfillLocally) {
        // --- CASO 1: TRASPASO LOCAL (DEPOSITO -> TIENDA DENTRO DE LA MISMA SUCURSAL) ---
        const depPrevio = localDepositoRow.cantidad;
        const depPosterior = depPrevio - qty;

        await client.query(`
          UPDATE inventario_stock
          SET cantidad = $1, updated_at = CURRENT_TIMESTAMP
          WHERE id_inventario = $2;
        `, [depPosterior, localDepositoRow.id_inventario]);

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
          origen: 'DEPOSITO_LOCAL',
          deposito: {
            idInventario: localDepositoRow.id_inventario,
            stockPrevio: depPrevio,
            stockActual: depPosterior,
            ubicacion: `${localDepositoRow.pasillo}-${localDepositoRow.estante}-${localDepositoRow.seccion}`
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
      }

      // --- CASO 2: REABASTECIMIENTO DESDE EL MAIN HUB (CASA MATRIZ / ALMACÉN CENTRAL) ---
      const hubRes = await client.query(`
        SELECT id_sucursal, code, name
        FROM sucursal
        WHERE is_main_hub = TRUE AND is_active = TRUE
        LIMIT 1;
      `);

      if (hubRes.rows.length === 0 || hubRes.rows[0].id_sucursal === idSucursal) {
        throw new AppError(
          `Stock insuficiente en depósito para transferir. Disponible: ${localDepositoRow ? localDepositoRow.cantidad : 0}, Solicitado: ${qty}`,
          409,
          'INSUFFICIENT_STOCK'
        );
      }

      const hubBranch = hubRes.rows[0];

      // Bloquear stock en el Main Hub para este repuesto
      const hubLockQuery = `
        SELECT id_inventario, id_item, id_sucursal, tipo_almacen, pasillo, estante, seccion, cantidad, stock_minimo
        FROM inventario_stock
        WHERE id_sucursal = $1 AND id_item = $2
        ORDER BY (CASE WHEN tipo_almacen = 'DEPOSITO' THEN 1 ELSE 2 END), id_inventario ASC
        FOR UPDATE;
      `;
      const { rows: hubStockRows } = await client.query(hubLockQuery, [hubBranch.id_sucursal, idItem]);

      const hubSourceRow = hubStockRows.find(s => s.cantidad >= qty) || hubStockRows[0];

      if (!hubSourceRow || hubSourceRow.cantidad < qty) {
        const totalHubAvailable = hubStockRows.reduce((sum, r) => sum + r.cantidad, 0);
        throw new AppError(
          `Stock insuficiente tanto en depósito local (${localDepositoRow ? localDepositoRow.cantidad : 0}) como en el Main Hub (${totalHubAvailable}). Solicitado: ${qty}`,
          409,
          'INSUFFICIENT_STOCK'
        );
      }

      // Descontar del Main Hub
      const hubPrevio = hubSourceRow.cantidad;
      const hubPosterior = hubPrevio - qty;

      await client.query(`
        UPDATE inventario_stock
        SET cantidad = $1, updated_at = CURRENT_TIMESTAMP
        WHERE id_inventario = $2;
      `, [hubPosterior, hubSourceRow.id_inventario]);

      // Acreditar en la TIENDA de la sucursal destino
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

      // Auditoría en Kardex: Salida en el Main Hub
      await kardexRepository.createMovement({
        idItem,
        idSucursal: hubBranch.id_sucursal,
        movementType: 'TRASPASO_SUCURSAL',
        originType: hubSourceRow.tipo_almacen,
        destinationType: `SUCURSAL_${branch.code}`,
        quantity: -qty,
        stockPrevio: hubPrevio,
        stockPosterior: hubPosterior,
        referenceId: null,
        userResponsible,
        reason: `Despacho de reabastecimiento inter-sucursal hacia ${branch.name} (-${qty})`
      }, client);

      // Auditoría en Kardex: Entrada en la Sucursal Destino
      const transferReason = reason || `Reabastecimiento desde Almacén Central (${hubBranch.name}) hacia ${branch.name} (+${qty})`;
      const kardexEntry = await kardexRepository.createMovement({
        idItem,
        idSucursal,
        movementType: 'TRASPASO_SUCURSAL',
        originType: 'MAIN_HUB',
        destinationType: 'TIENDA',
        quantity: qty,
        stockPrevio: tiendaPrevio,
        stockPosterior: tiendaPosterior,
        referenceId: null,
        userResponsible,
        reason: transferReason
      }, client);

      return {
        idItem,
        idSucursal,
        cantidadTransferida: qty,
        origen: 'MAIN_HUB',
        hubNombre: hubBranch.name,
        deposito: {
          idInventario: hubSourceRow.id_inventario,
          stockPrevio: hubPrevio,
          stockActual: hubPosterior,
          ubicacion: `${hubSourceRow.pasillo}-${hubSourceRow.estante}-${hubSourceRow.seccion}`
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
