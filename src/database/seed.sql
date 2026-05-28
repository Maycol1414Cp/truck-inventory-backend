-- =========================================================================
-- SCRIPT DE DATOS INICIALES (SEEDER)
-- =========================================================================

-- 1. Insertar Camiones Maestros
INSERT INTO truck (truck_brand, truck_model, first_year, last_year) VALUES
('Volvo', 'FH16', 2015, 2024),
('Scania', 'R500', 2018, 2025),
('Mercedes', 'Actros', 2016, 2023);

-- 2. Insertar Ítems en el Catálogo Maestro
-- Guardamos URLs simuladas de Google Cloud Storage para que prepares tu Frontend
INSERT INTO item (oem_number, item_name, item_description, photo, stock) VALUES
('OEM-VAL-553', 'Válvula de Freno de Estacionamiento', 'Válvula neumática principal de control de freno para camiones pesados.', 'https://storage.googleapis.com/truck-parts-bucket/valvula_freno.jpg', 15),
('OEM-SEA-991', 'Retén de Cigüeñal Trasero', 'Retén de material Vitón de alta resistencia térmica para motores Volvo D13.', 'https://storage.googleapis.com/truck-parts-bucket/reten_ciguenal.jpg', 40),
('OEM-BEA-102', 'Rodamiento de Maza Delantera', 'Rodamiento cónico de rodillos de alta carga para eje delantero Scania.', 'https://storage.googleapis.com/truck-parts-bucket/rodamiento_maza.jpg', 24),
('OEM-SEN-004', 'Sensor de Presión de Turbo', 'Sensor MAP de 4 pines para sistemas de admisión de aire Mercedes.', 'https://storage.googleapis.com/truck-parts-bucket/sensor_map.jpg', 10),
('OEM-KIT-222', 'Kit de Reparación para Válvula de Freno', 'Juego de gomas, resortes y empaquetaduras para mantenimiento de válvula OEM-VAL-553.', 'https://storage.googleapis.com/truck-parts-bucket/kit_freno.jpg', 8);

-- 3. Conectar Ítems con los Camiones (Muchos a Muchos)
-- Asumiendo que los IDs de los camiones creados arriba son 1, 2 y 3 respectivamente
INSERT INTO itemtruck (oem_number, id_truck) VALUES
('OEM-VAL-553', 1), -- La válvula sirve para el Volvo
('OEM-VAL-553', 2), -- La válvula también sirve para el Scania
('OEM-SEA-991', 1), -- El retén es exclusivo de Volvo
('OEM-BEA-102', 2), -- El rodamiento es para Scania
('OEM-SEN-004', 3); -- El sensor es para Mercedes

-- 4. Población de Datos Específicos (Subtipos / Herencia)

-- Datos técnicos del Retén
INSERT INTO seal (oem_number, height, inner_diameter, outer_diameter, material) VALUES
('OEM-SEA-991', 12.50, 130.00, 160.00, 'Viton');

-- Datos técnicos del Rodamiento
INSERT INTO bearing (oem_number, code, height, inner_diameter, outer_diameter, type_bearing) VALUES
('OEM-BEA-102', 'SET-413', 40.00, 65.00, 120.00, 'Conico');

-- Datos técnicos de la Válvula
INSERT INTO valve (oem_number, number_inputs, thread) VALUES
('OEM-VAL-553', 4, 16.15);

-- Datos técnicos del Sensor
INSERT INTO sensor (oem_number, voltaje, pins) VALUES
('OEM-SEN-004', 24, 4);

-- Datos técnicos del Kit de Reparación (Apunta a la válvula OEM-VAL-553)
INSERT INTO repairkit (oem_number, valve_compatibility, type_kit) VALUES
('OEM-KIT-222', 'OEM-VAL-553', 'Completo');

-- 5. Insertar Precios y Marcas Alternativas Comerciales (Tabla Repuesto)
-- Aquí mapeas los códigos OEM con los repuestos reales que vas a vender y facturar
INSERT INTO repuesto (oem_code, number_brand, brand, price, cost, stock) VALUES
('OEM-VAL-553', 'WAB-472195', 'Wabco', 320.00, 180.00, 10),
('OEM-VAL-553', 'KNORR-K012', 'Knorr', 345.00, 210.00, 5),
('OEM-SEA-991', 'SABO-77210', 'Sabo', 45.00, 15.00, 40),
('OEM-BEA-102', 'SKF-VKBA54', 'SKF', 115.00, 62.00, 24);

-- 6. Insertar Recomendaciones y Compatibilidades Cruzadas entre Repuestos
INSERT INTO recomendation (id_item, id_recomendation) VALUES
('OEM-VAL-553', 'OEM-KIT-222'); -- Si compras la válvula, te recomienda llevar su kit de reparación por si acaso.

INSERT INTO compatibility (id_item, id_compatible) VALUES
('OEM-VAL-553', 'OEM-KIT-222'); -- Son compatibles físicamente entre sí.