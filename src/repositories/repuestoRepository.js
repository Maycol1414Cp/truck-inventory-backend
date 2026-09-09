import pool from "../config/database.js";
import { brandMapper } from "../mappers/brandMapper.js";
import { repuestoMapper } from "../mappers/repuestoMapper.js";

export const repuestoRepository = {
    async getAllRepuestos(){
        const query = `
            SELECT 
                r.*,
                b.brand_name,
                b.logo_url
            FROM repuesto r
            INNER JOIN brand b ON r.id_brand = b.id_brand
        `;
        const {rows} = await pool.query(query);
        return repuestoMapper.toDomainList(rows);
    },
    async getRespuestoByIdItem(id){
        const query = 'SELECT r.*, b.brand_name, b.logourl FROM  repuesto r INNER JOIN brand b ON r.id_brand = b.id_brand WHERE r.id_item = $1';
        const {rows} = await pool.query(query,[id]);
        return repuestoMapper.toDomainList(rows);
    },
    async createRepuesto(repuestoData){
        const dbData = repuestoMapper.toPersistence(brandData);
        const query = 'INSERT INTO repuesto (number_brand, price, cost, stock, id_brand) VALUES ($1,$2,$3,$4,$5) RETURNING *';
        const values = [dbData.number_brand, dbData.price, dbData.cost,dbData.stock,dbData.id_brand]
        const {rows} = await pool.query(query, values);
        return brandMapper.toDomain(rows[0]);
    }
}