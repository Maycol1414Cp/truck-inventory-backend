# 📋 TASKS.MD: CHECKLIST DE EJECUCIÓN POR MICRO-FASES

**Documento:** `docs/TASKS.md`  
**Objetivo:** Seguimiento granular e interactivo del desarrollo de `backend-inventario-truck-parts`.  
**Regla de Operación:** Todo desarrollador o agente que complete un ítem debe marcar la casilla con `[x]` tras validar sintaxis y pruebas funcionales.

---

## 🏗️ MICRO-FASE 0: SETUP, INFRAESTRUCTURA Y BASE DE DATOS

- [x] **0.1. Refactor del DDL Maestro (`src/database/init.sql`)**
  - [x] Eliminar bloques duplicados y ordenar creación de tablas según dependencias foráneas.
  - [x] Habilitar extensiones `uuid-ossp` y `pg_trgm`.
  - [x] Incluir tablas: `brand`, `item`, `item_image`, `item_oem`, subtipos técnicos (`seal`, `bearing`, `valve`, `sensor`, `repairkit`).
  - [x] Incluir tablas multi-sucursal: `sucursal`, `inventario_stock` (con discriminación TIENDA vs DEPOSITO y coordenadas), `inventario_movimiento` (Kardex).
  - [x] Incluir tablas POS: `venta`, `venta_detalle`, `devolucion`, `devolucion_detalle`.
  - [x] Incluir tablas de vehículos: `truck`, `item_truck_compatibility`.
  - [x] Definir índices B-Tree y GIN trigram en `item` y `item_oem`.
  - [x] Crear vista `v_alertas_reposicion_interna`.

- [x] **0.2. Scripts de Migración y Semillas**
  - [x] Crear script ejecutable `src/database/runMigration.js` que aplique `init.sql` utilizando el pool de `pg`.
  - [x] Crear archivo `src/database/seeds/seed.sql` con datos demo realistas:
    - [x] 2 sucursales: Matriz (Casa Central) y Sucursal Norte.
    - [x] 5 marcas pesadas: Wabco, Bendix, Bosch, Meritor, Fleetguard.
    - [x] 5 camiones demo: Freightliner Cascadia (Detroit DD15), Kenworth T680 (Cummins X15), Mack Anthem (Mack MP8).
    - [x] 10 repuestos con stock distribuido entre Tienda y Depósito (con casos intencionales de stock = 0 en tienda y > 0 en depósito para probar alertas).
  - [x] Crear script ejecutable `src/database/seeds/runSeed.js`.

- [x] **0.3. Configuración de Conexión y Pool (`src/config/database.js`)**
  - [x] Configurar listeners de evento en el pool: `pool.on('connect', ...)`, `pool.on('error', ...)`.
  - [x] Validar variables de entorno requeridas al arranque (`DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `DB_PORT`).

- [x] **0.4. Actualización de `package.json`**
  - [x] Añadir dependencias necesarias: `sharp`, `multer`, `uuid`.
  - [x] Configurar scripts en `package.json`:
    - [x] `"migrate": "node src/database/runMigration.js"`
    - [x] `"seed": "node src/database/seeds/runSeed.js"`
    - [x] `"dev": "nodemon src/app.js"`
    - [x] `"start": "node src/app.js"`

---

## 📦 MICRO-FASE 1: CATÁLOGO, MULTIMEDIA Y BÚSQUEDA OEM

- [x] **1.1. Estructura y Capa Común**
  - [x] Crear utilitario de sanitización `src/common/utils/stringSanitizer.js` (`cleanOemCode`).
  - [x] Crear middleware de subida en memoria `src/common/middlewares/upload.middleware.js` (Multer con `memoryStorage`, límite 10MB y validación MIME).
  - [x] Crear servicio de optimización de imágenes `src/modules/catalog/services/imageProcessor.service.js` (Sharp WebP 1200px y thumbnail 300x300).
  - [x] Configurar servicio de almacenamiento local de imágenes en `uploads/original` y `uploads/thumbs`.
  - [x] Montar carpeta estática `app.use('/uploads', express.static(...))` en `src/app.js`.

- [x] **1.2. Módulo de Marcas (`brand`)**
  - [x] Repositorio `src/modules/catalog/repositories/brand.repository.js`.
  - [x] Servicio `src/modules/catalog/services/brand.service.js`.
  - [x] Controlador `src/modules/catalog/controllers/brand.controller.js`.
  - [x] Rutas `GET /api/v1/catalog/brands` y `POST /api/v1/catalog/brands`.

- [x] **1.3. Módulo de Repuestos (`item`)**
  - [x] Mapper `src/modules/catalog/mappers/item.mapper.js`.
  - [x] Repositorio `src/modules/catalog/repositories/item.repository.js` (CRUD completo).
  - [x] Servicio `src/modules/catalog/services/item.service.js` (soporte de creación con transacción para imágenes y OEMs).
  - [x] Controlador `src/modules/catalog/controllers/item.controller.js`.
  - [x] Endpoint de carga multimedia: `POST /api/v1/catalog/items/:idItem/images` con hasta 5 fotos.
  - [x] Endpoint de eliminación de fotos: `DELETE /api/v1/catalog/items/:idItem/images/:idImage`.

- [x] **1.4. Módulo de Códigos OEM y Referencias Cruzadas**
  - [x] Repositorio `src/modules/catalog/repositories/oem.repository.js`.
  - [x] Servicio `src/modules/catalog/services/oem.service.js`.
  - [x] Endpoint para asociar código OEM: `POST /api/v1/catalog/items/:idItem/oems`.
  - [x] Endpoint para listar códigos OEM por repuesto: `GET /api/v1/catalog/items/:idItem/oems`.

- [x] **1.5. Búsqueda Avanzada con Trigramas e Índices GIN**
  - [x] Implementar consulta SQL con operador `%`, `ILIKE` y `clean_oem_code`.
  - [x] Endpoint `GET /api/v1/catalog/items/search?q=...`.
  - [x] Probar velocidad y precisión de coincidencias ante texto desordenado o códigos sin guiones.

---

## 🏢 MICRO-FASE 2: INVENTARIO MULTI-SUCURSAL Y ALERTAS DE REPOSICIÓN

- [x] **2.1. Gestión de Sucursales (`sucursal`)**
  - [x] Repositorio, servicio y controlador de sucursales.
  - [x] Rutas `GET /api/v1/inventory/branches` y `POST /api/v1/inventory/branches`.

- [x] **2.2. Stock Segregado y Coordenadas Físicas**
  - [x] Repositorio `src/modules/inventory/repositories/inventory.repository.js`:
    - [x] Consulta de stock por sucursal desglosado en `TIENDA` vs `DEPOSITO`.
    - [x] Actualización de pasillo, estante y sección (`PUT /api/v1/inventory/branches/:idSucursal/stock/:idItem/location`).
    - [x] Asignación inicial de stock y umbrales mínimos de exhibición.

- [x] **2.3. Servicio de Alerta de Reposición Interna**
  - [x] Repositorio y servicio `src/modules/inventory/services/restockAlert.service.js` consultando `v_alertas_reposicion_interna`.
  - [x] Endpoint `GET /api/v1/inventory/alerts/restock/:idSucursal`.
  - [x] Retornar datos detallados: stock actual en mostrador, stock disponible en depósito y coordenadas exactas para que el bodeguero recoja la pieza.

- [x] **2.4. Traspasos Internos (Depósito -> Tienda) con Kardex**
  - [x] Implementar transacción atómica: descuenta de `DEPOSITO`, suma en `TIENDA` en la misma sucursal.
  - [x] Generar doble asiento o asiento balanceado en `inventario_movimiento` con tipo `TRASPASO_TIENDA_DEPOSITO`.
  - [x] Endpoint `POST /api/v1/inventory/transfers`.

---

## 💳 MICRO-FASE 3: PUNTO DE VENTA (POS) TRANSACCIONAL Y DEVOLUCIONES

- [x] **3.1. Infraestructura Transaccional Segura**
  - [x] Implementar helper `withTransaction(callback)` en `src/common/utils/transactionHelper.js`.
  - [x] Configurar middleware de captura de errores y códigos de respuesta consistentes.

- [x] **3.2. Venta Transaccional POS con Bloqueo Anti-Concurrencia**
  - [x] Repositorio de ventas `src/modules/pos/repositories/sale.repository.js` (cabeceras y detalles).
  - [x] Servicio `src/modules/pos/services/pos.service.js`:
    - [x] Ordenar array de IDs ascendente (`ORDER BY id_inventario ASC`) para prevenir deadlocks.
    - [x] Ejecutar `SELECT ... FOR UPDATE` sobre `inventario_stock` en `TIENDA`.
    - [x] Validar existencias en memoria transaccional (lanzar error `INSUFFICIENT_STOCK` si falta cantidad).
    - [x] Generar número correlativo de factura (`FAC-XXXXXXXX`).
    - [x] Insertar cabecera en `venta` y líneas en `venta_detalle`.
    - [x] Descontar stock con `UPDATE inventario_stock`.
    - [x] Asentar en `inventario_movimiento` (`VENTA_POS`, cantidad negativa).
  - [x] Endpoint `POST /api/v1/pos/sales`.
  - [x] Endpoint de consulta `GET /api/v1/pos/sales/:idVenta`.

- [x] **3.3. Módulo de Devoluciones (Parciales y Totales)**
  - [x] Repositorio `src/modules/pos/repositories/return.repository.js`.
  - [x] Servicio de devolución transaccional `src/modules/pos/services/return.service.js`:
    - [x] Validar que la venta exista y no esté devuelta en su totalidad.
    - [x] Validar que las cantidades a devolver no superen las cantidades vendidas en los detalles originales.
    - [x] Insertar cabecera `devolucion` y líneas `devolucion_detalle`.
    - [x] Reintegrar stock al inventario (`TIENDA` o `CUARENTENA` según el motivo).
    - [x] Asentar en `inventario_movimiento` (`DEVOLUCION_POS`, cantidad positiva).
    - [x] Actualizar estado de la venta (`DEVUELTA_PARCIAL` o `DEVUELTA_TOTAL`).
  - [x] Endpoint `POST /api/v1/pos/returns`.

---

## 🚛 MICRO-FASE 4: COMPATIBILIDAD CON VEHÍCULOS Y MOTORES (FASE 2)

- [x] **4.1. Catálogo de Camiones y Motorizaciones**
  - [x] Repositorio y servicio `src/modules/compatibility/services/truck.service.js`.
  - [x] Registro de marcas (Kenworth, Freightliner, Mack, International, Volvo, Scania).
  - [x] Registro de modelos y motores pesados (Cummins X15/ISX, Detroit DD15, Mack MP8, Paccar MX-13).
  - [x] Endpoints `GET /api/v1/vehicles/trucks` y `POST /api/v1/vehicles/trucks`.

- [x] **4.2. Matriz de Compatibilidades y Búsqueda Inversa**
  - [x] Repositorio de relaciones `item_truck_compatibility`.
  - [x] Endpoint de vinculación: `POST /api/v1/vehicles/compatibility`.
  - [x] Endpoint de búsqueda inversa: `GET /api/v1/vehicles/trucks/:idTruck/items` (retorna todos los filtros, válvulas y sensores compatibles con ese camión).

---

## 📈 MICRO-FASE 5: ANALÍTICA ESTACIONAL Y PREDICCIÓN DE IMPORTACIONES (FASE 3)

- [x] **5.1. Analítica de Demanda Estacional**
  - [x] Crear vista materializada o consulta agregada por trimestre/estación sobre `venta_detalle`.
  - [x] Endpoint `GET /api/v1/analytics/seasonal-demand` con métricas de rotación por estación.

- [x] **5.2. Sistema Predictivo de Importaciones (Punto de Reorden)**
  - [x] Implementar cálculo de Demanda Promedio Diaria ($D_{avg}$) sobre historial de 90/180 días.
  - [x] Implementar cálculo de Punto de Reorden: $\text{ROP} = (D_{avg} \times \text{Lead Time}) + \text{Stock Seguridad}$.
  - [x] Endpoint `GET /api/v1/analytics/reorder-points` con reporte de alertas de compra internacional.

---
*Documento vivo. Cada micro-fase debe completarse y validarse antes de transicionar a la siguiente.*
