import pool from "../config/database.js"
import { itemMapper } from "../mappers/itemMapper.js"

export const itemRepository = {
    async getAllItems(){
        const query = 'SELECT * FROM item';
        const {rows} = await pool.query(query);
        return itemMapper.toDomainList(rows);
    },
    async getItemById(id){
        const query = 'SELECT * FROM item WHERE id_item = $1';
        const {rows}= await pool.query(query,[id]);
        return itemMapper.toDomain(rows[0]);
    },
    async getItemByName(itemName){
        const query = 'SELECT * FROM item WHERE item_name LIKE $1'
        const {rows} = await pool.query(query,[itemName]);
        return itemMapper.toDomainList(rows);
    },
    async createItem(itemData){
        const dbData = itemMapper.toPersistence(itemData);
        const query = 'INSERT INTO item (item_name, item_description, photo, stock) VALUES ($1,$2,$3,$4) RETURNING *';
        const values = [dbData.item_name, dbData.item_description, dbData.photo, itemData.stock];
        const {rows} = await pool.query(query,values);
        return itemMapper.toDomain(rows[0]);
    }
};