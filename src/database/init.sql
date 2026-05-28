-- =========================================================================
-- 1. TABLAS MAESTRAS (No dependen de nadie)
-- =========================================================================

CREATE TABLE IF NOT EXISTS item(
    oem_number varchar(20) NOT NULL,
    item_name varchar(50) NOT NULL,
    item_description varchar (120) NOT NULL,
    photo varchar(512), -- url de la imagen en Cloud Storage
    stock INTEGER NOT NULL DEFAULT 0,
    
    CONSTRAINT pk_item PRIMARY KEY (oem_number)
);

CREATE TABLE IF NOT EXISTS truck(
    id_truck SERIAL PRIMARY KEY,
    truck_brand VARCHAR(10),
    truck_model VARCHAR(10),
    first_year INTEGER,
    last_year INTEGER
);

-- =========================================================================
-- 2. TABLAS RELACIONALES Y PUENTES (Muchos a Muchos)
-- =========================================================================

CREATE TABLE IF NOT EXISTS itemtruck(
    oem_number varchar(20) NOT NULL,
    id_truck integer NOT NULL,

    CONSTRAINT fk_oem_item_truck FOREIGN KEY (oem_number) REFERENCES item(oem_number) ON DELETE CASCADE,
    CONSTRAINT fk_truk_item FOREIGN KEY (id_truck) REFERENCES truck(id_truck) ON DELETE CASCADE,
    CONSTRAINT pk_itemtruck PRIMARY KEY (oem_number, id_truck) 
);

CREATE TABLE IF NOT EXISTS recomendation(
    id_item varchar(20),
    id_recomendation varchar(20),

    CONSTRAINT fk_rec_item FOREIGN KEY (id_item) REFERENCES item(oem_number) ON DELETE SET NULL,
    CONSTRAINT fk_rec_target FOREIGN KEY (id_recomendation) REFERENCES item(oem_number) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS compatibility(
    id_item varchar(20),
    id_compatible varchar(20),

    CONSTRAINT fk_comp_item FOREIGN KEY (id_item) REFERENCES item(oem_number) ON DELETE SET NULL,
    CONSTRAINT fk_comp_target FOREIGN KEY (id_compatible) REFERENCES item(oem_number) ON DELETE SET NULL
);

-- =========================================================================
-- 3. SUBTIPOS / HERENCIA (Relaciones 1 a 1 con Item)
-- =========================================================================

CREATE TABLE IF NOT EXISTS seal(
    oem_number VARCHAR(20) NOT NULL,
    height DECIMAL (10,2) DEFAULT 0.0,
    inner_diameter DECIMAL (10,2) DEFAULT 0.0,
    outer_diameter DECIMAL (10,2) DEFAULT 0.0,
    material varchar(10) DEFAULT NULL,

    CONSTRAINT pk_seal PRIMARY KEY (oem_number),
    CONSTRAINT fk_seal FOREIGN KEY (oem_number) REFERENCES item(oem_number) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS bearing(
    oem_number VARCHAR(20) NOT NULL,
    code VARCHAR(20),
    height DECIMAL (10,2) DEFAULT 0.0,
    inner_diameter DECIMAL (10,2) DEFAULT 0.0,
    outer_diameter DECIMAL (10,2) DEFAULT 0.0,
    type_bearing varchar(10) DEFAULT NULL,

    CONSTRAINT pk_bearing PRIMARY KEY (oem_number),
    CONSTRAINT fk_bearing FOREIGN KEY (oem_number) REFERENCES item(oem_number) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS valve(
    oem_number VARCHAR(20) NOT NULL,
    number_inputs INTEGER DEFAULT 0,
    thread DECIMAL (10,2) DEFAULT 0.0,

    CONSTRAINT pk_valve PRIMARY KEY (oem_number),
    CONSTRAINT fk_valve FOREIGN KEY (oem_number) REFERENCES item(oem_number) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS sensor(
    oem_number VARCHAR(20) NOT NULL,
    voltaje INTEGER DEFAULT 24,
    thread DECIMAL (10,2) DEFAULT 0.0,
    pins integer DEFAULT 2,

    CONSTRAINT pk_sensor PRIMARY KEY (oem_number),
    CONSTRAINT fk_sensor FOREIGN KEY (oem_number) REFERENCES item(oem_number) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS repairkit(
    oem_number VARCHAR(20) NOT NULL,
    valve_compatibility VARCHAR(20) NOT NULL,
    type_kit VARCHAR DEFAULT NULL,

    CONSTRAINT pk_repair PRIMARY KEY (oem_number),
    CONSTRAINT fk_repair FOREIGN KEY (oem_number) REFERENCES item(oem_number) ON DELETE CASCADE,
    CONSTRAINT fk_valve_compatibility FOREIGN KEY (valve_compatibility) REFERENCES valve(oem_number) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS repuesto(
    oem_code VARCHAR(20) NOT NULL, 
    number_brand VARCHAR(20) NOT NULL,
    brand VARCHAR(10),
    price DECIMAL (10,2) NOT NULL DEFAULT 0.00,
    cost DECIMAL (10,2) NOT NULL DEFAULT 0.00,
    stock INTEGER NOT NULL DEFAULT 0,
    
    -- ✅ AGREGADO: Clave primaria compuesta para asegurar la integridad de la tabla
    CONSTRAINT pk_repuesto PRIMARY KEY (oem_code, number_brand),
    -- ✅ AGREGADO: Clave foránea que conecta este repuesto comercial con su definición técnica en 'item'
    CONSTRAINT fk_repuesto_item FOREIGN KEY (oem_code) REFERENCES item(oem_number) 
);