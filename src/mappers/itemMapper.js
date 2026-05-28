import pool from "../config/database.js";

export const itemMapper = {
    toDomain(dbRow) {
        if (!dbRow) return null;

        const baseItem={
            oemNumber: dbRow.oem_number,
            itemName: dbRow.item_name,
            itemDescription: dbRow.item_description,
            photo: dbRow.photo,
            // calculamos el stock
            stock: parseInt(dbRow.stock_total) || parseInt(dbRow.stock)||0
        }
        if (dbRow.tipo_subtipo==='seal'){
            baseItem.especificaciones = {
                height: parseFloat(dbRow.seal_height),
                innerDiameter: parseFloat(dbRow.seal_inner),
                outerDiameter: parseFloat(dbRow.seal_outer),
                material: dbRow.seal_material
            };
        }

        return baseItem;
    },
// GET todos los items con sus datos extras reales (Corregido el SELECT y el GROUP BY)
    async getAllItems() {
        try {
            const query = `
            SELECT 
                i.*, 
                COALESCE(SUM(r.stock), 0) AS stock_total,
                --  AGREGAMOS LOS CAMPOS DE LAS TABLAS HIJAS PARA QUE NO DEN 0 o NULL:
                -- Campos de Seal (Retenes)
                s.height AS seal_height, s.inner_diameter AS seal_inner, s.outer_diameter AS seal_outer, s.material AS seal_material,
                -- Campos de Bearing (Rodamientos)
                b.code AS bearing_code, b.height AS bearing_height, b.inner_diameter AS bearing_inner, b.outer_diameter AS bearing_outer, b.type_bearing AS bearing_type,
                -- Campos de Valve (Válvulas)
                v.number_inputs AS valve_inputs, v.thread AS valve_thread,
                -- Campos de Sensor (Sensores)
                sn.voltaje AS sensor_voltaje, sn.thread AS sensor_thread, sn.pins AS sensor_pins,
                -- Campos de Repairkit (Kits)
                rk.valve_compatibility AS kit_valve_comp, rk.type_kit AS kit_type,
                -- Detector de subtipo al vuelo
                CASE 
                    WHEN s.oem_number IS NOT NULL THEN 'seal'
                    WHEN b.oem_number IS NOT NULL THEN 'bearing'
                    WHEN v.oem_number IS NOT NULL THEN 'valve'
                    WHEN sn.oem_number IS NOT NULL THEN 'sensor'
                    WHEN rk.oem_number IS NOT NULL THEN 'repairkit'
                    ELSE 'general'
                END AS tipo_subtipo
            FROM item i
            LEFT JOIN repuesto r ON i.oem_number = r.oem_code
            LEFT JOIN seal s ON i.oem_number = s.oem_number
            LEFT JOIN bearing b ON i.oem_number = b.oem_number
            LEFT JOIN valve v ON i.oem_number = v.oem_number
            LEFT JOIN sensor sn ON i.oem_number = sn.oem_number
            LEFT JOIN repairkit rk ON i.oem_number = rk.oem_number
            --  OBLIGATORIO: Todas las columnas del SELECT que no usen SUM() deben ir en el GROUP BY
            GROUP BY 
                i.oem_number, 
                s.oem_number, s.height, s.inner_diameter, s.outer_diameter, s.material,
                b.oem_number, b.code, b.height, b.inner_diameter, b.outer_diameter, b.type_bearing,
                v.oem_number, v.number_inputs, v.thread,
                sn.oem_number, sn.voltaje, sn.thread, sn.pins,
                rk.oem_number, rk.valve_compatibility, rk.type_kit;
            `;
            
            const { rows } = await pool.query(query);
            // Ahora que las filas llevan los datos técnicos, toDomain() sí podrá leerlos correctamente
            return rows.map(row => this.toDomain(row));
        } catch (error) {
            console.error(' Error al obtener listado de items:', error.message);
            throw error;
        }
    },
    async getItemByOem(oemNumber) {
        try {
            const query = `
            SELECT 
                i.*, 
                COALESCE(SUM(r.stock), 0) AS stock_total,
                -- Campos de Seal
                s.height AS seal_height, s.inner_diameter AS seal_inner, s.outer_diameter AS seal_outer, s.material AS seal_material,
                -- Campos de Bearing
                b.code AS bearing_code, b.height AS bearing_height, b.inner_diameter AS bearing_inner, b.outer_diameter AS bearing_outer, b.type_bearing AS bearing_type,
                -- Campos de Valve
                v.number_inputs AS valve_inputs, v.thread AS valve_thread,
                -- Campos de Sensor
                sn.voltaje AS sensor_voltaje, sn.thread AS sensor_thread, sn.pins AS sensor_pins,
                -- Campos de Repairkit
                rk.valve_compatibility AS kit_valve_comp, rk.type_kit AS kit_type,
                -- DETECTOR AUTOMÁTICO DE SUBTIPO
                CASE 
                    WHEN s.oem_number IS NOT NULL THEN 'seal'
                    WHEN b.oem_number IS NOT NULL THEN 'bearing'
                    WHEN v.oem_number IS NOT NULL THEN 'valve'
                    WHEN sn.oem_number IS NOT NULL THEN 'sensor'
                    WHEN rk.oem_number IS NOT NULL THEN 'repairkit'
                    ELSE 'general'
                END AS tipo_subtipo
            FROM item i
            LEFT JOIN repuesto r ON i.oem_number = r.oem_code
            LEFT JOIN seal s ON i.oem_number = s.oem_number
            LEFT JOIN bearing b ON i.oem_number = b.oem_number
            LEFT JOIN valve v ON i.oem_number = v.oem_number
            LEFT JOIN sensor sn ON i.oem_number = sn.oem_number
            LEFT JOIN repairkit rk ON i.oem_number = rk.oem_number
            WHERE i.oem_number = $1
            GROUP BY 
                i.oem_number, s.oem_number, s.height, s.inner_diameter, s.outer_diameter, s.material,
                b.oem_number, b.code, b.height, b.inner_diameter, b.outer_diameter, b.type_bearing,
                v.oem_number, v.number_inputs, v.thread,
                sn.oem_number, sn.voltaje, sn.thread, sn.pins,
                rk.oem_number, rk.valve_compatibility, rk.type_kit;
            `;

            const { rows } = await pool.query(query, [oemNumber]);
            return this.toDomain(rows[0]);
        } catch (error) {
            console.error(`Error al obtener datos técnicos del OEM ${oemNumber}:`, error.message);
            throw error;
        }
    },
    // create 
    async createItem(itemData){
        const values =[
            itemData.oemNumber,
            itemData.itemName,
            itemData.itemDescription,
            itemData.photo
        ];
        const query = `
        INSERT INTO item (oem_number, item_name, item_description, photo)
        VALUES ($1, $2, $3, $4)
        RETURNING *;`;

        const { rows } = await pool.query(query, values);
        return this.toDomain(rows[0]);
    },
    //editar
    async updateItem(oemNumber, itemData, sealData = null) {
        // 1. Solicitamos un cliente exclusivo para controlar la transacción
        const client = await pool.connect();
        try {
            await client.query('BEGIN'); // 🚀 Iniciamos la transacción

            // 2. Actualizamos la tabla maestra 'item'
            const itemQuery = `
                UPDATE item 
                SET item_name = $1, item_description = $2, photo = $3
                WHERE oem_number = $4
                RETURNING *;
            `;
            const valuesItem = [
                itemData.itemName,
                itemData.itemDescription,
                itemData.photo,
                oemNumber
            ];
            const { rows: itemRows } = await client.query(itemQuery, valuesItem);

            // Si el ítem no existe en la tabla maestra, no hay nada que actualizar
            if (itemRows.length === 0) {
                await client.query('ROLLBACK');
                return null;
            }

            // 3. Si se enviaron datos de 'seal', actualizamos la tabla especializada
            if (sealData) {
                const sealQuery = `
                    UPDATE seal 
                    SET height = $1, inner_diameter = $2, outer_diameter = $3, material = $4
                    WHERE oem_number = $5;
                `;
                const valuesSeal = [
                    sealData.height,
                    sealData.innerDiameter,
                    sealData.outerDiameter,
                    sealData.material,
                    oemNumber
                ];
                await client.query(sealQuery, valuesSeal);
            }

            await client.query('COMMIT'); // Todo salió bien, guardamos los cambios en GCP

            // 4. Retornamos el ítem completamente actualizado usando tu método de lectura inteligente
            return await this.getItemByOem(oemNumber);

        } catch (error) {
            await client.query('ROLLBACK'); // Deshacer cambios ante cualquier fallo técnico
            console.error(`Error crítico en updateItem para el OEM ${oemNumber}:`, error.message);
            throw error;
        } finally {
            client.release(); // ☁️ Liberamos la conexión para mantener el costo en $0.00
        }
    },

    //delete
    async deleteItem(oemNumber){
        const query = `DELETE FROM item WHERE oem_number = $1 RETURNING *;`;
        const { rows } = await pool.query(query, [oemNumber]);
        return this.toDomain(rows[0]);
        return rows[0] ? true : false;// si se eliminó devuelve true, sino false
    }
};