import pool from '../../../config/database.js';
import { oemMapper } from '../mappers/oem.mapper.js';

export const oemRepository = {
  async findByItemId(idItem, client = pool) {
    const query = `
      SELECT id_item_oem, id_item, oem_code, clean_oem_code, brand_origin, oem_type, is_main, created_at
      FROM item_oem
      WHERE id_item = $1
      ORDER BY is_main DESC, oem_code ASC;
    `;
    const { rows } = await client.query(query, [idItem]);
    return oemMapper.toDomainList(rows);
  },

  async findById(idItemOem, client = pool) {
    const query = `
      SELECT id_item_oem, id_item, oem_code, clean_oem_code, brand_origin, oem_type, is_main, created_at
      FROM item_oem
      WHERE id_item_oem = $1;
    `;
    const { rows } = await client.query(query, [idItemOem]);
    return rows.length ? oemMapper.toDomain(rows[0]) : null;
  },

  async findDuplicate(idItem, cleanOemCode, client = pool) {
    const query = `
      SELECT id_item_oem, id_item, oem_code, clean_oem_code, brand_origin, oem_type, is_main, created_at
      FROM item_oem
      WHERE id_item = $1 AND clean_oem_code = $2;
    `;
    const { rows } = await client.query(query, [idItem, cleanOemCode]);
    return rows.length ? oemMapper.toDomain(rows[0]) : null;
  },

  async resetMainFlags(idItem, client = pool) {
    const query = `
      UPDATE item_oem
      SET is_main = FALSE
      WHERE id_item = $1;
    `;
    await client.query(query, [idItem]);
  },

  async create(oemData, client = pool) {
    const dbData = oemMapper.toPersistence(oemData);
    const query = `
      INSERT INTO item_oem (id_item, oem_code, clean_oem_code, brand_origin, oem_type, is_main)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id_item_oem, id_item, oem_code, clean_oem_code, brand_origin, oem_type, is_main, created_at;
    `;
    const values = [
      dbData.id_item,
      dbData.oem_code,
      dbData.clean_oem_code,
      dbData.brand_origin,
      dbData.oem_type,
      dbData.is_main
    ];
    const { rows } = await client.query(query, values);
    return oemMapper.toDomain(rows[0]);
  },

  async delete(idItemOem, client = pool) {
    const query = `
      DELETE FROM item_oem
      WHERE id_item_oem = $1
      RETURNING id_item_oem;
    `;
    const { rowCount } = await client.query(query, [idItemOem]);
    return rowCount > 0;
  }
};
