import e from "cors";
import pool from "../config/database.js";

const bearingMapper = {

    toDomain(dbRow) {
        if (!dbRow) return null;
        return {
            oemNumber: dbRow.id_item,
            itemName: dbRow.item_name,
            itemDescription: dbRow.item_description,
            photo: dbRow.photo,
            stock: parseInt(dbRow.stock_total) || 0,
            tipo: 'bearing',
            especificaciones: {
                oemNumber: dbRow.id_item,
                code: dbRow.code,
                height: parseFloat(dbRow.height),
                innerDiameter: parseFloat(dbRow.inner_diameter),
                outerDiameter: parseFloat(dbRow.outer_diameter),
                typeBearing: dbRow.type_bearing
            }
        };
    },

    async getBearingByOem(oemNumber) {
        try {
            const query = `
                SELECT 
                    i.*, 
                    b.height, b.code, b.inner_diameter, b.outer_diameter, b.type_bearing,
                    COALESCE(SUM(r.stock), 0) AS stock_total
                FROM item i
                -- ⚠INNER JOIN: Si el OEM no existe en la tabla bearing, el query no devolverá nada
                INNER JOIN bearing b ON i.id_item = b.id_item
                LEFT JOIN repuesto r ON i.id_item = r.oem_code
                WHERE i.id_item = $1
                GROUP BY i.id_item, b.code , b.id_item, b.height, b.inner_diameter, b.outer_diameter, b.type_bearing;`;

            const { rows } = await pool.query(query, [oemNumber]);
            return this.toDomain(rows[0]);
        } catch (error) {
            console.error(` Error en bearingMapper.getBearingByOem para el código ${oemNumber}:`, error.message);
            throw error;
        }
    },
    // create
    async createBearing(itemData, bearingData) {
        // 1. Pedimos un cliente exclusivo para controlar la transacción de forma segura
        const client = await pool.connect();
        try {
            await client.query('BEGIN'); //  Iniciamos la transacción

            // 2. Inserción en la tabla maestra 'item'
            const itemQuery = `
                INSERT INTO item (id_item, item_name, item_description, photo)
                VALUES ($1, $2, $3, $4)
                RETURNING *;
            `;
            const valuesItem = [
                itemData.oemNumber,
                itemData.itemName,
                itemData.itemDescription,
                itemData.photo
            ];
            await client.query(itemQuery, valuesItem);

            // 3. Inserción en la tabla especializada 'bearing'
            const bearingQuery = `
                INSERT INTO bearing (id_item, code, height, inner_diameter, outer_diameter, type_bearing)
                VALUES ($1, $2, $3, $4, $5, $6)
                RETURNING *;
            `;
            const valuesBearing = [
                itemData.oemNumber,
                bearingData.code,
                bearingData.height,
                bearingData.innerDiameter,
                bearingData.outerDiameter,
                bearingData.typeBearing
            ];
            await client.query(bearingQuery, valuesBearing);

            await client.query('COMMIT'); //  Todo se guardó con éxito en GCP

            // 4. Reutilizamos tu getByOem para devolver el formato JSON exacto que espera el frontend
            return await this.getBearingByOem(itemData.oemNumber);

        } catch (error) {
            await client.query('ROLLBACK'); //  Si algo falló, deshace los cambios y evita datos basura
            console.error('Error crítico en createBearing:\n', error.message);
            throw error; // Lanzamos el error original para que el controlador lea el código (ej: 23505)
        } finally {
            client.release(); // ☁ Liberamos la conexión para que vuelva al pool (Costo $0.00)
        }
    },

    async updateBearing(oemNumber, bearingData){
        try{
            
            const values =[
                bearingData.code,
                bearingData.height,
                bearingData.innerDiameter,
                bearingData.outerDiameter,
                bearingData.typeBearing,
                oemNumber
            ];
            const query = `
            UPDATE bearing 
            SET  code = $1, height = $2, inner_diameter = $3, outer_diameter = $4, type_bearing = $5
            WHERE id_item = $6
            RETURNING *;`;
            const { rows } = await pool.query(query, values);
            
            return this.toDomain({success: true, message: 'bearing actualizado correctamente', data: rows[0]});
        }catch(error){
            console.error('Error al actualizar bearing:\n', error.message);
            throw new Error("Error al actualizar bearing");
        }
    },

    //delete
    async deleteBearing(oemNumber){
        try{
            const query = `DELETE FROM bearing WHERE id_item = $1 RETURNING *;`;
            const { rows } = await pool.query(query, [oemNumber]);
            return this.toDomain({success: true, message: 'bearing '+ oemNumber + ' eliminado correctamente', data: rows[0]});
        }catch(error){
            console.error('Error al eliminar bearing:\n', error.message);
            if (error.code === '23505') {
                throw new Error(`El bearing con OEM '${oemNumber}' no existe.`);
            }else{
                throw new Error("Error al eliminar bearing");
            }
        }
    }
}

export { bearingMapper };