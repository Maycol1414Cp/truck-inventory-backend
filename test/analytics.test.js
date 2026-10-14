import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'http';
import app from '../src/app.js';
import pool from '../src/config/database.js';
import { analyticsService } from '../src/modules/analytics/services/analytics.service.js';

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
// 1. PRUEBAS DE SERVICIO: DEMANDA ESTACIONAL (Q1..Q4)
// =========================================================================

test('Analytics Service: calcula demanda estacional agrupada por trimestres', async () => {
  const result = await analyticsService.getSeasonalDemand();
  assert.ok(result);
  assert.ok(Array.isArray(result.items));
  assert.ok(result.items.length > 0);

  const firstItem = result.items[0];
  assert.ok(firstItem.idItem);
  assert.ok(firstItem.itemName);
  assert.ok(firstItem.seasons);
  assert.ok('q1' in firstItem.seasons);
  assert.ok('q2' in firstItem.seasons);
  assert.ok('q3' in firstItem.seasons);
  assert.ok('q4' in firstItem.seasons);
  assert.ok(firstItem.totalQuantitySold >= 0);
  assert.ok(firstItem.totalRevenue >= 0);
  assert.ok(firstItem.peakSeason);
});

test('Analytics Service: filtra demanda estacional por año y repuesto', async () => {
  const currentYear = new Date().getFullYear();
  const result = await analyticsService.getSeasonalDemand({
    year: currentYear,
    idItem: 5 // Rodamiento Meritor
  });

  assert.ok(result);
  assert.ok(Array.isArray(result.items));
  if (result.items.length > 0) {
    const item = result.items[0];
    assert.equal(item.idItem, 5);
    assert.equal(item.year, currentYear);
  }
});

test('Analytics Service: rechaza año o ID inválido con error 400', async () => {
  await assert.rejects(
    async () => {
      await analyticsService.getSeasonalDemand({ year: 1800 });
    },
    (err) => err.code === 'INVALID_YEAR'
  );

  await assert.rejects(
    async () => {
      await analyticsService.getSeasonalDemand({ idItem: -10 });
    },
    (err) => err.code === 'INVALID_ITEM_ID'
  );
});

// =========================================================================
// 2. PRUEBAS DE SERVICIO: PUNTO DE REORDEN (ROP) Y PREDICCIÓN DE COMPRAS
// =========================================================================

test('Analytics Service: calcula Punto de Reorden (ROP = D_avg * LT + SS) y presupuesto', async () => {
  const result = await analyticsService.getReorderPoints({
    lookbackDays: 90,
    leadTimeDays: 30,
    safetyStockDays: 7
  });

  assert.ok(result);
  assert.ok(Array.isArray(result.items));
  assert.ok(result.summary);
  assert.ok(result.summary.totalAnalyzed >= 10);
  assert.ok(typeof result.summary.totalEstimatedPurchaseBudget === 'number');

  // Validar fórmula matemática en un repuesto con ventas
  const activeItem = result.items.find(i => i.metrics.unitsSoldInPeriod > 0);
  assert.ok(activeItem);

  const { metrics, stock, recommendation } = activeItem;
  // D_avg = unitsSold / lookbackDays
  const expectedDavg = parseFloat((metrics.unitsSoldInPeriod / 90).toFixed(4));
  assert.equal(metrics.dailyAverageDemand, expectedDavg);

  // Safety Stock = ceil(D_avg * 7)
  const expectedSS = Math.ceil(expectedDavg * 7);
  assert.equal(metrics.safetyStockUnits, expectedSS);

  // ROP = ceil(D_avg * 30 + SS)
  const expectedROP = Math.ceil((expectedDavg * 30) + expectedSS);
  assert.equal(metrics.reorderPoint, expectedROP);

  // Verificación de coherencia del estado
  assert.ok(['CRITICAL_REORDER', 'WARNING_REORDER', 'OPTIMAL'].includes(recommendation.status));
  if (stock.totalActual <= metrics.reorderPoint) {
    assert.equal(recommendation.status, 'CRITICAL_REORDER');
    assert.equal(recommendation.requiresReorder, true);
    assert.ok(recommendation.suggestedOrderQuantity > 0);
  }
});

test('Analytics Service: filtra exclusivamente ítems que requieren orden de importación', async () => {
  const result = await analyticsService.getReorderPoints({
    onlyAlerts: true
  });

  assert.ok(result);
  assert.ok(Array.isArray(result.items));
  for (const item of result.items) {
    assert.equal(item.recommendation.requiresReorder, true);
    assert.ok(['CRITICAL_REORDER', 'WARNING_REORDER'].includes(item.recommendation.status));
  }
});

// =========================================================================
// 3. PRUEBAS DE SERVICIO: DASHBOARD EJECUTIVO DE KPIS
// =========================================================================

test('Analytics Service: genera dashboard ejecutivo con valuación y ventas netas', async () => {
  const dashboard = await analyticsService.getDashboard();
  assert.ok(dashboard);
  assert.ok(dashboard.catalog);
  assert.ok(dashboard.catalog.totalActiveItems >= 10);

  assert.ok(dashboard.inventory);
  assert.ok(dashboard.inventory.totalStockUnits > 0);
  assert.ok(dashboard.inventory.inventoryCostValuation > 0);
  assert.ok(dashboard.inventory.inventoryPriceValuation >= dashboard.inventory.inventoryCostValuation);

  assert.ok(dashboard.sales);
  assert.ok(dashboard.sales.totalCompletedSales > 0);
  assert.ok(dashboard.sales.grossRevenue > 0);
  assert.ok(dashboard.sales.netRevenue <= dashboard.sales.grossRevenue);
});

// =========================================================================
// 4. PRUEBAS DE INTEGRACIÓN HTTP (REST API v1)
// =========================================================================

test('HTTP GET /api/v1/analytics/seasonal-demand - respuesta estándar { success, data, meta }', async () => {
  const res = await fetch(`${baseUrl}/api/v1/analytics/seasonal-demand`);
  const body = await res.json();

  assert.equal(res.status, 200);
  assert.equal(body.success, true);
  assert.ok(Array.isArray(body.data));
  assert.ok(body.meta);
  assert.ok(body.meta.totalItems >= 0);
});

test('HTTP GET /api/v1/analytics/reorder-points - reporte predictivo y presupuesto vía API', async () => {
  const res = await fetch(`${baseUrl}/api/v1/analytics/reorder-points?leadTimeDays=45&safetyStockDays=10`);
  const body = await res.json();

  assert.equal(res.status, 200);
  assert.equal(body.success, true);
  assert.ok(body.summary);
  assert.ok(Array.isArray(body.data));
  assert.ok(body.meta);
  assert.equal(body.meta.parametersApplied.leadTimeDays, 45);
  assert.equal(body.meta.parametersApplied.safetyStockDays, 10);
});

test('HTTP GET /api/v1/analytics/dashboard - KPIs ejecutivos vía API', async () => {
  const res = await fetch(`${baseUrl}/api/v1/analytics/dashboard`);
  const body = await res.json();

  assert.equal(res.status, 200);
  assert.equal(body.success, true);
  assert.ok(body.data.catalog);
  assert.ok(body.data.inventory);
  assert.ok(body.data.sales);
});
