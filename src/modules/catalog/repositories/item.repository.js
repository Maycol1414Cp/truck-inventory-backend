import pool from '../../../config/database.js';
import { itemMapper } from '../mappers/item.mapper.js';

export const itemRepository = {
  async findAll({ page = 1, limit = 20, brandId = null, isActive = true }, client = pool) {
    const offset = (page - 1) * limit;
    const conditions = [];
    const values = [];
    let paramIndex = 1;

    if (isActive !== null) {
      conditions.push(`i.is_active = $${paramIndex++}`);
      values.push(isActive);
    }

    if (brandId) {
      conditions.push(`i.id_brand = $${paramIndex++}`);
      values.push(brandId);
    }

    const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const countQuery = `SELECT COUNT(*) as total FROM item i ${whereClause};`;
    const { rows: [{ total }] } = await client.query(countQuery, values);

    const dataQuery = `
      SELECT 
        i.*,
        b.brand_name,
        b.country,
        b.logo_url,
        COALESCE(
          json_agg(
            DISTINCT jsonb_build_object(
              'id_image', img.id_image,
              'image_url', img.image_url,
              'thumbnail_url', img.thumbnail_url,
              'is_primary', img.is_primary,
              'display_order', img.display_order
            )
          ) FILTER (WHERE img.id_image IS NOT NULL), '[]'
        ) AS images,
        COALESCE(
          json_agg(
            DISTINCT jsonb_build_object(
              'id_item_oem', o.id_item_oem,
              'oem_code', o.oem_code,
              'clean_oem_code', o.clean_oem_code,
              'brand_origin', o.brand_origin,
              'oem_type', o.oem_type,
              'is_main', o.is_main
            )
          ) FILTER (WHERE o.id_item_oem IS NOT NULL), '[]'
        ) AS oems
      FROM item i
      LEFT JOIN brand b ON i.id_brand = b.id_brand
      LEFT JOIN item_image img ON i.id_item = img.id_item
      LEFT JOIN item_oem o ON i.id_item = o.id_item
      ${whereClause}
      GROUP BY i.id_item, b.brand_name, b.country, b.logo_url
      ORDER BY i.id_item ASC
      LIMIT $${paramIndex++} OFFSET $${paramIndex++};
    `;

    const { rows } = await client.query(dataQuery, [...values, limit, offset]);

    return {
      items: itemMapper.toDomainList(rows),
      total: parseInt(total, 10),
      page,
      limit,
      totalPages: Math.ceil(parseInt(total, 10) / limit)
    };
  },

  async findById(idItem, client = pool) {
    const query = `
      SELECT 
        i.*,
        b.brand_name,
        b.country,
        b.logo_url,
        COALESCE(
          json_agg(
            DISTINCT jsonb_build_object(
              'id_image', img.id_image,
              'image_url', img.image_url,
              'thumbnail_url', img.thumbnail_url,
              'is_primary', img.is_primary,
              'display_order', img.display_order
            )
          ) FILTER (WHERE img.id_image IS NOT NULL), '[]'
        ) AS images,
        COALESCE(
          json_agg(
            DISTINCT jsonb_build_object(
              'id_item_oem', o.id_item_oem,
              'oem_code', o.oem_code,
              'clean_oem_code', o.clean_oem_code,
              'brand_origin', o.brand_origin,
              'oem_type', o.oem_type,
              'is_main', o.is_main
            )
          ) FILTER (WHERE o.id_item_oem IS NOT NULL), '[]'
        ) AS oems
      FROM item i
      LEFT JOIN brand b ON i.id_brand = b.id_brand
      LEFT JOIN item_image img ON i.id_item = img.id_item
      LEFT JOIN item_oem o ON i.id_item = o.id_item
      WHERE i.id_item = $1
      GROUP BY i.id_item, b.brand_name, b.country, b.logo_url;
    `;
    const { rows } = await client.query(query, [idItem]);
    return rows.length ? itemMapper.toDomain(rows[0]) : null;
  },

  async findBySku(sku, client = pool) {
    if (!sku) return null;
    const query = `SELECT * FROM item WHERE LOWER(sku) = LOWER($1);`;
    const { rows } = await client.query(query, [sku]);
    return rows.length ? itemMapper.toDomain(rows[0]) : null;
  },

  async create(itemData, client = pool) {
    const dbData = itemMapper.toPersistence(itemData);
    const query = `
      INSERT INTO item (item_name, item_description, id_brand, sku, cost, price, is_active)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *;
    `;
    const values = [
      dbData.item_name,
      dbData.item_description,
      dbData.id_brand,
      dbData.sku,
      dbData.cost,
      dbData.price,
      dbData.is_active
    ];
    const { rows } = await client.query(query, values);
    return itemMapper.toDomain(rows[0]);
  },

  async update(idItem, itemData, client = pool) {
    const fields = [];
    const values = [];
    let paramIndex = 1;

    if (itemData.itemName !== undefined) {
      fields.push(`item_name = $${paramIndex++}`);
      values.push(itemData.itemName);
    }
    if (itemData.itemDescription !== undefined) {
      fields.push(`item_description = $${paramIndex++}`);
      values.push(itemData.itemDescription);
    }
    if (itemData.idBrand !== undefined) {
      fields.push(`id_brand = $${paramIndex++}`);
      values.push(itemData.idBrand);
    }
    if (itemData.sku !== undefined) {
      fields.push(`sku = $${paramIndex++}`);
      values.push(itemData.sku);
    }
    if (itemData.cost !== undefined) {
      fields.push(`cost = $${paramIndex++}`);
      values.push(itemData.cost);
    }
    if (itemData.price !== undefined) {
      fields.push(`price = $${paramIndex++}`);
      values.push(itemData.price);
    }
    if (itemData.isActive !== undefined) {
      fields.push(`is_active = $${paramIndex++}`);
      values.push(itemData.isActive);
    }

    fields.push(`updated_at = CURRENT_TIMESTAMP`);

    values.push(idItem);
    const query = `
      UPDATE item
      SET ${fields.join(', ')}
      WHERE id_item = $${paramIndex}
      RETURNING *;
    `;
    const { rows } = await client.query(query, values);
    return rows.length ? itemMapper.toDomain(rows[0]) : null;
  },

  async addImage({ idItem, imageUrl, thumbnailUrl, isPrimary = false, displayOrder = 0 }, client = pool) {
    const query = `
      INSERT INTO item_image (id_item, image_url, thumbnail_url, is_primary, display_order)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *;
    `;
    const { rows } = await client.query(query, [idItem, imageUrl, thumbnailUrl, isPrimary, displayOrder]);
    return rows[0];
  },

  async findImageById(idImage, client = pool) {
    const query = `SELECT * FROM item_image WHERE id_image = $1;`;
    const { rows } = await client.query(query, [idImage]);
    return rows.length ? rows[0] : null;
  },

  async removeImage(idImage, client = pool) {
    const query = `DELETE FROM item_image WHERE id_image = $1 RETURNING *;`;
    const { rows } = await client.query(query, [idImage]);
    return rows.length ? rows[0] : null;
  },

  async resetPrimaryImages(idItem, client = pool) {
    const query = `UPDATE item_image SET is_primary = FALSE WHERE id_item = $1;`;
    await client.query(query, [idItem]);
  },

  async searchAdvanced(searchTerm, cleanTerm, { limit = 20 } = {}, client = pool) {
    const query = `
      SELECT DISTINCT
        i.id_item,
        i.item_name,
        i.item_description,
        i.sku,
        i.price,
        i.cost,
        i.is_active,
        i.created_at,
        b.brand_name,
        b.logo_url,
        COALESCE(
          (SELECT thumbnail_url FROM item_image WHERE id_item = i.id_item AND is_primary = TRUE LIMIT 1),
          (SELECT thumbnail_url FROM item_image WHERE id_item = i.id_item ORDER BY display_order ASC LIMIT 1)
        ) AS thumbnail_url,
        GREATEST(word_similarity($1, i.item_name), similarity(i.item_name, $1)) AS similarity_score
      FROM item i
      LEFT JOIN brand b ON i.id_brand = b.id_brand
      LEFT JOIN item_oem o ON i.id_item = o.id_item
      WHERE 
        i.is_active = TRUE AND (
          $1 <% i.item_name
          OR i.item_name % $1
          OR i.item_name ILIKE ('%' || $1 || '%')
          OR o.clean_oem_code = $2
          OR o.oem_code ILIKE ('%' || $1 || '%')
          OR b.brand_name ILIKE ('%' || $1 || '%')
          OR i.sku ILIKE ('%' || $1 || '%')
        )
      ORDER BY similarity_score DESC, i.id_item ASC
      LIMIT $3;
    `;
    const { rows } = await client.query(query, [searchTerm, cleanTerm, limit]);
    return rows.map(r => ({
      idItem: r.id_item,
      itemName: r.item_name,
      itemDescription: r.item_description,
      sku: r.sku,
      price: parseFloat(r.price || 0),
      cost: parseFloat(r.cost || 0),
      brandName: r.brand_name,
      brandLogoUrl: r.logo_url,
      thumbnailUrl: r.thumbnail_url,
      similarityScore: parseFloat(r.similarity_score || 0)
    }));
  }
};
