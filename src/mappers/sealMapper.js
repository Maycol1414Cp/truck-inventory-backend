import pool from "../config/database.js";

export const sealMapper = {
    // Traductor exclusivo para la entidad Seal
    toDomain(dbRow) {
        if (!dbRow) return null;
        return {
            oemNumber: dbRow.oem_number,
            itemName: dbRow.item_name,
            itemDescription: dbRow.item_description,
            photo: dbRow.photo,
            stock: parseInt(dbRow.stock_total) || 0,
            tipo: 'seal',
            especificaciones: {
                height: parseFloat(dbRow.height),
                innerDiameter: parseFloat(dbRow.inner_diameter),
                outerDiameter: parseFloat(dbRow.outer_diameter),
                material: dbRow.material
            }
        };
    },
    
    //GET por oem
// GET que estrictamente busca un retén con sus datos maestros
    async getSealByOem(oemNumber) {
        try {
            const query = `
                SELECT 
                    i.*, 
                    s.height, s.inner_diameter, s.outer_diameter, s.material,
                    COALESCE(SUM(r.stock), 0) AS stock_total
                FROM item i
                -- ⚠INNER JOIN: Si el OEM no existe en la tabla seal, el query no devolverá nada
                INNER JOIN seal s ON i.oem_number = s.oem_number
                LEFT JOIN repuesto r ON i.oem_number = r.oem_code
                WHERE i.oem_number = $1
                GROUP BY i.oem_number, s.oem_number, s.height, s.inner_diameter, s.outer_diameter, s.material;
            `;

            const { rows } = await pool.query(query, [oemNumber]);
            return this.toDomain(rows[0]);

        } catch (error) {
            console.error(` Error en sealMapper.getSealByOem para el código ${oemNumber}:`, error.message);
            throw error;
        }
    },
    // create
    async createSeal(itemData, sealData) {
        // 1. Pedimos un cliente exclusivo para controlar la transacción de forma segura
        const client = await pool.connect();
        try {
            await client.query('BEGIN'); //  Iniciamos la transacción

            // 2. Inserción en la tabla maestra 'item'
            const itemQuery = `
                INSERT INTO item (oem_number, item_name, item_description, photo)
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

            // 3. Inserción en la tabla especializada 'seal'
            const sealQuery = `
                INSERT INTO seal (oem_number, height, inner_diameter, outer_diameter, material)
                VALUES ($1, $2, $3, $4, $5)
                RETURNING *;
            `;
            const valuesSeal = [
                itemData.oemNumber,
                sealData.height,         //  Corregido: 'height' con 't'
                sealData.innerDiameter,
                sealData.outerDiameter,
                sealData.material
            ];
            await client.query(sealQuery, valuesSeal);

            await client.query('COMMIT'); //  Todo se guardó con éxito en GCP

            // 4. Reutilizamos tu getByOem para devolver el formato JSON exacto que espera el frontend
            return await this.getSealByOem(itemData.oemNumber);

        } catch (error) {
            await client.query('ROLLBACK'); //  Si algo falló, deshace los cambios y evita datos basura
            console.error('Error crítico en createSeal:\n', error.message);
            throw error; // Lanzamos el error original para que el controlador lea el código (ej: 23505)
        } finally {
            client.release(); // ☁ Liberamos la conexión para que vuelva al pool (Costo $0.00)
        }
    },
    async updateSeal(oemNumber, sealData){
        try{
            
            const values =[
                sealData.heigh,
                sealData.innerDiameter,
                sealData.outerDiameter,
                sealData.material,
                oemNumber
            ];
            const query = `
            UPDATE seal 
            SET  height = $1, inner_diameter = $2, outer_diameter = $3, material = $4
            WHERE oem_number = $5
            RETURNING *;`;
            const { rows } = await pool.query(query, values);
            
            return this.toDomain(rows[0]);
        }catch(error){
            console.error('Error al actualizar seal:\n', error.message);
            throw new Error("Error al actualizar seal");
        }
    },
    //delete
    async deleteSeal(oemNumber){
        try{
            const query = `DELETE FROM seal WHERE oem_number = $1 RETURNING *;`;
            const { rows } = await pool.query(query, [oemNumber]);
            return this.toDomain(rows[0]);
        }catch(error){
            console.error('Error al eliminar seal:\n', error.message);
            throw new Error("Error al eliminar seal");
        }
    }
}