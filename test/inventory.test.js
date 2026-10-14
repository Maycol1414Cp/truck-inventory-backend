import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'http';
import app from '../src/app.js';
import pool from '../src/config/database.js';
import { branchService } from '../src/modules/inventory/services/branch.service.js';
import { inventoryService } from '../src/modules/inventory/services/inventory.service.js';
import { restockAlertService } from '../src/modules/inventory/services/restockAlert.service.js';
import { transferService } from '../src/modules/inventory/services/transfer.service.js';

let server;
let baseUrl;

test.before(async () => {
  // Asegurar stock base idempotente para alertas y traspasos en SUC-01
  await pool.query(`
    UPDATE inventario_stock SET cantidad = 0, stock_minimo = 2 WHERE id_sucursal = 1 AND id_item = 1 AND tipo_almacen = 'TIENDA';
    UPDATE inventario_stock SET cantidad = 8 WHERE id_sucursal = 1 AND id_item = 1 AND tipo_almacen = 'DEPOSITO';
    UPDATE inventario_stock SET cantidad = 10 WHERE id_sucursal = 1 AND id_item = 2 AND tipo_almacen = 'DEPOSITO';
    UPDATE inventario_stock SET cantidad = 10 WHERE id_sucursal = 1 AND id_item = 6 AND tipo_almacen = 'DEPOSITO';
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
// 1. PRUEBAS DE SERVICIO: SUCURSALES (branch.service)
// =========================================================================
test('Branch Service: lista sucursales activas', async () => {
  const branches = await branchService.getAllBranches();
  assert.ok(Array.isArray(branches));
  assert.ok(branches.length >= 2);
  const matriz = branches.find(b => b.code === 'SUC-01');
  assert.ok(matriz);
  assert.equal(matriz.isMainHub, true);
});

test('Branch Service: previene creación de código duplicado', async () => {
  await assert.rejects(
    async () => {
      await branchService.createBranch({
        code: 'SUC-01',
        name: 'Sucursal Duplicada',
        address: 'Calle Falsa 123'
      });
    },
    (err) => err.code === 'BRANCH_CODE_ALREADY_EXISTS'
  );
});

// =========================================================================
// 2. PRUEBAS DE SERVICIO: STOCK Y COORDENADAS (inventory.service)
// =========================================================================
test('Inventory Service: consulta stock segregado por sucursal', async () => {
  const result = await inventoryService.getStockByBranch(1, { limit: 10 });
  assert.ok(Array.isArray(result.stock));
  assert.ok(result.stock.length > 0);
  assert.ok(result.total >= 10);

  const first = result.stock[0];
  assert.ok(first.idItem);
  assert.ok(['TIENDA', 'DEPOSITO'].includes(first.tipoAlmacen));
  assert.ok(first.pasillo !== undefined);
  assert.ok(first.estante !== undefined);
  assert.ok(first.seccion !== undefined);
});

test('Inventory Service: actualiza coordenadas físicas de pasillo/estante/sección', async () => {
  const updated = await inventoryService.updateItemLocation(1, 1, {
    tipoAlmacen: 'TIENDA',
    pasillo: 'P-99',
    estante: 'E-88',
    seccion: 'S-77'
  });

  assert.ok(updated);
  assert.equal(updated.pasillo, 'P-99');
  assert.equal(updated.estante, 'E-88');
  assert.equal(updated.seccion, 'S-77');
});

// =========================================================================
// 3. PRUEBAS DE SERVICIO: ALERTAS DE REPOSICIÓN TIENDA VS. DEPÓSITO
// =========================================================================
test('Restock Alert Service: detecta quiebres en mostrador con existencia en bodega', async () => {
  const { alerts, summary } = await restockAlertService.getRestockAlerts(1);
  assert.ok(Array.isArray(alerts));
  assert.ok(alerts.length >= 1);
  assert.ok(summary.totalAlerts >= 1);

  // Alerta debe contener detalle de ambas ubicaciones
  const alert = alerts[0];
  assert.ok(alert.idItem);
  assert.ok(alert.itemName);
  assert.ok(alert.tienda.stockActual <= alert.tienda.stockMinimo);
  assert.ok(alert.deposito.stockDisponible > 0);
  assert.ok(alert.deposito.pasillo);
  assert.ok(alert.sugerenciaTraslado > 0);
});

// =========================================================================
// 4. PRUEBAS DE SERVICIO: TRASPASOS INTERNOS Y KARDEX (transfer.service)
// =========================================================================
test('Transfer Service: ejecuta traspaso atómico Bodega -> Mostrador con asiento en Kardex', async () => {
  // Ítem 2 (Compresor Bendix): tiene stock disponible en depósito
  const result = await transferService.executeInternalTransfer({
    idSucursal: 1,
    idItem: 2,
    quantity: 1,
    userResponsible: 'TEST_AGENT',
    reason: 'Traspaso de prueba para abastecer exhibición'
  });

  assert.ok(result);
  assert.equal(result.cantidadTransferida, 1);
  assert.equal(result.deposito.stockActual, result.deposito.stockPrevio - 1);
  assert.equal(result.tienda.stockActual, result.tienda.stockPrevio + 1);
  assert.ok(result.kardex.idMovimiento);
  assert.equal(result.kardex.tipoMovimiento, 'TRASPASO_TIENDA_DEPOSITO');
});

test('Transfer Service: rechaza traspaso si el stock en bodega es insuficiente', async () => {
  await assert.rejects(
    async () => {
      await transferService.executeInternalTransfer({
        idSucursal: 1,
        idItem: 2,
        quantity: 99999, // Supera con creces el depósito
        userResponsible: 'TEST_AGENT'
      });
    },
    (err) => err.code === 'INSUFFICIENT_STOCK'
  );
});

// =========================================================================
// 5. PRUEBAS DE INTEGRACIÓN HTTP (REST API v1)
// =========================================================================
test('HTTP GET /api/v1/inventory/branches - lista sucursales', async () => {
  const res = await fetch(`${baseUrl}/api/v1/inventory/branches`);
  const body = await res.json();
  assert.equal(res.status, 200);
  assert.equal(body.success, true);
  assert.ok(Array.isArray(body.data));
  assert.ok(body.data.length >= 2);
});

test('HTTP GET /api/v1/inventory/branches/:idSucursal/stock - stock paginado', async () => {
  const res = await fetch(`${baseUrl}/api/v1/inventory/branches/1/stock?limit=5`);
  const body = await res.json();
  assert.equal(res.status, 200);
  assert.equal(body.success, true);
  assert.ok(Array.isArray(body.data));
  assert.ok(body.data.length <= 5);
  assert.ok(body.meta.total > 0);
});

test('HTTP GET /api/v1/inventory/alerts/restock/1 - alertas de reposición', async () => {
  const res = await fetch(`${baseUrl}/api/v1/inventory/alerts/restock/1`);
  const body = await res.json();
  assert.equal(res.status, 200);
  assert.equal(body.success, true);
  assert.ok(Array.isArray(body.data));
  assert.ok(body.meta.totalAlerts !== undefined);
});

test('HTTP PUT /api/v1/inventory/branches/:idSucursal/stock/:idItem/location - actualiza coordenadas', async () => {
  const res = await fetch(`${baseUrl}/api/v1/inventory/branches/1/stock/2/location`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      tipoAlmacen: 'DEPOSITO',
      pasillo: 'P-12',
      estante: 'E-09',
      seccion: 'S-04'
    })
  });
  const body = await res.json();
  assert.equal(res.status, 200);
  assert.equal(body.success, true);
  assert.equal(body.data.pasillo, 'P-12');
  assert.equal(body.data.estante, 'E-09');
});

test('HTTP POST /api/v1/inventory/transfers - realiza traspaso interno vía API', async () => {
  const res = await fetch(`${baseUrl}/api/v1/inventory/transfers`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      idSucursal: 1,
      idItem: 6, // Gobernadora D-2
      quantity: 1,
      reason: 'Reabastecimiento vía API'
    })
  });
  const body = await res.json();
  assert.equal(res.status, 200);
  assert.equal(body.success, true);
  assert.equal(body.data.cantidadTransferida, 1);
  assert.ok(body.data.kardex.idMovimiento);
});

test('HTTP GET /api/v1/inventory/kardex/:idSucursal/:idItem - historial de movimientos', async () => {
  const res = await fetch(`${baseUrl}/api/v1/inventory/kardex/1/6`);
  const body = await res.json();
  assert.equal(res.status, 200);
  assert.equal(body.success, true);
  assert.ok(Array.isArray(body.data));
  assert.ok(body.data.length > 0);
  assert.equal(body.data[0].tipoMovimiento, 'TRASPASO_TIENDA_DEPOSITO');
});
