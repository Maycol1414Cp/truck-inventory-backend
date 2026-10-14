import { withTransaction } from '../../../common/utils/transactionHelper.js';
import { saleRepository } from '../repositories/sale.repository.js';
import { branchRepository } from '../../inventory/repositories/branch.repository.js';
import { kardexRepository } from '../../inventory/repositories/kardex.repository.js';
import { AppError } from '../../../common/errors/AppError.js';

export const posService = {
  async createSale(salePayload, userId = null) {
    const { idSucursal, items, paymentMethod = 'EFECTIVO', clientName = 'CLIENTE GENERAL', clientDoc = null } = salePayload;

    if (!idSucursal) {
      throw new AppError('El idSucursal es obligatorio.', 422, 'VALIDATION_FAILED', [
        { field: 'idSucursal', message: 'Debe especificar la sucursal de venta.' }
      ]);
    }

    if (!Array.isArray(items) || items.length === 0) {
      throw new AppError('La venta debe incluir al menos un repuesto en el arreglo items.', 422, 'VALIDATION_FAILED', [
        { field: 'items', message: 'No puede estar vacío.' }
      ]);
    }

    const validPaymentMethods = ['EFECTIVO', 'TARJETA', 'TRANSFERENCIA', 'CREDITO', 'MIXTO'];
    const payment = paymentMethod.trim().toUpperCase();
    if (!validPaymentMethods.includes(payment)) {
      throw new AppError(`Método de pago inválido. Permitidos: ${validPaymentMethods.join(', ')}`, 422, 'VALIDATION_FAILED', [
        { field: 'paymentMethod', message: 'Método no soportado.' }
      ]);
    }

    // Validar formato de los ítems solicitados
    for (const it of items) {
      if (!it.idItem || !it.quantity || it.quantity <= 0) {
        throw new AppError('Cada ítem debe tener un idItem válido y una cantidad mayor a 0.', 422, 'VALIDATION_FAILED');
      }
    }

    const branch = await branchRepository.findById(idSucursal);
    if (!branch) {
      throw new AppError(`Sucursal con ID ${idSucursal} no encontrada.`, 404, 'BRANCH_NOT_FOUND');
    }

    return await withTransaction(async (client) => {
      // 1. Extraer y ordenar numéricamente los IDs para prevenir Deadlocks
      const distinctItemIds = [...new Set(items.map(i => parseInt(i.idItem, 10)))].sort((a, b) => a - b);

      // 2. BLOQUEO DETERMINISTA DE FILAS EN TIENDA
      const lockQuery = `
        SELECT id_inventario, id_item, cantidad, stock_minimo, pasillo, estante
        FROM inventario_stock
        WHERE id_sucursal = $1 
          AND tipo_almacen = 'TIENDA' 
          AND id_item = ANY($2::int[])
        ORDER BY id_inventario ASC
        FOR UPDATE;
      `;
      const { rows: lockedStock } = await client.query(lockQuery, [idSucursal, distinctItemIds]);

      // 3. VALIDACIÓN ESTRICTA DE EXISTENCIAS EN MEMORIA TRANSACCIONAL
      for (const itemReq of items) {
        const stockRow = lockedStock.find(s => s.id_item === itemReq.idItem);

        if (!stockRow) {
          throw new AppError(
            `El repuesto ID ${itemReq.idItem} no tiene asignación en mostrador (TIENDA) para esta sucursal.`,
            404,
            'ITEM_NOT_FOUND_IN_LOCATION'
          );
        }

        if (stockRow.cantidad < itemReq.quantity) {
          throw new AppError(
            `Stock insuficiente para repuesto ID ${itemReq.idItem}. Solicitado: ${itemReq.quantity}, Disponible en tienda: ${stockRow.cantidad}`,
            409,
            'INSUFFICIENT_STOCK',
            [
              {
                idItem: itemReq.idItem,
                requested: itemReq.quantity,
                available: stockRow.cantidad
              }
            ]
          );
        }
      }

      // 4. OBTENER PRECIOS Y COSTOS OFICIALES DESDE LA BASE DE DATOS (Prevención de manipulación)
      const masterItemsQuery = `
        SELECT id_item, item_name, sku, price, cost
        FROM item
        WHERE id_item = ANY($1::int[]);
      `;
      const { rows: masterItems } = await client.query(masterItemsQuery, [distinctItemIds]);

      let subtotal = 0;
      const saleDetails = [];

      for (const itemReq of items) {
        const master = masterItems.find(m => m.id_item === itemReq.idItem);
        if (!master) {
          throw new AppError(`Repuesto ID ${itemReq.idItem} no existe en catálogo maestro.`, 404, 'ITEM_NOT_FOUND');
        }

        const unitPrice = parseFloat(master.price);
        const unitCost = parseFloat(master.cost);
        const lineDiscount = itemReq.discount ? parseFloat(itemReq.discount) : 0;
        const lineSubtotal = Math.max(0, (unitPrice * itemReq.quantity) - lineDiscount);

        subtotal += lineSubtotal;

        saleDetails.push({
          idItem: itemReq.idItem,
          itemName: master.item_name,
          sku: master.sku,
          quantity: itemReq.quantity,
          unitPrice,
          unitCost,
          discount: lineDiscount,
          subtotal: lineSubtotal,
          warehouseType: 'TIENDA'
        });
      }

      const total = subtotal; // Agregar lógica de impuestos adicionales si aplica

      // 5. GENERAR NÚMERO CORRELATIVO E INSERTAR CABECERA DE VENTA
      const invoiceNumber = `FAC-${Date.now().toString().slice(-6)}-${Math.floor(1000 + Math.random() * 9000)}`;
      const saleHeader = await saleRepository.createHeader({
        numeroFactura: invoiceNumber,
        idSucursal,
        vendedorId: userId,
        clienteNombre: clientName.trim(),
        clienteDocumento: clientDoc ? clientDoc.trim() : null,
        subtotal,
        total,
        metodoPago: payment,
        estado: 'COMPLETADA'
      }, client);

      // 6. DESCONTAR STOCK, REGISTRAR LÍNEAS Y ASENTAR EN KARDEX
      for (const detail of saleDetails) {
        const stockRow = lockedStock.find(s => s.id_item === detail.idItem);
        const stockPrevio = stockRow.cantidad;
        const stockPosterior = stockPrevio - detail.quantity;

        // Descontar inventario en mostrador
        await client.query(`
          UPDATE inventario_stock
          SET cantidad = $1, updated_at = CURRENT_TIMESTAMP
          WHERE id_inventario = $2;
        `, [stockPosterior, stockRow.id_inventario]);

        // Registrar detalle de venta
        await saleRepository.createDetail({
          idVenta: saleHeader.idVenta,
          idItem: detail.idItem,
          tipoAlmacenOrigen: detail.warehouseType,
          cantidad: detail.quantity,
          precioUnitario: detail.unitPrice,
          costoUnitario: detail.costCost || detail.unitCost,
          descuento: detail.discount,
          subtotal: detail.subtotal
        }, client);

        // Asiento inmutable en Kardex
        await kardexRepository.createMovement({
          idItem: detail.idItem,
          idSucursal,
          movementType: 'VENTA_POS',
          originType: 'TIENDA',
          destinationType: 'CLIENTE',
          quantity: -detail.quantity,
          stockPrevio,
          stockPosterior,
          referenceId: saleHeader.idVenta,
          userResponsible: userId ? `USUARIO_${userId}` : 'POS_CAJERO',
          reason: `Venta POS Factura #${invoiceNumber}`
        }, client);
      }

      return await saleRepository.findById(saleHeader.idVenta, client);
    });
  },

  async getSaleById(idVenta) {
    const sale = await saleRepository.findById(idVenta);
    if (!sale) {
      throw new AppError(`Venta con ID ${idVenta} no encontrada.`, 404, 'SALE_NOT_FOUND');
    }
    return sale;
  },

  async getAllSales(queryParams = {}) {
    const page = Math.max(1, parseInt(queryParams.page || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(queryParams.limit || '20', 10)));
    const idSucursal = queryParams.idSucursal ? parseInt(queryParams.idSucursal, 10) : null;
    const estado = queryParams.estado ? queryParams.estado.trim() : null;
    const startDate = queryParams.startDate || null;
    const endDate = queryParams.endDate || null;

    return await saleRepository.findAll({ idSucursal, estado, startDate, endDate, page, limit });
  }
};
