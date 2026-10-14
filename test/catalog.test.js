import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'http';
import app from '../src/app.js';
import pool from '../src/config/database.js';
import { brandService } from '../src/modules/catalog/services/brand.service.js';
import { itemService } from '../src/modules/catalog/services/item.service.js';
import { oemService } from '../src/modules/catalog/services/oem.service.js';
import { ImageProcessorService } from '../src/modules/catalog/services/imageProcessor.service.js';
import { cleanOemCode } from '../src/common/utils/stringSanitizer.js';
import sharp from 'sharp';

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
// 1. PRUEBAS UNITARIAS DE UTILIDADES Y PROCESAMIENTO
// =========================================================================
test('String Sanitizer: limpia caracteres no alfanuméricos y convierte a mayúsculas', () => {
  assert.equal(cleanOemCode('472 500-007.2'), '4725000072');
  assert.equal(cleanOemCode('bw 5011016'), 'BW5011016');
  assert.equal(cleanOemCode(''), '');
});

test('Image Processor: genera WebP original y thumbnail a partir de buffer', async () => {
  const sampleBuffer = await sharp({
    create: {
      width: 100,
      height: 100,
      channels: 4,
      background: { r: 255, g: 0, b: 0, alpha: 1 }
    }
  }).png().toBuffer();

  const result = await ImageProcessorService.processPartImage(sampleBuffer);
  assert.ok(result.filename.endsWith('.webp'));
  assert.ok(result.originalBuffer.length > 0);
  assert.ok(result.thumbnailBuffer.length > 0);

  const thumbMeta = await sharp(result.thumbnailBuffer).metadata();
  assert.equal(thumbMeta.format, 'webp');
  assert.equal(thumbMeta.width, 300);
  assert.equal(thumbMeta.height, 300);
});

// =========================================================================
// 2. PRUEBAS DE SERVICIO Y CAPA DE NEGOCIO
// =========================================================================
test('Brand Service: lista marcas de la base de datos', async () => {
  const brands = await brandService.getAllBrands();
  assert.ok(Array.isArray(brands));
  assert.ok(brands.length >= 5);
  const wabco = brands.find(b => b.brandName === 'Wabco');
  assert.ok(wabco);
  assert.equal(wabco.country, 'Alemania');
});

test('Item Service: lista repuestos paginados con formato estándar', async () => {
  const result = await itemService.getAllItems({ page: 1, limit: 5 });
  assert.ok(result.items.length <= 5);
  assert.ok(result.total >= 10);
  assert.equal(result.page, 1);
  assert.ok(result.totalPages >= 2);

  const first = result.items[0];
  assert.ok(first.idItem);
  assert.ok(first.itemName);
  assert.ok(first.sku);
});

test('Item Service: búsqueda avanzada GIN Trigram y Códigos OEM', async () => {
  // 1. Búsqueda por nombre parcial
  const byName = await itemService.searchItems('valvula pedal');
  assert.ok(byName.length > 0);
  assert.ok(byName[0].itemName.toLowerCase().includes('válvula') || byName[0].itemName.toLowerCase().includes('valvula'));

  // 2. Búsqueda por código OEM con espacios
  const byOemFormatted = await itemService.searchItems('472 500 007 2');
  assert.ok(byOemFormatted.length > 0);
  assert.equal(byOemFormatted[0].idItem, 1);

  // 3. Búsqueda por código OEM limpio
  const byOemClean = await itemService.searchItems('4725000072');
  assert.ok(byOemClean.length > 0);
  assert.equal(byOemClean[0].idItem, 1);

  // 4. Búsqueda por marca fabricante
  const byBrand = await itemService.searchItems('Fleetguard');
  assert.ok(byBrand.length > 0);
  assert.equal(byBrand[0].brandName, 'Fleetguard');
});

test('OEM Service: asocia y valida duplicados de códigos OEM', async () => {
  const item = await itemService.getItemById(2);
  assert.ok(item);

  await assert.rejects(
    async () => {
      await oemService.addOemToItem(2, { oemCode: '5011016' });
    },
    (err) => err.code === 'OEM_CODE_DUPLICATED'
  );
});

// =========================================================================
// 3. PRUEBAS DE INTEGRACIÓN HTTP (API REST v1)
// =========================================================================
test('HTTP GET /health - verifica estado saludable', async () => {
  const res = await fetch(`${baseUrl}/health`);
  const body = await res.json();
  assert.equal(res.status, 200);
  assert.equal(body.success, true);
  assert.equal(body.data.status, 'HEALTHY');
});

test('HTTP GET /api/v1/catalog/brands - formato { success: true, data }', async () => {
  const res = await fetch(`${baseUrl}/api/v1/catalog/brands`);
  const body = await res.json();
  assert.equal(res.status, 200);
  assert.equal(body.success, true);
  assert.ok(Array.isArray(body.data));
  assert.ok(body.data.length >= 5);
});

test('HTTP GET /api/v1/catalog/items - formato con paginación { success: true, data, meta }', async () => {
  const res = await fetch(`${baseUrl}/api/v1/catalog/items?page=1&limit=3`);
  const body = await res.json();
  assert.equal(res.status, 200);
  assert.equal(body.success, true);
  assert.ok(Array.isArray(body.data));
  assert.equal(body.data.length, 3);
  assert.ok(body.meta);
  assert.equal(body.meta.page, 1);
  assert.equal(body.meta.limit, 3);
});

test('HTTP GET /api/v1/catalog/items/search - búsqueda difusa y por OEM', async () => {
  const res = await fetch(`${baseUrl}/api/v1/catalog/items/search?q=bendix`);
  const body = await res.json();
  assert.equal(res.status, 200);
  assert.equal(body.success, true);
  assert.ok(Array.isArray(body.data));
  assert.ok(body.data.length > 0);
  assert.ok(body.data.some(i => i.itemName.toLowerCase().includes('bendix') || i.brandName === 'Bendix'));
});

test('HTTP POST /api/v1/catalog/items/:idItem/images - carga multipart y Sharp WebP', async () => {
  const pngBuffer = await sharp({
    create: {
      width: 200,
      height: 200,
      channels: 4,
      background: { r: 0, g: 128, b: 255, alpha: 1 }
    }
  }).png().toBuffer();

  const formData = new FormData();
  const blob = new Blob([pngBuffer], { type: 'image/png' });
  formData.append('images', blob, 'test-valve.png');

  const res = await fetch(`${baseUrl}/api/v1/catalog/items/1/images`, {
    method: 'POST',
    body: formData
  });

  const body = await res.json();
  assert.equal(res.status, 200);
  assert.equal(body.success, true);
  assert.ok(body.data.images.length > 0);

  const uploadedImg = body.data.images[body.data.images.length - 1];
  assert.ok(uploadedImg.imageUrl.startsWith('/uploads/original/'));
  assert.ok(uploadedImg.thumbnailUrl.startsWith('/uploads/thumbs/'));
  assert.ok(uploadedImg.imageUrl.endsWith('.webp'));
  assert.ok(uploadedImg.thumbnailUrl.endsWith('.webp'));
});
