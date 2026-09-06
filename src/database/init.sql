-- =========================================================================
-- 1. TABLAS MAESTRAS (No dependen de nadie)
-- =========================================================================

CREATE TABLE IF NOT EXISTS item(
    id_item serial,
    item_name varchar(50) NOT NULL,
    item_description varchar (120) NOT NULL,
    photo varchar(512), -- url de la imagen en Cloud Storage
    stock INTEGER NOT NULL DEFAULT 0,
    
    CONSTRAINT pk_item PRIMARY KEY (id_item)
);

CREATE TABLE IF NOT EXISTS truck(
    id_truck SERIAL PRIMARY KEY,
    truck_brand VARCHAR(30),
    truck_model VARCHAR(10),
    first_year INTEGER,
    last_year INTEGER
);

-- =========================================================================
-- 2. TABLAS RELACIONALES Y PUENTES (Muchos a Muchos)
-- =========================================================================

CREATE TABLE IF NOT EXISTS itemtruck(
    id_item integer NOT NULL,
    id_truck integer NOT NULL,

    CONSTRAINT fk_id_item_truck FOREIGN KEY (id_item) REFERENCES item(id_item) ON DELETE CASCADE,
    CONSTRAINT fk_id_truck_item FOREIGN KEY (id_truck) REFERENCES truck(id_truck) ON DELETE CASCADE,
    CONSTRAINT pk_itemtruck PRIMARY KEY (id_item, id_truck) 
);

CREATE TABLE IF NOT EXISTS recomendation(
    id_item integer,
    id_recomendation integer,

    CONSTRAINT fk_rec_item FOREIGN KEY (id_item) REFERENCES item(id_item) ON DELETE SET NULL,
    CONSTRAINT fk_rec_target FOREIGN KEY (id_recomendation) REFERENCES item(id_item) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS compatibility(
    id_item integer,
    id_compatible integer,

    CONSTRAINT fk_comp_item FOREIGN KEY (id_item) REFERENCES item(id_item) ON DELETE SET NULL,
    CONSTRAINT fk_comp_target FOREIGN KEY (id_compatible) REFERENCES item(id_item) ON DELETE SET NULL
);

-- =========================================================================
-- 3. SUBTIPOS / HERENCIA (Relaciones 1 a 1 con Item)
-- =========================================================================

CREATE TABLE IF NOT EXISTS seal(
    id_item integer NOT NULL,
    height DECIMAL (10,2) DEFAULT 0.0,
    inner_diameter DECIMAL (10,2) DEFAULT 0.0,
    outer_diameter DECIMAL (10,2) DEFAULT 0.0,
    material varchar(10) DEFAULT NULL,

    CONSTRAINT pk_seal PRIMARY KEY (id_item),
    CONSTRAINT fk_seal FOREIGN KEY (id_item) REFERENCES item(id_item) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS bearing(
    id_item integer NOT NULL,
    code VARCHAR(20),
    height DECIMAL (10,2) DEFAULT 0.0,
    inner_diameter DECIMAL (10,2) DEFAULT 0.0,
    outer_diameter DECIMAL (10,2) DEFAULT 0.0,
    type_bearing varchar(10) DEFAULT NULL,

    CONSTRAINT pk_bearing PRIMARY KEY (id_item),
    CONSTRAINT fk_bearing FOREIGN KEY (id_item) REFERENCES item(id_item) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS valve(
    id_item integer NOT NULL,
    number_inputs INTEGER DEFAULT 0,
    thread DECIMAL (10,2) DEFAULT 0.0,

    CONSTRAINT pk_valve PRIMARY KEY (id_item),
    CONSTRAINT fk_valve FOREIGN KEY (id_item) REFERENCES item(id_item) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS sensor(
    id_item integer NOT NULL,
    voltaje INTEGER DEFAULT 24,
    thread DECIMAL (10,2) DEFAULT 0.0,
    pins integer DEFAULT 2,

    CONSTRAINT pk_sensor PRIMARY KEY (id_item),
    CONSTRAINT fk_sensor FOREIGN KEY (id_item) REFERENCES item(id_item) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS repairkit(
    id_item integer NOT NULL,
    valve_compatibility integer NOT NULL,
    type_kit VARCHAR DEFAULT NULL,

    CONSTRAINT pk_repair PRIMARY KEY (id_item),
    CONSTRAINT fk_repair FOREIGN KEY (id_item) REFERENCES item(id_item) ON DELETE CASCADE,
    CONSTRAINT fk_valve_compatibility FOREIGN KEY (valve_compatibility) REFERENCES valve(id_item) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS repuesto (
    id_item INTEGER NOT NULL,
    number_brand VARCHAR(20) NOT NULL,
    id_brand INTEGER NOT NULL, 
    price DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    cost DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    stock INTEGER NOT NULL DEFAULT 0,
    
    CONSTRAINT pk_repuesto PRIMARY KEY (id_item, number_brand),
    CONSTRAINT fk_repuesto_item FOREIGN KEY (id_item) REFERENCES item(id_item) ON DELETE CASCADE,
    CONSTRAINT fk_repuesto_brand FOREIGN KEY (id_brand) REFERENCES brand(id_brand) ON DELETE RESTRICT
);
CREATE TABLE item_oem (
    id_item_oem SERIAL PRIMARY KEY,
    id_item INT NOT NULL,
    oem_code VARCHAR(100) NOT NULL,
    brand VARCHAR(100),
    is_main BOOLEAN DEFAULT FALSE,
    CONSTRAINT fk_itemoem_item FOREIGN KEY (id_item) REFERENCES item(id_item) ON DELETE CASCADE
);

-- Índice para acelerar búsquedas por código OEM
CREATE INDEX idx_item_oem_code ON item_oem(oem_code);-- =========================================================================
-- 1. TABLAS MAESTRAS (No dependen de nadie)
-- =========================================================================

CREATE TABLE IF NOT EXISTS item(
    id_item serial,
    item_name varchar(50) NOT NULL,
    item_description varchar (120) NOT NULL,
    photo varchar(512), -- url de la imagen en Cloud Storage
    stock INTEGER NOT NULL DEFAULT 0,
    
    CONSTRAINT pk_item PRIMARY KEY (id_item)
);

CREATE TABLE IF NOT EXISTS truck(
    id_truck SERIAL PRIMARY KEY,
    truck_brand VARCHAR(30),
    truck_model VARCHAR(10),
    first_year INTEGER,
    last_year INTEGER
);

-- =========================================================================
-- 2. TABLAS RELACIONALES Y PUENTES (Muchos a Muchos)
-- =========================================================================

CREATE TABLE IF NOT EXISTS itemtruck(
    id_item integer NOT NULL,
    id_truck integer NOT NULL,

    CONSTRAINT fk_id_item_truck FOREIGN KEY (id_item) REFERENCES item(id_item) ON DELETE CASCADE,
    CONSTRAINT fk_id_truck_item FOREIGN KEY (id_truck) REFERENCES truck(id_truck) ON DELETE CASCADE,
    CONSTRAINT pk_itemtruck PRIMARY KEY (id_item, id_truck) 
);

CREATE TABLE IF NOT EXISTS recomendation(
    id_item integer,
    id_recomendation integer,

    CONSTRAINT fk_rec_item FOREIGN KEY (id_item) REFERENCES item(id_item) ON DELETE SET NULL,
    CONSTRAINT fk_rec_target FOREIGN KEY (id_recomendation) REFERENCES item(id_item) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS compatibility(
    id_item integer,
    id_compatible integer,

    CONSTRAINT fk_comp_item FOREIGN KEY (id_item) REFERENCES item(id_item) ON DELETE SET NULL,
    CONSTRAINT fk_comp_target FOREIGN KEY (id_compatible) REFERENCES item(id_item) ON DELETE SET NULL
);

-- =========================================================================
-- 3. SUBTIPOS / HERENCIA (Relaciones 1 a 1 con Item)
-- =========================================================================

CREATE TABLE IF NOT EXISTS seal(
    id_item integer NOT NULL,
    height DECIMAL (10,2) DEFAULT 0.0,
    inner_diameter DECIMAL (10,2) DEFAULT 0.0,
    outer_diameter DECIMAL (10,2) DEFAULT 0.0,
    material varchar(10) DEFAULT NULL,

    CONSTRAINT pk_seal PRIMARY KEY (id_item),
    CONSTRAINT fk_seal FOREIGN KEY (id_item) REFERENCES item(id_item) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS bearing(
    id_item integer NOT NULL,
    code VARCHAR(20),
    height DECIMAL (10,2) DEFAULT 0.0,
    inner_diameter DECIMAL (10,2) DEFAULT 0.0,
    outer_diameter DECIMAL (10,2) DEFAULT 0.0,
    type_bearing varchar(10) DEFAULT NULL,

    CONSTRAINT pk_bearing PRIMARY KEY (id_item),
    CONSTRAINT fk_bearing FOREIGN KEY (id_item) REFERENCES item(id_item) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS valve(
    id_item integer NOT NULL,
    number_inputs INTEGER DEFAULT 0,
    thread DECIMAL (10,2) DEFAULT 0.0,

    CONSTRAINT pk_valve PRIMARY KEY (id_item),
    CONSTRAINT fk_valve FOREIGN KEY (id_item) REFERENCES item(id_item) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS sensor(
    id_item integer NOT NULL,
    voltaje INTEGER DEFAULT 24,
    thread DECIMAL (10,2) DEFAULT 0.0,
    pins integer DEFAULT 2,

    CONSTRAINT pk_sensor PRIMARY KEY (id_item),
    CONSTRAINT fk_sensor FOREIGN KEY (id_item) REFERENCES item(id_item) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS repairkit(
    id_item integer NOT NULL,
    valve_compatibility integer NOT NULL,
    type_kit VARCHAR DEFAULT NULL,

    CONSTRAINT pk_repair PRIMARY KEY (id_item),
    CONSTRAINT fk_repair FOREIGN KEY (id_item) REFERENCES item(id_item) ON DELETE CASCADE,
    CONSTRAINT fk_valve_compatibility FOREIGN KEY (valve_compatibility) REFERENCES valve(id_item) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS repuesto(
    id_item integer NOT NULL,
    number_brand VARCHAR(20) NOT NULL,
    brand VARCHAR(10),
    price DECIMAL (10,2) NOT NULL DEFAULT 0.00,
    cost DECIMAL (10,2) NOT NULL DEFAULT 0.00,
    stock INTEGER NOT NULL DEFAULT 0,
    
    -- ✅ AGREGADO: Clave primaria compuesta para asegurar la integridad de la tabla
    CONSTRAINT pk_repuesto PRIMARY KEY (id_item, number_brand),
    -- ✅ AGREGADO: Clave foránea que conecta este repuesto comercial con su definición técnica en 'item'
    CONSTRAINT fk_repuesto_item FOREIGN KEY (id_item) REFERENCES item(id_item)
);
CREATE TABLE item_oem (
    id_item_oem SERIAL PRIMARY KEY,
    id_item INT NOT NULL,
    oem_code VARCHAR(100) NOT NULL,
    brand VARCHAR(100),
    is_main BOOLEAN DEFAULT FALSE,
    CONSTRAINT fk_itemoem_item FOREIGN KEY (id_item) REFERENCES item(id_item) ON DELETE CASCADE
);

-- Índice para acelerar búsquedas por código OEM
CREATE INDEX idx_item_oem_code ON item_oem(oem_code);
ALTER SEQUENCE item_id_item_seq RESTART WITH 101;

CREATE TABLE IF NOT EXISTS brand (
    id_brand SERIAL PRIMARY KEY,
    country VARCHAR(15),
    brand_name VARCHAR(50) NOT NULL UNIQUE,
    logo_url VARCHAR(512)
);