import pool from "../config/database.js";
import {brandMapper} from "../mappers/brandMapper.js";

export const brandRepository = {
    async getAllBrands() {
        const query = 'SELECT * FROM brand';
        const {rows} = await pool.query(query);
        return brandMapper.toDomainList(rows);
    },
    async getBrandById(id) {
        const query = 'SELECT * FROM brand WHERE id_brand = $1';
        //ejecutamos la consulta y obtenemos la fila
        const {rows} = await pool.query(query, [id]);
        //convertir fila
        return brandMapper.toDomain(rows[0]);
    },
    async createBrand(brandData) { 
        //convertimos el los datos al formato sql
        const dbData = brandMapper.toPersistence(brandData);
        //creamos la consulta sql para insertar la marca en la base de datos
        const query = 'INSERT INTO brand (brand_name, logo_url, country) VALUES ($1, $2, $3) RETURNING *';
        //obtenemos la fila insertada
        const values = [dbData.brand_name, dbData.logo_url, dbData.country];
        //ejecutamos la consulta y obtenemos la fila insertada
        const {rows} = await pool.query(query, values);
        return brandMapper.toDomain(rows[0]);
    }

}
