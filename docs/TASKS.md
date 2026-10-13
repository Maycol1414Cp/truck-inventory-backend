# 📋 TASKS.MD: CHECKLIST DE EJECUCIÓN POR MICRO-FASES

**Documento:** `docs/TASKS.md`  
**Objetivo:** Seguimiento granular e interactivo del desarrollo de `backend-inventario-truck-parts`.  
**Regla de Operación:** Todo desarrollador o agente que complete un ítem debe marcar la casilla con `[x]` tras validar sintaxis y pruebas funcionales.

---

## 🏗️ MICRO-FASE 0: SETUP, INFRAESTRUCTURA Y BASE DE DATOS

- [ ] **0.1. Refactor del DDL Maestro (`src/database/init.sql`)**
  - [ ] Eliminar bloques duplicados y ordenar creación de tablas según dependencias foráneas.
  - [ ] Habilitar extensiones `uuid-ossp` y `pg_trgm`.
  - [ ] Incluir tablas: `brand`, `item`, `item_image`, `item_oem`, subtipos técnicos (`seal`, `bearing`, `valve`, `sensor`, `repairkit`).
  - [ ] Incluir tablas multi-sucursal: `sucursal`, `inventario_stock` (con discriminación TIENDA vs DEPOSITO y coordenadas), `inventario_movimiento` (Kardex).
  - [ ] Incluir tablas POS: `venta`, `venta_detalle`, `devolucion`, `devolucion_detalle`.
  - [ ] Incluir tablas de vehículos: `truck`, `item_truck_compatibility`.
  - [ ] Definir índices B-Tree y GIN trigram en `item` y `item_oem`.
  - [ ] Crear vista `v_alertas_reposicion_interna`.

- [ ] **0.2. Scripts de Migración y Semillas**
  - [ ] Crear script ejecutable `src/database/runMigration.js` que aplique `init.sql` utilizando el pool de `pg`.
  - [ ] Crear archivo `src/database/seeds/seed.sql` con datos demo realistas:
    - [ ] 2 sucursales: Matriz (Casa Central) y Sucursal Norte.
    - [ ] 5 marcas pesadas: Wabco, Bendix, Bosch, Meritor, Fleetguard.
    - [ ] 5 camiones demo: Freightliner Cascadia (Detroit DD15), Kenworth T680 (Cummins X15), Mack Anthem (Mack MP8).
    - [ ] 10 repuestos con stock distribuido entre Tienda y Depósito (con casos intencionales de stock = 0 en tienda y > 0 en depósito para probar alertas).
  - [ ] Crear script ejecutable `src/database/seeds/runSeed.js`.

- [ ] **0.3. Configuración de Conexión y Pool (`src/config/database.js`)**
  - [ ] Configurar listeners de evento en el pool: `pool.on('connect', ...)`, `pool.on('error', ...)`.
  - [ ] Validar variables de entorno requeridas al arranque (`DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `DB_PORT`).

- [ ] **0.4. Actualización de `package.json`**
  - [ ] Añadir dependencias necesarias: `sharp`, `multer`, `uuid`.
  - [ ] Configurar scripts en `package.json`:
    - [ ] `"migrate": "node src/database/runMigration.js"`
    - [ ] `"seed": "node src/database/seeds/runSeed.js"`
    - [ ] `"dev": "nodemon src/app.js"`
    - [ ] `"start": "node src/app.js"`

---

## 📦 MICRO-FASE 1: CATÁLOGO, MULTIMEDIA Y BÚSQUEDA OEM

- [ ] **1.1. Estructura y Capa Común**
  - [ ] Crear utilitario de sanitización `src/common/utils/stringSanitizer.js` (`cleanOemCode`).
  - [ ] Crear middleware de subida en memoria `src/common/middlewares/upload.middleware.js` (Multer con `memoryStorage`, límite 10MB y validación MIME).
  - [ ] Crear servicio de optimización de imágenes `src/modules/catalog/services/imageProcessor.service.js` (Sharp WebP 1200px y thumbnail 300x300).
  - [ ] Configurar servicio de almacenamiento local de imágenes en `uploads/original` y `uploads/thumbs`.
  - [ ] Montar carpeta estática `app.use('/uploads', express.static(...))` en `src/app.js`.

- [ ] **1.2. Módulo de Marcas (`brand`)**
  - [ ] Repositorio `src/modules/catalog/repositories/brand.repository.js`.
  - [ ] Servicio `src/modules/catalog/services/brand.service.js`.
  - [ ] Controlador `src/modules/catalog/controllers/brand.controller.js`.
  - [ ] Rutas `GET /api/v1/catalog/brands` y `POST /api/v1/catalog/brands`.

- [ ] **1.3. Módulo de Repuestos (`item`)**
  - [ ] Mapper `src/modules/catalog/mappers/item.mapper.js`.
  - [ ] Repositorio `src/modules/catalog/repositories/item.repository.js` (CRUD completo).
  - [ ] Servicio `src/modules/catalog/services/item.service.js` (soporte de creación con transacción para imágenes y OEMs).
  - [ ] Controlador `src/modules/catalog/controllers/item.controller.js`.
  - [ ] Endpoint de carga multimedia: `POST /api/v1/catalog/items/:idItem/images` con hasta 5 fotos.
  - [ ] Endpoint de eliminación de fotos: `DELETE /api/v1/catalog/items/:idItem/images/:idImage`.

- [ ] **1.4. Módulo de Códigos OEM y Referencias Cruzadas**
  - [ ] Repositorio `src/modules/catalog/repositories/oem.repository.js`.
  - [ ] Servicio `src/modules/catalog/services/oem.service.js`.
  - [ ] Endpoint para asociar código OEM: `POST /api/v1/catalog/items/:idItem/oems`.
  - [ ] Endpoint para listar códigos OEM por repuesto: `GET /api/v1/catalog/items/:idItem/oems`.

- [ ] **1.5. Búsqueda Avanzada con Trigramas e Índices GIN**
  - [ ] Implementar consulta SQL con operador `%`, `ILIKE` y `clean_oem_code`.
  - [ ] Endpoint `GET /api/v1/catalog/items/search?q=...`.
  - [ ] Probar velocidad y precisión de coincidencias ante texto desordenado o códigos sin guiones.

---

## 🏢 MICRO-FASE 2: INVENTARIO MULTI-SUCURSAL Y ALERTAS DE REPOSICIÓN

- [ ] **2.1. Gestión de Sucursales (`sucursal`)**
  - [ ] Repositorio, servicio y controlador de sucursales.
  - [ ] Rutas `GET /api/v1/inventory/branches` y `POST /api/v1/inventory/branches`.

- [ ] **2.2. Stock Segregado y Coordenadas Físicas**
  - [ ] Repositorio `src/modules/inventory/repositories/inventory.repository.js`:
    - [ ] Consulta de stock por sucursal desglosado en `TIENDA` vs `DEPOSITO`.
    - [ ] Actualización de pasillo, estante y sección (`PUT /api/v1/inventory/branches/:idSucursal/stock/:idItem/location`).
    - [ ] Asignación inicial de stock y umbrales mínimos de exhibición.

- [ ] **2.3. Servicio de Alerta de Reposición Interna**
  - [ ] Repositorio y servicio `src/modules/inventory/services/restockAlert.service.js` consultando `v_alertas_reposicion_interna`.
  - [ ] Endpoint `GET /api/v1/inventory/alerts/restock/:idSucursal`.
  - [ ] Retornar datos detallados: stock actual en mostrador, stock disponible en depósito y coordenadas exactas para que el bodeguero recoja la pieza.

- [ ] **2.4. Traspasos Internos (Depósito -> Tienda) con Kardex**
  - [ ] Implementar transacción atómica: descuenta de `DEPOSITO`, suma en `TIENDA` en la misma sucursal.
  - [ ] Generar doble asiento o asiento balanceado en `inventario_movimiento` con tipo `TRASPASO_TIENDA_DEPOSITO`.
  - [ ] Endpoint `POST /api/v1/inventory/transfers`.

---

## 💳 MICRO-FASE 3: PUNTO DE VENTA (POS) TRANSACCIONAL Y DEVOLUCIONES

- [ ] **3.1. Infraestructura Transaccional Segura**
  - [ ] Implementar helper `withTransaction(callback)` en `src/common/utils/transactionHelper.js`.
  - [ ] Configurar middleware de captura de errores y códigos de respuesta consistentes.

- [ ] **3.2. Venta Transaccional POS con Bloqueo Anti-Concurrencia**
  - [ ] Repositorio de ventas `src/modules/pos/repositories/sale.repository.js` (cabeceras y detalles).
  - [ ] Servicio `src/modules/pos/services/pos.service.js`:
    - [ ] Ordenar array de IDs ascendente (`ORDER BY id_inventario ASC`) para prevenir deadlocks.
    - [ ] Ejecutar `SELECT ... FOR UPDATE` sobre `inventario_stock` en `TIENDA`.
    - [ ] Validar existencias en memoria transaccional (lanzar error `INSUFFICIENT_STOCK` si falta cantidad).
    - [ ] Generar número correlativo de factura (`FAC-XXXXXXXX`).
    - [ ] Insertar cabecera en `venta` y líneas en `venta_detalle`.
    - [ ] Descontar stock con `UPDATE inventario_stock`.
    - [ ] Asentar en `inventario_movimiento` (`VENTA_POS`, cantidad negativa).
  - [ ] Endpoint `POST /api/v1/pos/sales`.
  - [ ] Endpoint de consulta `GET /api/v1/pos/sales/:idVenta`.

- [ ] **3.3. Módulo de Devoluciones (Parciales y Totales)**
  - [ ] Repositorio `src/modules/pos/repositories/return.repository.js`.
  - [ ] Servicio de devolución transaccional `src/modules/pos/services/return.service.js`:
    - [ ] Validar que la venta exista y no esté devuelta en su totalidad.
    - [ ] Validar que las cantidades a devolver no superen las cantidades vendidas en los detalles originales.
    - [ ] Insertar cabecera `devolucion` y líneas `devolucion_detalle`.
    - [ ] Reintegrar stock al inventario (`TIENDA` o `CUARENTENA` según el motivo).
    - [ ] Asentar en `inventario_movimiento` (`DEVOLUCION_POS`, cantidad positiva).
    - [ ] Actualizar estado de la venta (`DEVUELTA_PARCIAL` o `DEVUELTA_TOTAL`).
  - [ ] Endpoint `POST /api/v1/pos/returns`.

---

## 🚛 MICRO-FASE 4: COMPATIBILIDAD CON VEHÍCULOS Y MOTORES (FASE 2)

- [ ] **4.1. Catálogo de Camiones y Motorizaciones**
  - [ ] Repositorio y servicio `src/modules/compatibility/services/truck.service.js`.
  - [ ] Registro de marcas (Kenworth, Freightliner, Mack, International, Volvo, Scania).
  - [ ] Registro de modelos y motores pesados (Cummins X15/ISX, Detroit DD15, Mack MP8, Paccar MX-13).
  - [ ] Endpoints `GET /api/v1/vehicles/trucks` y `POST /api/v1/vehicles/trucks`.

- [ ] **4.2. Matriz de Compatibilidades y Búsqueda Inversa**
  - [ ] Repositorio de relaciones `item_truck_compatibility`.
  - [ ] Endpoint de vinculación: `POST /api/v1/vehicles/compatibility`.
  - [ ] Endpoint de búsqueda inversa: `GET /api/v1/vehicles/trucks/:idTruck/items` (retorna todos los filtros, válvulas y sensores compatibles con ese camión).

---

## 📈 MICRO-FASE 5: ANALÍTICA ESTACIONAL Y PREDICCIÓN DE IMPORTACIONES (FASE 3)

- [ ] **5.1. Analítica de Demanda Estacional**
  - [ ] Crear vista materializada o consulta agregada por trimestre/estación sobre `venta_detalle`.
  - [ ] Endpoint `GET /api/v1/analytics/seasonal-demand` con métricas de rotación por estación.

- [ ] **5.2. Sistema Predictivo de Importaciones (Punto de Reorden)**
  - [ ] Implementar cálculo de Demanda Promedio Diaria ($D_{avg}$) sobre historial de 90/180 días.
  - [ ] Implementar cálculo de Punto de Reorden: $\text{ROP} = (D_{avg} \times \text{Lead Time}) + \text{Stock Seguridad}$.
  - [ ] Endpoint `GET /api/v1/analytics/reorder-points` con reporte de alertas de compra internacional.

---
*Documento vivo. Cada micro-fase debe completarse y validarse antes de transicionar a la siguiente.*
