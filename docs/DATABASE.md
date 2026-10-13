# 🗄️ ESTÁNDAR DE BASE DE DATOS Y CONCURRENCIA ACID (POSTGRESQL NATIVO)

**Documento:** `docs/DATABASE.md`  
**Tecnología:** PostgreSQL 15+  
**Driver de Conexión:** `pg` (node-postgres) con `Pool` gestionado. Prohibido el uso de ORMs.

---

## 1. EL PATRÓN REPOSITORIO CON DRIVER NATIVO

Para mantener el código desacoplado, testeable y preparado para transacciones atómicas, la capa de acceso a datos implementa el **Patrón Repositorio**.

### 1.1. Reglas de Inyección de Clientes
1. Todos los métodos de repositorio deben aceptar un parámetro opcional `client`.
2. Si el parámetro `client` no es proporcionado, el repositorio utiliza el `pool` por defecto para operaciones de lectura o escrituras no transaccionales de una sola sentencia.
3. Si la operación forma parte de una transacción ACID multi-tabla, el servicio **DEBE** inyectar el cliente transaccional (`client`) obtenido de `withTransaction`.

### 1.2. Prohibición Absoluta de Interpolación de Strings (SQL Injection Prevention)
> ⛔ **ESTÁ TERMINANTEMENTE PROHIBIDO EL USO DE TEMPLATE LITERALS `${var}` EN SENTENCIAS SQL.**
> Toda consulta debe usar exclusivamente marcadores de posición posicionales `$1, $2, $3, ...` delegando la sanitización al motor de PostgreSQL.

```javascript
// ❌ INCORRECTO Y VULNERABLE:
const query = `SELECT * FROM item WHERE item_name = '${nombre}'`; // ¡PELIGRO DE INYECCIÓN SQL!

// ✅ CORRECTO Y SEGURO:
const query = `SELECT * FROM item WHERE item_name = $1`;
const { rows } = await client.query(query, [nombre]);
```

### 1.3. Implementación Canónica de Repositorio

```javascript
// src/modules/catalog/repositories/item.repository.js
import pool from '../../../config/database.js';
import { itemMapper } from '../mappers/item.mapper.js';

export const itemRepository = {
  /**
   * Obtiene un ítem por ID inyectando opcionalmente un cliente transaccional
   */
  async findById(idItem, client = pool) {
    const query = `
      SELECT 
        i.*,
        b.brand_name,
        COALESCE(
          json_agg(
            json_build_object(
              'id_image', img.id_image,
              'image_url', img.image_url,
              'thumbnail_url', img.thumbnail_url,
              'is_primary', img.is_primary
            ) ORDER BY img.display_order ASC
          ) FILTER (WHERE img.id_image IS NOT NULL), '[]'
        ) AS images
      FROM item i
      LEFT JOIN brand b ON i.id_brand = b.id_brand
      LEFT JOIN item_image img ON i.id_item = img.id_item
      WHERE i.id_item = $1 AND i.is_active = TRUE
      GROUP BY i.id_item, b.brand_name;
    `;
    const { rows } = await client.query(query, [idItem]);
    return rows.length ? itemMapper.toDomain(rows[0]) : null;
  },

  /**
   * Crea un nuevo ítem dentro del contexto transaccional
   */
  async create(itemData, client = pool) {
    const query = `
      INSERT INTO item (item_name, item_description, id_brand, sku, cost, price)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *;
    `;
    const values = [
      itemData.itemName,
      itemData.itemDescription,
      itemData.idBrand,
      itemData.sku,
      itemData.cost,
      itemData.price
    ];
    const { rows } = await client.query(query, values);
    return itemMapper.toDomain(rows[0]);
  }
};
```

---

## 2. TRANSACCIONES ACID CON EL HELPER `withTransaction`

Para garantizar atomicidad, consistencia, aislamiento y durabilidad (ACID) en operaciones complejas (como registrar una venta, descontar stock de tienda y asentar en el Kardex), se utiliza obligatoriamente el helper centralizado `withTransaction`.

### 2.1. Implementación del Helper Transaccional

```javascript
// src/common/utils/transactionHelper.js
import pool from '../../config/database.js';

/**
 * Ejecuta una operación atómica dentro de una transacción PostgreSQL.
 * Gestiona automáticamente el ciclo de vida: BEGIN, COMMIT, ROLLBACK y release.
 * 
 * @param {Function} callback - Función asíncrona que recibe la instancia del cliente transaccional.
 * @returns {Promise<any>} - Retorna el valor devuelto por el callback si el commit es exitoso.
 */
export const withTransaction = async (callback) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('⚠️ [TRANSACTION ROLLBACK]: Transacción abortada debido a un error:', error.message);
    throw error;
  } finally {
    client.release();
  }
};
```

---

## 3. PROTOCOLO ANTICONCURRENCIA Y PUNTO DE VENTA (POS)

El mayor desafío técnico de un POS automotriz es la **concurrencia de mostradores**: dos cajeros intentan facturar la última unidad existente de un repuesto crítico de forma simultánea.

### 3.1. Riesgos de Condiciones de Carrera (Race Conditions)
Si se realiza un simple `SELECT cantidad FROM inventario_stock` seguido de una verificación en Node.js y un `UPDATE inventario_stock SET cantidad = cantidad - 1`, ambas solicitudes pueden leer stock = 1 simultáneamente, ambas aprobarán la venta, y el stock final será -1 o se venderá mercancía inexistente.

### 3.2. Solución: Bloqueo Pesimista Determinista (`SELECT ... FOR UPDATE`)
1. **Adquisición del Lock de Fila:** Se bloquean las filas en la base de datos hasta que la transacción haga `COMMIT` o `ROLLBACK`.
2. **Ordenamiento Determinista Obligatorio (`ORDER BY id_inventario ASC`):**
   > ⚠️ **PREVENCIÓN DE DEADLOCKS:** Si la Venta A involucra repuestos [10, 25] y la Venta B involucra [25, 10], bloquear sin orden puede causar que la Venta A tome el lock de 10 y espere 25, mientras la Venta B toma el lock de 25 y espera 10, congelando la base de datos (Deadlock).
   > **Regla de Oro:** Siempre ordenar los IDs de los registros de stock de forma ascendente antes de invocar `FOR UPDATE`.
3. **Verificación en Memoria Transaccional:** Se valida el stock bloqueado antes de ejecutar cualquier `UPDATE`.
4. **Restricción de Respaldo a Nivel de Motor:** La columna `cantidad` cuenta con un constraint `CHECK (cantidad >= 0)` que rechazaría automáticamente cualquier descuadre incluso ante un fallo lógico.

### 3.3. Algoritmo Transaccional Canónico de Venta POS

```javascript
// src/modules/pos/services/pos.service.js
import { withTransaction } from '../../../common/utils/transactionHelper.js';
import { saleRepository } from '../repositories/sale.repository.js';
import { inventoryRepository } from '../../inventory/repositories/inventory.repository.js';
import { kardexRepository } from '../../inventory/repositories/kardex.repository.js';

export const createSaleService = async (salePayload, userId) => {
  return await withTransaction(async (client) => {
    const { idSucursal, items, paymentMethod, clientName, clientDoc } = salePayload;
    
    // Extraer y ordenar numéricamente los IDs para prevenir Deadlocks
    const itemIds = [...new Set(items.map(i => i.idItem))].sort((a, b) => a - b);

    // 1. BLOQUEO DETERMINISTA DE FILAS EN TIENDA
    const lockQuery = `
      SELECT id_inventario, id_item, cantidad, stock_minimo, pasillo, estante
      FROM inventario_stock
      WHERE id_sucursal = $1 
        AND tipo_almacen = 'TIENDA' 
        AND id_item = ANY($2::int[])
      ORDER BY id_inventario ASC
      FOR UPDATE;
    `;
    const { rows: lockedStock } = await client.query(lockQuery, [idSucursal, itemIds]);

    // 2. VALIDACIÓN ESTRICTA DE EXISTENCIAS
    for (const itemReq of items) {
      const stockRow = lockedStock.find(s => s.id_item === itemReq.idItem);
      
      if (!stockRow) {
        const error = new Error(`El repuesto ID ${itemReq.idItem} no está registrado en el mostrador de esta sucursal.`);
        error.statusCode = 404;
        error.code = 'ITEM_NOT_FOUND_IN_LOCATION';
        throw error;
      }

      if (stockRow.cantidad < itemReq.quantity) {
        const error = new Error(`Stock insuficiente para repuesto ID ${itemReq.idItem}. Solicitado: ${itemReq.quantity}, Disponible en tienda: ${stockRow.cantidad}`);
        error.statusCode = 409;
        error.code = 'INSUFFICIENT_STOCK';
        throw error;
      }
    }

    // 3. CALCULAR TOTALES Y OBTENER COSTOS REALES
    let subtotal = 0;
    const saleDetails = [];

    for (const itemReq of items) {
      // Obtener costo y precio oficial del ítem
      const itemMasterQuery = `SELECT price, cost FROM item WHERE id_item = $1;`;
      const { rows: [master] } = await client.query(itemMasterQuery, [itemReq.idItem]);
      
      const lineSubtotal = Number(master.price) * itemReq.quantity;
      subtotal += lineSubtotal;

      saleDetails.push({
        idItem: itemReq.idItem,
        quantity: itemReq.quantity,
        unitPrice: Number(master.price),
        unitCost: Number(master.cost),
        subtotal: lineSubtotal
      });
    }

    const total = subtotal; // Agregar lógica de impuestos si aplica

    // 4. INSERTAR CABECERA DE VENTA
    const invoiceNumber = `FAC-${Date.now().toString().slice(-8)}`;
    const saleHeader = await saleRepository.createHeader({
      invoiceNumber,
      idSucursal,
      userId,
      clientName,
      clientDoc,
      subtotal,
      total,
      paymentMethod
    }, client);

    // 5. DESCONTAR STOCK, GUARDAR DETALLES Y ASENTAR EN KARDEX
    for (const detail of saleDetails) {
      const stockRow = lockedStock.find(s => s.id_item === detail.idItem);
      const stockPrevio = stockRow.cantidad;
      const stockPosterior = stockPrevio - detail.quantity;

      // Descontar inventario
      await client.query(`
        UPDATE inventario_stock
        SET cantidad = $1, updated_at = CURRENT_TIMESTAMP
        WHERE id_inventario = $2;
      `, [stockPosterior, stockRow.id_inventario]);

      // Guardar detalle de venta
      await saleRepository.createDetail({
        idVenta: saleHeader.idVenta,
        idItem: detail.idItem,
        quantity: detail.quantity,
        unitPrice: detail.unitPrice,
        unitCost: detail.unitCost,
        subtotal: detail.subtotal,
        warehouseType: 'TIENDA'
      }, client);

      // Asentar en Kardex (Auditoría inmutable)
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
        userResponsible: userId,
        reason: `Venta POS Factura #${invoiceNumber}`
      }, client);
    }

    return saleHeader;
  });
};
```

---

## 4. AUDITORÍA INMUTABLE DE KARDEX (`inventario_movimiento`)

Toda alteración en el stock (`inventario_stock`) debe generar obligatoriamente un registro en `inventario_movimiento` dentro de la **misma transacción**:

| Tipo de Movimiento (`tipo_movimiento`) | Origen (`origen_tipo`) | Destino (`destino_tipo`) | Cantidad registrada |
| :--- | :--- | :--- | :--- |
| `VENTA_POS` | `TIENDA` | `CLIENTE` | Negativa (`-N`) |
| `DEVOLUCION_POS` | `CLIENTE` | `TIENDA` o `CUARENTENA` | Positiva (`+N`) |
| `TRASPASO_TIENDA_DEPOSITO` | `DEPOSITO` | `TIENDA` | `+N` en Tienda / `-N` en Depósito |
| `COMPRA_RECEPCION` | `PROVEEDOR` | `DEPOSITO` | Positiva (`+N`) |
| `AJUSTE_ENTRADA` | `AUDITORIA` | `TIENDA` o `DEPOSITO` | Positiva (`+N`) |
| `AJUSTE_SALIDA` | `TIENDA` o `DEPOSITO` | `MERMA` | Negativa (`-N`) |

---

## 5. BÚSQUEDA AVANZADA CON `pg_trgm` E ÍNDICES GIN

En el rubro de camiones, los mecánicos y clientes buscan repuestos por nombres parciales con faltas ortográficas o códigos de fabricante sin caracteres especiales (`4324102227` vs `432 410 222 7`).

### 5.1. Extensiones e Índices Requeridos
```sql
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- Índices GIN con trigramas para búsqueda difusa (Fuzzy ILIKE)
CREATE INDEX IF NOT EXISTS idx_item_name_trgm ON item USING gin (item_name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_item_oem_code_trgm ON item_oem USING gin (oem_code gin_trgm_ops);

-- Índices B-Tree para coincidencia exacta de código limpio y SKU
CREATE INDEX IF NOT EXISTS idx_item_oem_clean ON item_oem (clean_oem_code);
CREATE INDEX IF NOT EXISTS idx_item_sku ON item (sku);
```

### 5.2. Sanitización de Códigos OEM en JavaScript y SQL
Al almacenar o buscar un código OEM, se remueven todos los caracteres no alfanuméricos:
```javascript
// src/common/utils/stringSanitizer.js
export const cleanOemCode = (code) => {
  if (!code) return '';
  return code.toString().replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
};
```

### 5.3. Consulta Maestra de Búsqueda Predictiva

```sql
SELECT DISTINCT
    i.id_item,
    i.item_name,
    i.sku,
    b.brand_name,
    i.price,
    img.thumbnail_url,
    similarity(i.item_name, $1) AS score
FROM item i
LEFT JOIN brand b ON i.id_brand = b.id_brand
LEFT JOIN item_image img ON i.id_item = img.id_item AND img.is_primary = TRUE
LEFT JOIN item_oem o ON i.id_item = o.id_item
WHERE 
    i.is_active = TRUE AND (
        i.item_name % $1                                    -- Similitud difusa trigram por nombre
        OR i.item_name ILIKE ('%' || $1 || '%')             -- Acelerado por índice GIN
        OR o.clean_oem_code = $2                            -- Coincidencia exacta de código sanitizado
        OR o.oem_code ILIKE ('%' || $1 || '%')              -- Búsqueda parcial de código OEM
        OR b.brand_name ILIKE ('%' || $1 || '%')            -- Búsqueda por marca fabricante
    )
ORDER BY score DESC
LIMIT 20;
```
*Parámetros:*
- `$1`: Término ingresado por el usuario (ej: `"valvula pedal freightliner"`).
- `$2`: Término sanitizado con `cleanOemCode(q)` (ej: `"4324102227"`).
