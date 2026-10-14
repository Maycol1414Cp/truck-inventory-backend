-- =========================================================================
-- DATOS DEMO / SEMILLAS PARA DESARROLLO (TRUCK PARTS)
-- Archivo: src/database/seeds/seed.sql
-- =========================================================================

-- Limpieza controlada en orden inverso de dependencias
TRUNCATE TABLE devolucion_detalle CASCADE;
TRUNCATE TABLE devolucion CASCADE;
TRUNCATE TABLE venta_detalle CASCADE;
TRUNCATE TABLE venta CASCADE;
TRUNCATE TABLE inventario_movimiento CASCADE;
TRUNCATE TABLE inventario_stock CASCADE;
TRUNCATE TABLE item_truck_compatibility CASCADE;
TRUNCATE TABLE truck CASCADE;
TRUNCATE TABLE item_image CASCADE;
TRUNCATE TABLE item_oem CASCADE;
TRUNCATE TABLE seal CASCADE;
TRUNCATE TABLE bearing CASCADE;
TRUNCATE TABLE valve CASCADE;
TRUNCATE TABLE sensor CASCADE;
TRUNCATE TABLE repairkit CASCADE;
TRUNCATE TABLE item CASCADE;
TRUNCATE TABLE brand CASCADE;
TRUNCATE TABLE sucursal CASCADE;

-- Reinicio de secuencias
ALTER SEQUENCE IF EXISTS brand_id_brand_seq RESTART WITH 1;
ALTER SEQUENCE IF EXISTS item_id_item_seq RESTART WITH 1;
ALTER SEQUENCE IF EXISTS sucursal_id_sucursal_seq RESTART WITH 1;
ALTER SEQUENCE IF EXISTS truck_id_truck_seq RESTART WITH 1;
ALTER SEQUENCE IF EXISTS inventario_stock_id_inventario_seq RESTART WITH 1;
ALTER SEQUENCE IF EXISTS inventario_movimiento_id_movimiento_seq RESTART WITH 1;
ALTER SEQUENCE IF EXISTS venta_id_venta_seq RESTART WITH 1;
ALTER SEQUENCE IF EXISTS devolucion_id_devolucion_seq RESTART WITH 1;

-- =========================================================================
-- 1. SUCURSALES (2 Sucursales)
-- =========================================================================
INSERT INTO sucursal (code, name, address, phone, is_main_hub, is_active) VALUES
('SUC-01', 'Casa Matriz - Almacén Central', 'Av. Intercomunal Zona Industrial Sur, Galpón 4', '+58 241 8765432', TRUE, TRUE),
('SUC-02', 'Sucursal Norte - Mostrador Comercial', 'Carretera Nacional Km 15, Sector Los Guayos', '+58 241 8765433', FALSE, TRUE);

-- =========================================================================
-- 2. MARCAS FABRICANTES (5 Marcas de Repuestos Pesados)
-- =========================================================================
INSERT INTO brand (brand_name, country, logo_url) VALUES
('Wabco', 'Alemania', 'https://storage.googleapis.com/truck-parts-demo/brands/wabco.webp'),
('Bendix', 'EE.UU.', 'https://storage.googleapis.com/truck-parts-demo/brands/bendix.webp'),
('Bosch', 'Alemania', 'https://storage.googleapis.com/truck-parts-demo/brands/bosch.webp'),
('Meritor', 'EE.UU.', 'https://storage.googleapis.com/truck-parts-demo/brands/meritor.webp'),
('Fleetguard', 'EE.UU.', 'https://storage.googleapis.com/truck-parts-demo/brands/fleetguard.webp');

-- =========================================================================
-- 3. CAMIONES DEMO (5 Modelos y Motorizaciones Pesadas)
-- =========================================================================
INSERT INTO truck (truck_brand, truck_model, engine_model, first_year, last_year, notes) VALUES
('Freightliner', 'Cascadia', 'Detroit DD15 14.8L', 2012, 2024, 'Chasis estándar de carretera 6x4'),
('Kenworth', 'T680', 'Cummins X15 15.0L', 2014, 2024, 'Transmisión Eaton UltraShift / Endurant'),
('Mack', 'Anthem', 'Mack MP8 13.0L', 2018, 2024, 'Sistema mDRIVE 12 velocidades'),
('Volvo', 'VNL 760', 'Volvo D13 12.8L', 2015, 2024, 'Frenos neumáticos EBS y sensor de radar'),
('International', 'LT Series', 'Cummins X15 15.0L', 2017, 2024, 'Sistema neumático Bendix Wingman');

-- =========================================================================
-- 4. REPUESTOS / ÍTEMS (10 Repuestos Típicos de Camión)
-- =========================================================================
INSERT INTO item (id_item, item_name, item_description, id_brand, sku, cost, price, is_active) VALUES
(1, 'Válvula Pedal de Freno Neumático Doble Circuito', 'Válvula de freno de servicio doble para Freightliner y Kenworth', 1, 'VAL-WAB-001', 120.00, 185.00, TRUE),
(2, 'Compresor de Aire Bicilíndrico Bendix BA-921', 'Compresor enfriado por agua con desplazamiento de 15.8 CFM', 2, 'COM-BEN-002', 450.00, 680.00, TRUE),
(3, 'Sensor de Velocidad de Rueda ABS 24V Recto', 'Sensor inductivo para freno neumático antibloqueo', 3, 'SEN-BOS-003', 35.00, 65.00, TRUE),
(4, 'Filtro Separador de Combustible y Agua FS1000', 'Filtro roscado Stratapore con purga para motores Cummins y Detroit', 5, 'FIL-FLE-004', 22.00, 38.00, TRUE),
(5, 'Rodamiento de Maza Trasera Cónico HM212049', 'Juego de cono y taza para eje de tracción Meritor RT-40-145', 4, 'ROD-MER-005', 55.00, 89.00, TRUE),
(6, 'Válvula Gobernadora de Presión de Aire D-2', 'Válvula reguladora para compresor corte 125 PSI / carga 100 PSI', 2, 'VAL-BEN-006', 28.00, 45.00, TRUE),
(7, 'Cámara de Freno Doble Tipo 30/30 Sellada', 'Actuador de resorte para freno de parqueo y servicio de eje pesado', 1, 'PUL-WAB-007', 48.00, 75.00, TRUE),
(8, 'Kit de Empacaduras y Sellos para Válvula Pedal', 'Juego de reparación completa con resortes y diafragmas internos', 1, 'KIT-WAB-008', 18.00, 32.00, TRUE),
(9, 'Retén de Aceite para Eje Delantero Serie Pro', 'Retén de sello positivo para eje direccional Meritor FG-941', 4, 'RET-MER-009', 12.00, 22.00, TRUE),
(10, 'Sensor de Presión de Aceite de Motor Detroit DD15', 'Sensor de 3 pines rosca M14x1.5 para línea de lubricación DD15', 3, 'SEN-BOS-010', 42.00, 72.00, TRUE);

ALTER SEQUENCE item_id_item_seq RESTART WITH 11;

-- =========================================================================
-- 5. SUBTIPOS TÉCNICOS ESPECÍFICOS
-- =========================================================================
INSERT INTO valve (id_item, number_inputs, thread_size, valve_type) VALUES
(1, 4, 0.50, 'Pedal E-6'),
(6, 2, 0.25, 'Gobernadora D-2');

INSERT INTO sensor (id_item, voltage, thread_size, pins_count) VALUES
(3, 24, 0.00, 2),
(10, 24, 14.00, 3);

INSERT INTO bearing (id_item, bearing_code, height, inner_diameter, outer_diameter, bearing_type) VALUES
(5, 'HM212049/11', 53.97, 66.67, 122.23, 'Cónico');

INSERT INTO seal (id_item, height, inner_diameter, outer_diameter, material) VALUES
(9, 14.30, 114.30, 146.10, 'Viton');

INSERT INTO repairkit (id_item, valve_compatibility, kit_type) VALUES
(8, 1, 'Reparación Mayor');

-- =========================================================================
-- 6. CÓDIGOS OEM Y REFERENCIAS CRUZADAS (AFTERMARKET)
-- =========================================================================
INSERT INTO item_oem (id_item, oem_code, clean_oem_code, brand_origin, oem_type, is_main) VALUES
(1, '472 500 007 2', '4725000072', 'Freightliner', 'ORIGINAL', TRUE),
(1, 'A0044293844', 'A0044293844', 'Mercedes-Benz', 'CROSS_REFERENCE', FALSE),
(2, '5011016', '5011016', 'Bendix', 'ORIGINAL', TRUE),
(2, 'BW 5011016', 'BW5011016', 'Kenworth', 'CROSS_REFERENCE', FALSE),
(3, '0 265 050 075', '0265050075', 'Volvo', 'ORIGINAL', TRUE),
(4, 'FS1000', 'FS1000', 'Cummins', 'ORIGINAL', TRUE),
(4, '33439', '33439', 'Wix Filters', 'AFTERMARKET', FALSE),
(5, 'HM212049', 'HM212049', 'Timken', 'ORIGINAL', TRUE),
(6, '275491', '275491', 'Bendix', 'ORIGINAL', TRUE),
(7, 'NT3030LS80', 'NT3030LS80', 'MGM Brakes', 'AFTERMARKET', TRUE),
(8, '472 500 000 2', '4725000002', 'Wabco', 'ORIGINAL', TRUE),
(9, 'A-1205-X-2728', 'A1205X2728', 'Meritor', 'ORIGINAL', TRUE),
(10, 'A0071534328', 'A0071534328', 'Detroit Diesel', 'ORIGINAL', TRUE);

-- =========================================================================
-- 7. COMPATIBILIDAD CAMIÓN - REPUESTO
-- =========================================================================
INSERT INTO item_truck_compatibility (id_item, id_truck, position_note) VALUES
(1, 1, 'Pedal de cabina conductor'),
(1, 2, 'Pedal de cabina conductor'),
(2, 1, 'Montaje lateral motor lado izquierdo'),
(4, 1, 'Filtro primario de combustible chasis'),
(4, 2, 'Filtro primario de combustible chasis'),
(4, 5, 'Filtro primario de combustible chasis'),
(10, 1, 'Bloque motor lado escape');

-- =========================================================================
-- 8. INVENTARIO SEGREGADO (TIENDA VS DEPÓSITO Y COORDENADAS)
-- Casos diseñados para validar alertas de reposición:
-- - Ítem 1: Tienda = 0, Depósito = 8 (¡ALERTA QUIEBRE EN TIENDA!)
-- - Ítem 4: Tienda = 1, Depósito = 25 con stock_minimo = 3 (¡ALERTA MÍNIMO EN TIENDA!)
-- =========================================================================
INSERT INTO inventario_stock (id_item, id_sucursal, tipo_almacen, pasillo, estante, seccion, cantidad, stock_minimo, stock_maximo) VALUES
-- Ítem 1: Válvula Pedal (TIENDA EN 0, EXISTENCIA EN DEPÓSITO)
(1, 1, 'TIENDA',   'P-01', 'E-02', 'S-01', 0,  2, 10),
(1, 1, 'DEPOSITO', 'P-10', 'E-04', 'S-03', 8,  0, 20),

-- Ítem 2: Compresor Bendix (Stock normal)
(2, 1, 'TIENDA',   'P-01', 'E-05', 'S-02', 2,  1, 5),
(2, 1, 'DEPOSITO', 'P-12', 'E-01', 'S-01', 5,  0, 10),

-- Ítem 3: Sensor ABS
(3, 1, 'TIENDA',   'P-02', 'E-01', 'S-04', 4,  2, 15),
(3, 1, 'DEPOSITO', 'P-11', 'E-03', 'S-02', 12, 0, 30),

-- Ítem 4: Filtro FS1000 (TIENDA EN 1 <= MINIMO 3, DEPÓSITO TIENE 25)
(4, 1, 'TIENDA',   'P-03', 'E-01', 'S-01', 1,  3, 10),
(4, 1, 'DEPOSITO', 'P-14', 'E-02', 'S-01', 25, 0, 50),

-- Ítem 5: Rodamiento Meritor
(5, 1, 'TIENDA',   'P-04', 'E-03', 'S-02', 6,  2, 10),
(5, 1, 'DEPOSITO', 'P-15', 'E-05', 'S-01', 18, 0, 40),

-- Ítem 6: Gobernadora D-2
(6, 1, 'TIENDA',   'P-01', 'E-02', 'S-03', 5,  1, 8),
(6, 1, 'DEPOSITO', 'P-10', 'E-02', 'S-01', 10, 0, 20),

-- Ítem 7: Pulmón de Freno
(7, 1, 'TIENDA',   'P-05', 'E-01', 'S-01', 4,  2, 12),
(7, 1, 'DEPOSITO', 'P-16', 'E-03', 'S-02', 16, 0, 35),

-- Ítem 8: Kit Reparación Válvula
(8, 1, 'TIENDA',   'P-01', 'E-02', 'S-02', 3,  1, 6),
(8, 1, 'DEPOSITO', 'P-10', 'E-04', 'S-04', 15, 0, 25),

-- Ítem 9: Retén Meritor
(9, 1, 'TIENDA',   'P-04', 'E-02', 'S-01', 8,  2, 15),
(9, 1, 'DEPOSITO', 'P-15', 'E-01', 'S-02', 20, 0, 40),

-- Ítem 10: Sensor Aceite DD15
(10, 1, 'TIENDA',  'P-02', 'E-03', 'S-01', 3,  1, 6),
(10, 1, 'DEPOSITO', 'P-11', 'E-04', 'S-03', 7,  0, 15),

-- Stock para Sucursal 02 (Sucursal Norte)
(1, 2, 'TIENDA',   'P-01', 'E-01', 'S-01', 2,  1, 5),
(2, 2, 'TIENDA',   'P-02', 'E-01', 'S-01', 1,  1, 3),
(4, 2, 'TIENDA',   'P-03', 'E-02', 'S-01', 5,  2, 10);

-- =========================================================================
-- 9. ASIENTOS INICIALES DE AUDITORÍA EN KARDEX (`inventario_movimiento`)
-- =========================================================================
INSERT INTO inventario_movimiento (id_item, id_sucursal, tipo_movimiento, origen_tipo, destino_tipo, cantidad, stock_previo, stock_posterior, referencia_id, usuario_responsable, motivo)
VALUES
(1, 1, 'COMPRA_RECEPCION', 'PROVEEDOR', 'DEPOSITO', 8, 0, 8, 1001, 'SISTEMA_SEED', 'Recepción de lote inicial Wabco'),
(2, 1, 'COMPRA_RECEPCION', 'PROVEEDOR', 'DEPOSITO', 5, 0, 5, 1002, 'SISTEMA_SEED', 'Recepción de compresores Bendix'),
(4, 1, 'COMPRA_RECEPCION', 'PROVEEDOR', 'DEPOSITO', 25, 0, 25, 1003, 'SISTEMA_SEED', 'Recepción filtros Fleetguard'),
(4, 1, 'TRASPASO_TIENDA_DEPOSITO', 'DEPOSITO', 'TIENDA', 1, 0, 1, 1004, 'SISTEMA_SEED', 'Abastecimiento de exhibición en mostrador');
