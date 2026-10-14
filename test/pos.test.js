import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'http';
import app from '../src/app.js';
import pool from '../src/config/database.js';
import { posService } from '../src/modules/pos/services/pos.service.js';
import { returnService } from '../src/modules/pos/services/return.service.js';
import { inventoryRepository } from '../src/modules/inventory/repositories/inventory.repository.js';

let server;
let baseUrl;

test.before(async () => {
  // Asegurar stock suficiente en TIENDA para que las pruebas POS sean idempotentes
  await pool.query(`
    UPDATE inventario_stock
    SET cantidad = 15
    WHERE id_sucursal = 1 AND tipo_almacen = 'TIENDA' AND id_item IN (3, 5, 7, 8, 9, 10);
  `);

  await new Promise((resolve) => {
    server = http.createServer(app);
    server.listen(0, () => {
      const port = server.address().port;
      baseUrl = `http://127.0.0.1:${port}`;
      resolve();
    });
  });
});

test.after(async () => {
  if (server) {
    await new Promise((resolve) => server.close(resolve));
  }
  await pool.end();
});

// =========================================================================
// 1. PRUEBAS DE SERVICIO: VENTA POS TRANSACCIONAL ACID
// =========================================================================
test('POS Service: registra venta atómica, descuenta stock de tienda y asienta en Kardex', async () => {
  // Ítem 3: Sensor ABS en SUC-01 (TIENDA tiene stock >= 2)
  const stockBefore = await inventoryRepository.findByItemAndWarehouseType(3, 1, 'TIENDA');
  assert.ok(stockBefore);
  assert.ok(stockBefore.cantidad >= 1);

  const sale = await posService.createSale({
    idSucursal: 1,
    clientName: 'Transportes TransCamión C.A.',
    clientDoc: 'J-12345678-9',
    paymentMethod: 'TRANSFERENCIA',
    items: [
      { idItem: 3, quantity: 1 }
    ]
  }, 101);

  assert.ok(sale);
  assert.ok(sale.idVenta);
  assert.ok(sale.numeroFactura.startsWith('FAC-'));
  assert.equal(sale.estado, 'COMPLETADA');
  assert.equal(sale.details.length, 1);
  assert.equal(sale.details[0].idItem, 3);
  assert.equal(sale.details[0].cantidad, 1);
  assert.ok(sale.total > 0);

  // Verificar que el stock en TIENDA disminuyó exactamente en 1
  const stockAfter = await inventoryRepository.findByItemAndWarehouseType(3, 1, 'TIENDA');
  assert.equal(stockAfter.cantidad, stockBefore.cantidad - 1);
});

test('POS Service: rechaza venta con 409 si el stock en mostrador es insuficiente (Anti-Negativos)', async () => {
  await assert.rejects(
    async () => {
      await posService.createSale({
        idSucursal: 1,
        paymentMethod: 'EFECTIVO',
        items: [
          { idItem: 3, quantity: 99999 } // Cantidad exorbitante
        ]
      });
    },
    (err) => err.code === 'INSUFFICIENT_STOCK'
  );
});

// =========================================================================
// 2. PRUEBAS DE SERVICIO: DEVOLUCIONES Y REINTEGRO A STOCK
// =========================================================================
test('Return Service: procesa devolución parcial, reintegra stock a tienda y asienta en Kardex', async () => {
  // 1. Realizar una venta de 2 unidades del ítem 5 (Rodamiento Meritor)
  const sale = await posService.createSale({
    idSucursal: 1,
    clientName: 'Cliente Devolución',
    paymentMethod: 'EFECTIVO',
    items: [
      { idItem: 5, quantity: 2 }
    ]
  });

  const detailId = sale.details[0].idDetalle;
  const stockBeforeReturn = await inventoryRepository.findByItemAndWarehouseType(5, 1, 'TIENDA');

  // 2. Procesar devolución parcial de 1 unidad
  const refund = await returnService.processReturn({
    idVenta: sale.idVenta,
    motivo: 'Cliente compró rodamiento equivocado',
    metodoReembolso: 'EFECTIVO',
    items: [
      {
        idDetalleVenta: detailId,
        quantity: 1,
        destinoAlmacen: 'TIENDA'
      }
    ]
  }, 'SUPERVISOR_TEST');

  assert.ok(refund);
  assert.equal(refund.tipoDevolucion, 'PARCIAL');
  assert.equal(refund.estado, 'APROBADA');
  assert.equal(refund.details.length, 1);
  assert.equal(refund.details[0].cantidad, 1);

  // 3. Verificar que la venta original cambió a DEVUELTA_PARCIAL
  const updatedSale = await posService.getSaleById(sale.idVenta);
  assert.equal(updatedSale.estado, 'DEVUELTA_PARCIAL');

  // 4. Verificar que el stock se reintegró (+1)
  const stockAfterReturn = await inventoryRepository.findByItemAndWarehouseType(5, 1, 'TIENDA');
  assert.equal(stockAfterReturn.cantidad, stockBeforeReturn.cantidad + 1);
});

test('Return Service: rechaza devolución si la cantidad solicitada excede la vendida', async () => {
  // Crear una venta de 1 unidad
  const sale = await posService.createSale({
    idSucursal: 1,
    paymentMethod: 'EFECTIVO',
    items: [
      { idItem: 7, quantity: 1 } // Pulmón 30/30
    ]
  });

  const detailId = sale.details[0].idDetalle;

  // Intentar devolver 5 unidades cuando solo se compró 1
  await assert.rejects(
    async () => {
      await returnService.processReturn({
        idVenta: sale.idVenta,
        motivo: 'Intento de fraude o error',
        items: [
          { idDetalleVenta: detailId, quantity: 5 }
        ]
      });
    },
    (err) => err.code === 'RETURN_QUANTITY_EXCEEDED'
  );
});

// =========================================================================
// 3. PRUEBAS DE INTEGRACIÓN HTTP (REST API v1)
// =========================================================================
test('HTTP POST /api/v1/pos/sales - creación de venta vía API REST', async () => {
  const res = await fetch(`${baseUrl}/api/v1/pos/sales`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      idSucursal: 1,
      clientName: 'Flota Camiones del Centro',
      clientDoc: 'J-99887766-0',
      paymentMethod: 'TARJETA',
      items: [
        { idItem: 8, quantity: 1 } // Kit reparación válvula
      ]
    })
  });

  const body = await res.json();
  assert.equal(res.status, 201);
  assert.equal(body.success, true);
  assert.ok(body.data.idVenta);
  assert.ok(body.data.numeroFactura.startsWith('FAC-'));
  assert.equal(body.data.estado, 'COMPLETADA');
});

test('HTTP GET /api/v1/pos/sales - listado paginado de ventas', async () => {
  const res = await fetch(`${baseUrl}/api/v1/pos/sales?limit=5`);
  const body = await res.json();
  assert.equal(res.status, 200);
  assert.equal(body.success, true);
  assert.ok(Array.isArray(body.data));
  assert.ok(body.data.length > 0);
  assert.ok(body.meta.total > 0);
});

test('HTTP GET /api/v1/pos/sales/:idVenta - detalle de factura y líneas', async () => {
  // Primero creamos una venta para consultar
  const createRes = await fetch(`${baseUrl}/api/v1/pos/sales`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      idSucursal: 1,
      paymentMethod: 'EFECTIVO',
      items: [{ idItem: 9, quantity: 1 }] // Retén Meritor
    })
  });
  const createBody = await createRes.json();
  const idVenta = createBody.data.idVenta;

  const res = await fetch(`${baseUrl}/api/v1/pos/sales/${idVenta}`);
  const body = await res.json();
  assert.equal(res.status, 200);
  assert.equal(body.success, true);
  assert.equal(body.data.idVenta, idVenta);
  assert.ok(body.data.details.length > 0);
});

test('HTTP POST /api/v1/pos/returns - procesamiento de devolución vía API', async () => {
  // 1. Crear venta para devolver
  const saleRes = await fetch(`${baseUrl}/api/v1/pos/sales`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      idSucursal: 1,
      paymentMethod: 'EFECTIVO',
      items: [{ idItem: 10, quantity: 1 }] // Sensor Aceite DD15
    })
  });
  const saleBody = await saleRes.json();
  const idVenta = saleBody.data.idVenta;
  const idDetalleVenta = saleBody.data.details[0].idDetalle;

  // 2. Procesar devolución total vía POST
  const returnRes = await fetch(`${baseUrl}/api/v1/pos/returns`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      idVenta,
      motivo: 'Sensor con conector incompatible',
      metodoReembolso: 'EFECTIVO',
      items: [
        {
          idDetalleVenta,
          quantity: 1,
          destinoAlmacen: 'TIENDA'
        }
      ]
    })
  });

  const returnBody = await returnRes.json();
  assert.equal(returnRes.status, 201);
  assert.equal(returnBody.success, true);
  assert.equal(returnBody.data.tipoDevolucion, 'TOTAL');
  assert.equal(returnBody.data.estado, 'APROBADA');

  // 3. Consultar reembolsos por venta vía GET /sales/:idVenta/returns
  const saleRefundsRes = await fetch(`${baseUrl}/api/v1/pos/sales/${idVenta}/returns`);
  const saleRefundsBody = await saleRefundsRes.json();
  assert.equal(saleRefundsRes.status, 200);
  assert.equal(saleRefundsBody.success, true);
  assert.ok(saleRefundsBody.data.length >= 1);
});
