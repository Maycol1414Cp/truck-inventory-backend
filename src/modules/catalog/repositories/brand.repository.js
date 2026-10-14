import pool from '../../../config/database.js';
import { brandMapper } from '../mappers/brand.mapper.js';

export const brandRepository = {
  async findAll(client = pool) {
    const query = `
      SELECT id_brand, brand_name, country, logo_url, created_at
      FROM brand
      ORDER BY brand_name ASC;
    `;
    const { rows } = await client.query(query);
    return brandMapper.toDomainList(rows);
  },

  async findById(idBrand, client = pool) {
    const query = `
      SELECT id_brand, brand_name, country, logo_url, created_at
      FROM brand
      WHERE id_brand = $1;
    `;
    const { rows } = await client.query(query, [idBrand]);
    return rows.length ? brandMapper.toDomain(rows[0]) : null;
  },

  async findByName(brandName, client = pool) {
    const query = `
      SELECT id_brand, brand_name, country, logo_url, created_at
      FROM brand
      WHERE LOWER(brand_name) = LOWER($1);
    `;
    const { rows } = await client.query(query, [brandName]);
    return rows.length ? brandMapper.toDomain(rows[0]) : null;
  },

  async create(brandData, client = pool) {
    const dbData = brandMapper.toPersistence(brandData);
    const query = `
      INSERT INTO brand (brand_name, country, logo_url)
      VALUES ($1, $2, $3)
      RETURNING id_brand, brand_name, country, logo_url, created_at;
    `;
    const values = [dbData.brand_name, dbData.country, dbData.logo_url];
    const { rows } = await client.query(query, values);
    return brandMapper.toDomain(rows[0]);
  }
};
