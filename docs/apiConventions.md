# 📡 CONVENCIONES DE API REST Y CONTRATOS DE COMUNICACIÓN

**Documento:** `docs/apiConventions.md`  
**Ámbito:** Backend REST API (`Express 5`) <-> Frontend Web / Terminal Punto de Venta (POS) / Clientes Externos.

---

## 1. FORMATO ESTÁNDAR DE RESPUESTAS JSON

Toda respuesta emitida por el backend, independientemente del módulo o la ruta, debe ajustarse de forma determinista a uno de los dos formatos universales: **Éxito** o **Error**.

### 1.1. Estructura de Éxito (`HTTP 200, 201`)

```json
{
  "success": true,
  "data": {},
  "meta": {
    "total": 150,
    "page": 1,
    "limit": 20,
    "totalPages": 8
  }
}
```

#### Reglas de uso para Éxito:
1. `success`: Booleano `true`.
2. `data`: Objeto `{}` o Array `[]` con el recurso solicitado o creado.
   - En respuestas de un solo elemento (e.g. `GET /items/:id`, `POST /sales`): `data` es un objeto `{ ... }`.
   - En listados: `data` es un arreglo `[ ... ]`.
   - En operaciones sin cuerpo de retorno (e.g. baja lógica): `data` puede ser `null` con mensaje explicativo opcional.
3. `meta`: Objeto opcional incluido **únicamente** en listados paginados o agregaciones analíticas.
   - Si no aplica paginación, el campo `meta` puede omitirse.

### 1.2. Estructura de Error (`HTTP 400, 401, 403, 404, 409, 422, 500`)

```json
{
  "success": false,
  "error": {
    "code": "CODIGO_ERROR_DOMINIO",
    "message": "Descripción clara, comprensible para el cliente o diagnóstico en logs",
    "details": [
      {
        "field": "stock",
        "message": "El stock solicitado supera las existencias disponibles en tienda."
      }
    ]
  }
}
```

#### Reglas de uso para Error:
1. `success`: Booleano `false`.
2. `error.code`: Cadena en formato `SCREAMING_SNAKE_CASE` que tipifica unívocamente el error de negocio (permite al frontend internacionalizar o reaccionar condicionalmente sin parsear el texto del mensaje).
3. `error.message`: Mensaje legible en lenguaje natural que detalla la causa del fallo.
4. `error.details`: Arreglo de objetos (opcional) que desglosa errores a nivel de campo (utilizado principalmente en validaciones `422` o rechazos en lote). Si no hay detalles específicos, debe ser un arreglo vacío `[]`.

---

## 2. CATÁLOGO DE ERRORES DE NEGOCIO Y CÓDIGOS HTTP

El backend clasifica los fallos de acuerdo a la semántica estándar de HTTP combinada con códigos de dominio inmutables:

| Código HTTP | Significado HTTP | Código de Dominio (`error.code`) | Escenario de Disparo |
| :--- | :--- | :--- | :--- |
| **400** | Bad Request | `MALFORMED_JSON` | El cuerpo de la petición no tiene sintaxis JSON válida. |
| **400** | Bad Request | `INVALID_PARAMETER` | Parámetros de ruta o query mal formados (e.g. ID no numérico). |
| **401** | Unauthorized | `AUTHENTICATION_REQUIRED` | No se proveyeron credenciales o token JWT. |
| **401** | Unauthorized | `TOKEN_EXPIRED` | El token de sesión caducó. |
| **403** | Forbidden | `INSUFFICIENT_PERMISSIONS` | El usuario no cuenta con rol para ejecutar la acción (e.g. autorizar devolución sin ser supervisor). |
| **404** | Not Found | `ITEM_NOT_FOUND` | El repuesto solicitado no existe o fue dado de baja lógica. |
| **404** | Not Found | `BRANCH_NOT_FOUND` | La sucursal indicada no existe en el sistema. |
| **404** | Not Found | `SALE_NOT_FOUND` | La factura o venta solicitada no existe. |
| **404** | Not Found | `LOCATION_NOT_FOUND` | La posición física (Pasillo/Estante/Sección) no existe para el ítem. |
| **409** | Conflict | `INSUFFICIENT_STOCK` | La cantidad solicitada en mostrador supera el stock disponible en `inventario_stock`. |
| **409** | Conflict | `OEM_CODE_DUPLICATED` | El código OEM ya se encuentra registrado para esta marca de camión. |
| **409** | Conflict | `SKU_ALREADY_EXISTS` | Intento de registrar un repuesto con SKU preexistente. |
| **409** | Conflict | `SALE_ALREADY_REFUNDED` | Se intenta devolver una venta que ya fue reembolsada totalmente. |
| **409** | Conflict | `DEADLOCK_DETECTED` | Concurrencia detectada en la base de datos (se debe reintentar la transacción). |
| **409** | Conflict | `STOCK_LOCATION_OCCUPIED`| Intento de duplicar la coordenada física para el mismo ítem y almacén. |
| **422** | Unprocessable Entity | `VALIDATION_FAILED` | Errores en esquema de datos (campos requeridos faltantes, tipos inválidos). |
| **422** | Unprocessable Entity | `INVALID_WAREHOUSE_TYPE`| El tipo de almacén especificado no es `TIENDA` ni `DEPOSITO`. |
| **422** | Unprocessable Entity | `INVALID_IMAGE_FORMAT` | Se intentó subir un archivo que no es JPEG, PNG o WebP. |
| **422** | Unprocessable Entity | `IMAGE_SIZE_EXCEEDED` | El peso del archivo de imagen supera los 10 MB permitidos. |
| **500** | Internal Server Error | `DATABASE_CONNECTION_ERROR`| Falla en la adquisición de clientes del pool de PostgreSQL. |
| **500** | Internal Server Error | `TRANSACTION_ROLLBACK_ERROR`| La transacción de venta o traspaso falló internamente y fue revertida. |
| **500** | Internal Server Error | `INTERNAL_SERVER_ERROR`| Excepción no capturada en tiempo de ejecución. |

---

## 3. CONVENCIONES DE NOMENCLATURA Y MAPEADO

### 3.1. Regla de Oro
- **Interfaces HTTP (JSON Requests, JSON Responses, Query Params):** Uso obligatorio de **`camelCase`**.
- **Base de Datos (Tablas, Columnas, Funciones, Vistas):** Uso exclusivo de **`snake_case`**.

### 3.2. Mapeo en Capa Repository / Mapper
El código Node.js debe contener mappers dedicados para transformar la fila cruda de PostgreSQL al contrato de dominio antes de enviarla al cliente:

```javascript
// src/modules/catalog/mappers/item.mapper.js
export const itemMapper = {
  toDomain(row) {
    if (!row) return null;
    return {
      idItem: row.id_item,
      itemName: row.item_name,
      itemDescription: row.item_description,
      idBrand: row.id_brand,
      brandName: row.brand_name || null,
      sku: row.sku,
      cost: parseFloat(row.cost),
      price: parseFloat(row.price),
      isActive: row.is_active,
      createdAt: row.created_at,
      images: row.images ? row.images.map(img => ({
        idImage: img.id_image,
        imageUrl: img.image_url,
        thumbnailUrl: img.thumbnail_url,
        isPrimary: img.is_primary
      })) : []
    };
  },

  toPersistence(dto) {
    return {
      item_name: dto.itemName,
      item_description: dto.itemDescription,
      id_brand: dto.idBrand,
      sku: dto.sku,
      cost: dto.cost,
      price: dto.price
    };
  }
};
```

---

## 4. RUTAS, VERSIONADO Y VERBOS REST

### 4.1. Prefijo y Versionado
Todas las rutas de la API deben incorporar el prefijo global **/api/v1/**.

### 4.2. Estructura de Endpoints Oficial

#### Catálogo y Repuestos (`/api/v1/catalog`)
- `GET /api/v1/catalog/items` - Listado paginado de repuestos (soporta filtros `?page=1&limit=20&brandId=5`).
- `GET /api/v1/catalog/items/search?q=VALVULA+WABCO` - Búsqueda avanzada difusa por Nombre, Marca y OEM con `pg_trgm`.
- `GET /api/v1/catalog/items/:idItem` - Detalle completo de repuesto con sus imágenes, OEMs y especificaciones.
- `POST /api/v1/catalog/items` - Creación de repuesto.
- `PUT /api/v1/catalog/items/:idItem` - Actualización de datos generales.
- `POST /api/v1/catalog/items/:idItem/images` - Carga multipart/form-data de hasta 5 imágenes (Multer + Sharp).
- `DELETE /api/v1/catalog/items/:idItem/images/:idImage` - Eliminación de una foto del repuesto.
- `POST /api/v1/catalog/items/:idItem/oems` - Adición de código OEM o referencia cruzada.
- `GET /api/v1/catalog/brands` - Listado de marcas de fabricantes.

#### Inventario Multi-Sucursal y Almacén (`/api/v1/inventory`)
- `GET /api/v1/inventory/branches` - Listado de sucursales activas.
- `GET /api/v1/inventory/branches/:idSucursal/stock` - Listado de stock en sucursal con desglose Tienda vs. Depósito y coordenadas (Pasillo/Estante/Sección).
- `PUT /api/v1/inventory/branches/:idSucursal/stock/:idItem/location` - Actualización de coordenadas físicas.
- `POST /api/v1/inventory/transfers` - Traspaso interno de mercancía (ej. mover de `DEPOSITO` a `TIENDA` con asiento en Kardex).
- `GET /api/v1/inventory/alerts/restock/:idSucursal` - **Alerta de Reposición Interna**: Retorna repuestos con stock en piso de venta $\le$ mínimo pero con disponibilidad en depósito.

#### Punto de Venta (POS) y Devoluciones (`/api/v1/pos`)
- `POST /api/v1/pos/sales` - **Venta Transaccional ACID**: Descuenta stock con bloqueo `FOR UPDATE`, valida cantidades y genera comprobante y Kardex.
- `GET /api/v1/pos/sales/:idVenta` - Consulta de factura y detalle de ítems vendidos.
- `GET /api/v1/pos/sales` - Listado histórico de ventas filtrado por sucursal, fecha y cajero.
- `POST /api/v1/pos/returns` - **Devolución Transaccional**: Registra devolución parcial/total y reingresa piezas a inventario (`TIENDA` o `CUARENTENA`).

#### Compatibilidad con Camiones (`/api/v1/vehicles`) - *Fase 2*
- `GET /api/v1/vehicles/trucks` - Listado de camiones registrados (marca, modelo, motor, rango de años).
- `GET /api/v1/vehicles/trucks/:idTruck/items` - Consulta inversa: repuestos compatibles con un camión/motor específico.
- `POST /api/v1/vehicles/compatibility` - Vinculación de compatibilidad entre repuesto y camión.

#### Analítica y Predicciones (`/api/v1/analytics`) - *Fase 3*
- `GET /api/v1/analytics/seasonal-demand` - Informe de rotación estacional por trimestre.
- `GET /api/v1/analytics/reorder-points` - Cálculo predictivo de sugerencias de compra por Lead Time.

---

## 5. MIDDLEWARE DE MANEJO GLOBAL DE ERRORES

En `Express 5`, todo error propagado con `next(err)` o lanzado en funciones `async` es capturado de manera automática por el middleware central de errores en `src/common/errors/errorHandler.js`:

```javascript
// src/common/errors/errorHandler.js
export const errorHandler = (err, req, res, next) => {
  const statusCode = err.statusCode || 500;
  const errorCode = err.code || 'INTERNAL_SERVER_ERROR';

  console.error(`[ERROR ${statusCode} - ${errorCode}]:`, err.message);
  if (statusCode === 500) {
    console.error(err.stack);
  }

  res.status(statusCode).json({
    success: false,
    error: {
      code: errorCode,
      message: err.isOperational ? err.message : 'Ha ocurrido un error inesperado en el servidor.',
      details: err.details || []
    }
  });
};
```
