-- =========================================================================
-- ESQUEMA MAESTRO DE BASE DE DATOS: INVENTARIO MULTI-SUCURSAL Y POS (TRUCK PARTS)
-- Archivo: src/database/init.sql
-- =========================================================================

-- Extensiones necesarias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- Limpieza controlada de tablas legadas o existentes
DROP VIEW IF EXISTS v_alertas_reposicion_interna CASCADE;
DROP TABLE IF EXISTS devolucion_detalle CASCADE;
DROP TABLE IF EXISTS devolucion CASCADE;
DROP TABLE IF EXISTS venta_detalle CASCADE;
DROP TABLE IF EXISTS venta CASCADE;
DROP TABLE IF EXISTS inventario_movimiento CASCADE;
DROP TABLE IF EXISTS inventario_stock CASCADE;
DROP TABLE IF EXISTS item_truck_compatibility CASCADE;
DROP TABLE IF EXISTS itemtruck CASCADE;
DROP TABLE IF EXISTS truck CASCADE;
DROP TABLE IF EXISTS recomendation CASCADE;
DROP TABLE IF EXISTS compatibility CASCADE;
DROP TABLE IF EXISTS repairkit CASCADE;
DROP TABLE IF EXISTS valve CASCADE;
DROP TABLE IF EXISTS sensor CASCADE;
DROP TABLE IF EXISTS bearing CASCADE;
DROP TABLE IF EXISTS seal CASCADE;
DROP TABLE IF EXISTS repuesto CASCADE;
DROP TABLE IF EXISTS item_oem CASCADE;
DROP TABLE IF EXISTS item_image CASCADE;
DROP TABLE IF EXISTS item CASCADE;
DROP TABLE IF EXISTS brand CASCADE;
DROP TABLE IF EXISTS sucursal CASCADE;

-- =========================================================================
-- 1. TABLAS MAESTRAS DEL CATÁLOGO
-- =========================================================================

-- Marcas de fabricantes de repuestos (Wabco, Bendix, Bosch, Meritor, etc.)
CREATE TABLE IF NOT EXISTS brand (
    id_brand SERIAL PRIMARY KEY,
    brand_name VARCHAR(50) NOT NULL UNIQUE,
    country VARCHAR(30),
    logo_url VARCHAR(512),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Repuestos / Piezas (Catálogo técnico y comercial central)
CREATE TABLE IF NOT EXISTS item (
    id_item SERIAL PRIMARY KEY,
    item_name VARCHAR(100) NOT NULL,
    item_description TEXT NOT NULL,
    id_brand INT REFERENCES brand(id_brand) ON DELETE RESTRICT,
    sku VARCHAR(50) UNIQUE,
    cost DECIMAL(12,2) NOT NULL DEFAULT 0.00 CHECK (cost >= 0),
    price DECIMAL(12,2) NOT NULL DEFAULT 0.00 CHECK (price >= 0),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- =========================================================================
-- 2. MULTIMEDIA POR REPUESTO (MÚLTIPLES FOTOS)
-- =========================================================================
CREATE TABLE IF NOT EXISTS item_image (
    id_image SERIAL PRIMARY KEY,
    id_item INT NOT NULL REFERENCES item(id_item) ON DELETE CASCADE,
    image_url VARCHAR(512) NOT NULL,
    thumbnail_url VARCHAR(512),
    is_primary BOOLEAN NOT NULL DEFAULT FALSE,
    display_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- =========================================================================
-- 3. CÓDIGOS OEM Y REFERENCIAS CRUZADAS (AFTERMARKET)
-- =========================================================================
CREATE TABLE IF NOT EXISTS item_oem (
    id_item_oem SERIAL PRIMARY KEY,
    id_item INT NOT NULL REFERENCES item(id_item) ON DELETE CASCADE,
    oem_code VARCHAR(100) NOT NULL,
    clean_oem_code VARCHAR(100) NOT NULL,
    brand_origin VARCHAR(100),
    oem_type VARCHAR(20) NOT NULL DEFAULT 'ORIGINAL' CHECK (oem_type IN ('ORIGINAL', 'AFTERMARKET', 'CROSS_REFERENCE')),
    is_main BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- =========================================================================
-- 4. SUBTIPOS Y ESPECIFICACIONES TÉCNICAS (1 a 1 CON ITEM)
-- =========================================================================
CREATE TABLE IF NOT EXISTS seal (
    id_item INT PRIMARY KEY REFERENCES item(id_item) ON DELETE CASCADE,
    height DECIMAL(10,2) DEFAULT 0.0,
    inner_diameter DECIMAL(10,2) DEFAULT 0.0,
    outer_diameter DECIMAL(10,2) DEFAULT 0.0,
    material VARCHAR(30)
);

CREATE TABLE IF NOT EXISTS bearing (
    id_item INT PRIMARY KEY REFERENCES item(id_item) ON DELETE CASCADE,
    bearing_code VARCHAR(30),
    height DECIMAL(10,2) DEFAULT 0.0,
    inner_diameter DECIMAL(10,2) DEFAULT 0.0,
    outer_diameter DECIMAL(10,2) DEFAULT 0.0,
    bearing_type VARCHAR(30)
);

CREATE TABLE IF NOT EXISTS valve (
    id_item INT PRIMARY KEY REFERENCES item(id_item) ON DELETE CASCADE,
    number_inputs INT DEFAULT 0,
    thread_size DECIMAL(10,2) DEFAULT 0.0,
    valve_type VARCHAR(30)
);

CREATE TABLE IF NOT EXISTS sensor (
    id_item INT PRIMARY KEY REFERENCES item(id_item) ON DELETE CASCADE,
    voltage INT DEFAULT 24,
    thread_size DECIMAL(10,2) DEFAULT 0.0,
    pins_count INT DEFAULT 2
);

CREATE TABLE IF NOT EXISTS repairkit (
    id_item INT PRIMARY KEY REFERENCES item(id_item) ON DELETE CASCADE,
    valve_compatibility INT REFERENCES valve(id_item) ON DELETE SET NULL,
    kit_type VARCHAR(50)
);

-- =========================================================================
-- 5. COMPATIBILIDAD CON VEHÍCULOS (CAMIONES Y MOTORIZACIÓN - FASE 2)
-- =========================================================================
CREATE TABLE IF NOT EXISTS truck (
    id_truck SERIAL PRIMARY KEY,
    truck_brand VARCHAR(50) NOT NULL,
    truck_model VARCHAR(50) NOT NULL,
    engine_model VARCHAR(80),
    first_year INT NOT NULL,
    last_year INT,
    notes TEXT
);

CREATE TABLE IF NOT EXISTS item_truck_compatibility (
    id_item INT NOT NULL REFERENCES item(id_item) ON DELETE CASCADE,
    id_truck INT NOT NULL REFERENCES truck(id_truck) ON DELETE CASCADE,
    position_note VARCHAR(100),
    PRIMARY KEY (id_item, id_truck)
);

-- =========================================================================
-- 6. MULTI-SUCURSAL Y GESTIÓN DE UBICACIÓN FÍSICA
-- =========================================================================
CREATE TABLE IF NOT EXISTS sucursal (
    id_sucursal SERIAL PRIMARY KEY,
    code VARCHAR(20) NOT NULL UNIQUE,
    name VARCHAR(100) NOT NULL,
    address TEXT NOT NULL,
    phone VARCHAR(30),
    is_main_hub BOOLEAN NOT NULL DEFAULT FALSE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Stock físico segregado: Piso de Venta (TIENDA) vs. Almacén Central (DEPOSITO)
CREATE TABLE IF NOT EXISTS inventario_stock (
    id_inventario SERIAL PRIMARY KEY,
    id_item INT NOT NULL REFERENCES item(id_item) ON DELETE RESTRICT,
    id_sucursal INT NOT NULL REFERENCES sucursal(id_sucursal) ON DELETE RESTRICT,
    tipo_almacen VARCHAR(20) NOT NULL CHECK (tipo_almacen IN ('TIENDA', 'DEPOSITO')),
    pasillo VARCHAR(20) NOT NULL DEFAULT 'S/P',
    estante VARCHAR(20) NOT NULL DEFAULT 'S/E',
    seccion VARCHAR(20) NOT NULL DEFAULT 'S/S',
    cantidad INT NOT NULL DEFAULT 0 CHECK (cantidad >= 0),
    stock_minimo INT NOT NULL DEFAULT 0 CHECK (stock_minimo >= 0),
    stock_maximo INT DEFAULT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_stock_location UNIQUE (id_item, id_sucursal, tipo_almacen, pasillo, estante, seccion)
);

-- Kardex de auditoría / Movimientos de inventario
CREATE TABLE IF NOT EXISTS inventario_movimiento (
    id_movimiento SERIAL PRIMARY KEY,
    id_item INT NOT NULL REFERENCES item(id_item) ON DELETE RESTRICT,
    id_sucursal INT NOT NULL REFERENCES sucursal(id_sucursal) ON DELETE RESTRICT,
    tipo_movimiento VARCHAR(30) NOT NULL CHECK (tipo_movimiento IN (
        'VENTA_POS', 'DEVOLUCION_POS', 'TRASPASO_TIENDA_DEPOSITO', 
        'TRASPASO_SUCURSAL', 'AJUSTE_ENTRADA', 'AJUSTE_SALIDA', 'COMPRA_RECEPCION'
    )),
    origen_tipo VARCHAR(20),
    destino_tipo VARCHAR(20),
    cantidad INT NOT NULL CHECK (cantidad != 0),
    stock_previo INT NOT NULL,
    stock_posterior INT NOT NULL,
    referencia_id INT,
    usuario_responsable VARCHAR(100),
    motivo TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- =========================================================================
-- 7. MÓDULO DE PUNTO DE VENTA (POS) Y DEVOLUCIONES
-- =========================================================================
CREATE TABLE IF NOT EXISTS venta (
    id_venta SERIAL PRIMARY KEY,
    numero_factura VARCHAR(50) NOT NULL UNIQUE,
    id_sucursal INT NOT NULL REFERENCES sucursal(id_sucursal) ON DELETE RESTRICT,
    cliente_nombre VARCHAR(120) DEFAULT 'CLIENTE GENERAL',
    cliente_documento VARCHAR(30),
    vendedor_id INT,
    subtotal DECIMAL(12,2) NOT NULL DEFAULT 0.00 CHECK (subtotal >= 0),
    impuesto DECIMAL(12,2) NOT NULL DEFAULT 0.00 CHECK (impuesto >= 0),
    descuento DECIMAL(12,2) NOT NULL DEFAULT 0.00 CHECK (descuento >= 0),
    total DECIMAL(12,2) NOT NULL DEFAULT 0.00 CHECK (total >= 0),
    metodo_pago VARCHAR(30) NOT NULL CHECK (metodo_pago IN ('EFECTIVO', 'TARJETA', 'TRANSFERENCIA', 'CREDITO', 'MIXTO')),
    estado VARCHAR(20) NOT NULL DEFAULT 'COMPLETADA' CHECK (estado IN ('COMPLETADA', 'ANULADA', 'DEVUELTA_PARCIAL', 'DEVUELTA_TOTAL')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS venta_detalle (
    id_detalle SERIAL PRIMARY KEY,
    id_venta INT NOT NULL REFERENCES venta(id_venta) ON DELETE CASCADE,
    id_item INT NOT NULL REFERENCES item(id_item) ON DELETE RESTRICT,
    tipo_almacen_origen VARCHAR(20) NOT NULL DEFAULT 'TIENDA' CHECK (tipo_almacen_origen IN ('TIENDA', 'DEPOSITO')),
    cantidad INT NOT NULL CHECK (cantidad > 0),
    precio_unitario DECIMAL(12,2) NOT NULL CHECK (precio_unitario >= 0),
    costo_unitario DECIMAL(12,2) NOT NULL CHECK (costo_unitario >= 0),
    descuento DECIMAL(12,2) NOT NULL DEFAULT 0.00 CHECK (descuento >= 0),
    subtotal DECIMAL(12,2) NOT NULL CHECK (subtotal >= 0)
);

CREATE TABLE IF NOT EXISTS devolucion (
    id_devolucion SERIAL PRIMARY KEY,
    id_venta INT NOT NULL REFERENCES venta(id_venta) ON DELETE RESTRICT,
    id_sucursal INT NOT NULL REFERENCES sucursal(id_sucursal) ON DELETE RESTRICT,
    tipo_devolucion VARCHAR(20) NOT NULL CHECK (tipo_devolucion IN ('PARCIAL', 'TOTAL')),
    motivo TEXT NOT NULL,
    monto_reembolso DECIMAL(12,2) NOT NULL CHECK (monto_reembolso >= 0),
    metodo_reembolso VARCHAR(30) NOT NULL,
    autorizado_por VARCHAR(100),
    estado VARCHAR(20) NOT NULL DEFAULT 'APROBADA' CHECK (estado IN ('PENDIENTE', 'APROBADA', 'RECHAZADA')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS devolucion_detalle (
    id_devolucion_detalle SERIAL PRIMARY KEY,
    id_devolucion INT NOT NULL REFERENCES devolucion(id_devolucion) ON DELETE CASCADE,
    id_detalle_venta INT NOT NULL REFERENCES venta_detalle(id_detalle) ON DELETE RESTRICT,
    id_item INT NOT NULL REFERENCES item(id_item) ON DELETE RESTRICT,
    cantidad INT NOT NULL CHECK (cantidad > 0),
    destino_almacen VARCHAR(20) NOT NULL DEFAULT 'TIENDA' CHECK (destino_almacen IN ('TIENDA', 'DEPOSITO', 'CUARENTENA')),
    monto_unitario DECIMAL(12,2) NOT NULL CHECK (monto_unitario >= 0),
    subtotal DECIMAL(12,2) NOT NULL CHECK (subtotal >= 0)
);

-- =========================================================================
-- 8. ÍNDICES DE ALTO RENDIMIENTO (B-TREE Y GIN TRIGRAM)
-- =========================================================================

-- Catálogo de ítems
CREATE INDEX IF NOT EXISTS idx_item_name_trgm ON item USING gin (item_name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_item_brand ON item (id_brand);
CREATE INDEX IF NOT EXISTS idx_item_sku ON item (sku);

-- Códigos OEM
CREATE INDEX IF NOT EXISTS idx_item_oem_clean ON item_oem (clean_oem_code);
CREATE INDEX IF NOT EXISTS idx_item_oem_code_trgm ON item_oem USING gin (oem_code gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_item_oem_item ON item_oem (id_item);

-- Stock e Inventario
CREATE INDEX IF NOT EXISTS idx_stock_lookup ON inventario_stock (id_sucursal, tipo_almacen, id_item);
CREATE INDEX IF NOT EXISTS idx_stock_item ON inventario_stock (id_item);
CREATE INDEX IF NOT EXISTS idx_movimiento_item_sucursal ON inventario_movimiento (id_item, id_sucursal, created_at DESC);

-- Ventas y POS
CREATE INDEX IF NOT EXISTS idx_venta_sucursal_fecha ON venta (id_sucursal, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_venta_detalle_item ON venta_detalle (id_item);

-- =========================================================================
-- 9. VISTA: ALERTAS DE REPOSICIÓN TIENDA VS. DEPÓSITO
-- =========================================================================
CREATE OR REPLACE VIEW v_alertas_reposicion_interna AS
SELECT 
    s.id_sucursal,
    s.name AS sucursal_nombre,
    i.id_item,
    i.item_name,
    i.sku,
    b.brand_name,
    COALESCE(st_tienda.cantidad, 0) AS stock_tienda,
    COALESCE(st_tienda.stock_minimo, 1) AS stock_minimo_tienda,
    st_tienda.pasillo AS tienda_pasillo,
    st_tienda.estante AS tienda_estante,
    st_tienda.seccion AS tienda_seccion,
    COALESCE(st_deposito.cantidad, 0) AS stock_deposito_disponible,
    st_deposito.pasillo AS deposito_pasillo,
    st_deposito.estante AS deposito_estante,
    st_deposito.seccion AS deposito_seccion
FROM item i
JOIN sucursal s ON s.is_active = TRUE
LEFT JOIN brand b ON i.id_brand = b.id_brand
LEFT JOIN inventario_stock st_tienda ON st_tienda.id_item = i.id_item 
    AND st_tienda.id_sucursal = s.id_sucursal 
    AND st_tienda.tipo_almacen = 'TIENDA'
LEFT JOIN inventario_stock st_deposito ON st_deposito.id_item = i.id_item 
    AND st_deposito.id_sucursal = s.id_sucursal 
    AND st_deposito.tipo_almacen = 'DEPOSITO'
WHERE 
    COALESCE(st_tienda.cantidad, 0) <= COALESCE(st_tienda.stock_minimo, 1)
    AND COALESCE(st_deposito.cantidad, 0) > 0;