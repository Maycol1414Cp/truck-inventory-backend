import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'http';
import app from '../src/app.js';
import pool from '../src/config/database.js';
import { truckService } from '../src/modules/compatibility/services/truck.service.js';
import { compatibilityService } from '../src/modules/compatibility/services/compatibility.service.js';

let server;
let baseUrl;

test.before(async () => {
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
// 1. PRUEBAS DE SERVICIO: CAMIONES Y MOTORIZACIÓN (truck.service)
// =========================================================================

test('Truck Service: lista camiones con paginación y marcas demo', async () => {
  const result = await truckService.getTrucks({ limit: 10 });
  assert.ok(result);
  assert.ok(Array.isArray(result.trucks));
  assert.ok(result.trucks.length >= 5);
  assert.ok(result.meta.total >= 5);

  const cascadia = result.trucks.find(t => t.truckBrand === 'Freightliner' && t.truckModel === 'Cascadia');
  assert.ok(cascadia);
  assert.equal(cascadia.engineModel, 'Detroit DD15 14.8L');
  assert.equal(cascadia.firstYear, 2012);
});

test('Truck Service: obtiene marcas únicas de camiones', async () => {
  const brands = await truckService.getTruckBrands();
  assert.ok(Array.isArray(brands));
  assert.ok(brands.includes('Freightliner'));
  assert.ok(brands.includes('Kenworth'));
  assert.ok(brands.includes('Mack'));
  assert.ok(brands.includes('Volvo'));
  assert.ok(brands.includes('International'));
});

test('Truck Service: registra un nuevo camión y previene duplicados', async () => {
  const uniqueModel = `R500-Test-${Date.now()}`;
  const newTruck = await truckService.createTruck({
    truckBrand: 'Scania',
    truckModel: uniqueModel,
    engineModel: 'DC16 V8 16.4L',
    firstYear: 2020,
    lastYear: 2024,
    notes: 'Camión de prueba para suite de tests'
  });

  assert.ok(newTruck);
  assert.ok(newTruck.idTruck);
  assert.equal(newTruck.truckBrand, 'Scania');
  assert.equal(newTruck.truckModel, uniqueModel);

  // Intentar crear el mismo camión exactamente debe arrojar 409
  await assert.rejects(
    async () => {
      await truckService.createTruck({
        truckBrand: 'Scania',
        truckModel: uniqueModel,
        engineModel: 'DC16 V8 16.4L',
        firstYear: 2020
      });
    },
    (err) => err.code === 'TRUCK_ALREADY_EXISTS'
  );
});

test('Truck Service: valida rangos de años cohérentes (firstYear <= lastYear)', async () => {
  await assert.rejects(
    async () => {
      await truckService.createTruck({
        truckBrand: 'Volvo',
        truckModel: 'FH16-Invalid',
        firstYear: 2024,
        lastYear: 2010 // Inválido: menor al año inicial
      });
    },
    (err) => err.code === 'INVALID_LAST_YEAR'
  );
});

// =========================================================================
// 2. PRUEBAS DE SERVICIO: MATRIZ DE COMPATIBILIDAD Y BÚSQUEDA INVERSA
// =========================================================================

test('Compatibility Service: Búsqueda inversa - repuestos compatibles con camión', async () => {
  // Camión 1: Freightliner Cascadia
  const result = await compatibilityService.getItemsByTruck(1, { limit: 10 });
  assert.ok(result);
  assert.ok(result.truck);
  assert.equal(result.truck.truckBrand, 'Freightliner');
  assert.ok(Array.isArray(result.items));
  assert.ok(result.items.length >= 3);

  // Verificar que el repuesto 4 (Filtro FS1000) o repuesto 1 (Válvula Pedal) están en la lista
  const valve = result.items.find(i => i.idItem === 1);
  assert.ok(valve);
  assert.equal(valve.positionNote, 'Pedal de cabina conductor');
  assert.ok(valve.price > 0);
});

test('Compatibility Service: Búsqueda directa - camiones compatibles con repuesto', async () => {
  // Repuesto 4: Filtro Separador FS1000 (en las semillas es compatible con camiones 1, 2 y 5)
  const result = await compatibilityService.getTrucksByItem(4);
  assert.ok(result);
  assert.equal(result.idItem, 4);
  assert.ok(Array.isArray(result.trucks));
  assert.ok(result.trucks.length >= 2);

  const hasFreightliner = result.trucks.some(t => t.truckBrand === 'Freightliner');
  const hasKenworth = result.trucks.some(t => t.truckBrand === 'Kenworth');
  assert.ok(hasFreightliner);
  assert.ok(hasKenworth);
});

test('Compatibility Service: vincula y desvincula repuesto de un camión', async () => {
  // Vincular Ítem 7 (Cámara 30/30) con Camión 3 (Mack Anthem)
  const linked = await compatibilityService.linkItemToTruck({
    idItem: 7,
    idTruck: 3,
    positionNote: 'Eje tándem trasero'
  });

  assert.ok(linked);
  assert.equal(linked.idItem, 7);
  assert.equal(linked.idTruck, 3);
  assert.equal(linked.positionNote, 'Eje tándem trasero');

  // Comprobar que aparece en la búsqueda inversa de Mack Anthem
  const mackItems = await compatibilityService.getItemsByTruck(3);
  const found = mackItems.items.find(i => i.idItem === 7);
  assert.ok(found);

  // Desvincular
  const unlinked = await compatibilityService.unlinkItemFromTruck(7, 3);
  assert.ok(unlinked.unlinked);

  // Verificar que ya no aparece
  const mackItemsAfter = await compatibilityService.getItemsByTruck(3);
  assert.ok(!mackItemsAfter.items.some(i => i.idItem === 7));
});

test('Compatibility Service: rechaza vincular repuesto o camión inexistente', async () => {
  await assert.rejects(
    async () => {
      await compatibilityService.linkItemToTruck({
        idItem: 99999, // Inexistente
        idTruck: 1
      });
    },
    (err) => err.code === 'ITEM_NOT_FOUND'
  );

  await assert.rejects(
    async () => {
      await compatibilityService.linkItemToTruck({
        idItem: 1,
        idTruck: 99999 // Inexistente
      });
    },
    (err) => err.code === 'TRUCK_NOT_FOUND'
  );
});

// =========================================================================
// 3. PRUEBAS DE INTEGRACIÓN HTTP (REST API v1)
// =========================================================================

test('HTTP GET /api/v1/vehicles/trucks - lista camiones con estándar { success, data, meta }', async () => {
  const res = await fetch(`${baseUrl}/api/v1/vehicles/trucks?limit=3`);
  const body = await res.json();

  assert.equal(res.status, 200);
  assert.equal(body.success, true);
  assert.ok(Array.isArray(body.data));
  assert.equal(body.data.length, 3);
  assert.equal(body.meta.limit, 3);
  assert.ok(body.meta.total >= 5);
});

test('HTTP GET /api/v1/vehicles/trucks/brands - lista marcas de camiones', async () => {
  const res = await fetch(`${baseUrl}/api/v1/vehicles/trucks/brands`);
  const body = await res.json();

  assert.equal(res.status, 200);
  assert.equal(body.success, true);
  assert.ok(Array.isArray(body.data));
  assert.ok(body.data.includes('Freightliner'));
});

test('HTTP POST /api/v1/vehicles/trucks - registra camión por API REST', async () => {
  const modelName = `W900-API-${Date.now()}`;
  const res = await fetch(`${baseUrl}/api/v1/vehicles/trucks`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      truckBrand: 'Kenworth',
      truckModel: modelName,
      engineModel: 'Caterpillar C15 15.2L',
      firstYear: 2005,
      lastYear: 2018,
      notes: 'Edición Clásica Capó Largo'
    })
  });

  const body = await res.json();
  assert.equal(res.status, 201);
  assert.equal(body.success, true);
  assert.ok(body.data.idTruck);
  assert.equal(body.data.truckModel, modelName);
});

test('HTTP GET /api/v1/vehicles/trucks/:idTruck/items - búsqueda inversa vía API', async () => {
  const res = await fetch(`${baseUrl}/api/v1/vehicles/trucks/1/items`);
  const body = await res.json();

  assert.equal(res.status, 200);
  assert.equal(body.success, true);
  assert.ok(body.truck);
  assert.equal(body.truck.truckBrand, 'Freightliner');
  assert.ok(Array.isArray(body.data));
  assert.ok(body.data.length >= 3);
});

test('HTTP POST /api/v1/vehicles/compatibility - vincula repuesto vía API', async () => {
  const res = await fetch(`${baseUrl}/api/v1/vehicles/compatibility`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      idItem: 2, // Compresor Bendix
      idTruck: 2, // Kenworth T680
      positionNote: 'Montaje estándar de fábrica'
    })
  });

  const body = await res.json();
  assert.equal(res.status, 201);
  assert.equal(body.success, true);
  assert.equal(body.data.idItem, 2);
  assert.equal(body.data.idTruck, 2);
});

test('HTTP GET /api/v1/vehicles/items/:idItem/trucks - camiones compatibles vía API', async () => {
  const res = await fetch(`${baseUrl}/api/v1/vehicles/items/2/trucks`);
  const body = await res.json();

  assert.equal(res.status, 200);
  assert.equal(body.success, true);
  assert.ok(body.item);
  assert.equal(body.item.idItem, 2);
  assert.ok(Array.isArray(body.data));
  assert.ok(body.data.some(t => t.idTruck === 2));
});
