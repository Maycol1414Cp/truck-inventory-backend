import pool from '../../../config/database.js';
import { branchMapper } from '../mappers/branch.mapper.js';

export const branchRepository = {
  async findAll({ isActive = true } = {}, client = pool) {
    let query = `
      SELECT id_sucursal, code, name, address, phone, is_main_hub, is_active, created_at
      FROM sucursal
    `;
    const values = [];

    if (isActive !== null) {
      query += ` WHERE is_active = $1`;
      values.push(isActive);
    }

    query += ` ORDER BY id_sucursal ASC;`;

    const { rows } = await client.query(query, values);
    return branchMapper.toDomainList(rows);
  },

  async findById(idSucursal, client = pool) {
    const query = `
      SELECT id_sucursal, code, name, address, phone, is_main_hub, is_active, created_at
      FROM sucursal
      WHERE id_sucursal = $1;
    `;
    const { rows } = await client.query(query, [idSucursal]);
    return rows.length ? branchMapper.toDomain(rows[0]) : null;
  },

  async findByCode(code, client = pool) {
    const query = `
      SELECT id_sucursal, code, name, address, phone, is_main_hub, is_active, created_at
      FROM sucursal
      WHERE UPPER(code) = UPPER($1);
    `;
    const { rows } = await client.query(query, [code]);
    return rows.length ? branchMapper.toDomain(rows[0]) : null;
  },

  async create(branchData, client = pool) {
    const dbData = branchMapper.toPersistence(branchData);
    const query = `
      INSERT INTO sucursal (code, name, address, phone, is_main_hub, is_active)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id_sucursal, code, name, address, phone, is_main_hub, is_active, created_at;
    `;
    const values = [
      dbData.code,
      dbData.name,
      dbData.address,
      dbData.phone,
      dbData.is_main_hub,
      dbData.is_active
    ];
    const { rows } = await client.query(query, values);
    return branchMapper.toDomain(rows[0]);
  }
};
