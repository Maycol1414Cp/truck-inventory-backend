export const itemMapper = {
  toDomain(row) {
    if (!row) return null;

    let images = [];
    if (Array.isArray(row.images)) {
      images = row.images;
    } else if (typeof row.images === 'string') {
      try { images = JSON.parse(row.images); } catch (_) { images = []; }
    }

    let oems = [];
    if (Array.isArray(row.oems)) {
      oems = row.oems;
    } else if (typeof row.oems === 'string') {
      try { oems = JSON.parse(row.oems); } catch (_) { oems = []; }
    }

    return {
      idItem: row.id_item,
      itemName: row.item_name,
      itemDescription: row.item_description,
      idBrand: row.id_brand,
      brandName: row.brand_name || null,
      brandCountry: row.country || null,
      brandLogoUrl: row.logo_url || null,
      sku: row.sku,
      cost: parseFloat(row.cost || 0),
      price: parseFloat(row.price || 0),
      isActive: Boolean(row.is_active),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      images: images.map(img => ({
        idImage: img.id_image,
        imageUrl: img.image_url,
        thumbnailUrl: img.thumbnail_url,
        isPrimary: Boolean(img.is_primary),
        displayOrder: img.display_order
      })),
      oems: oems.map(o => ({
        idItemOem: o.id_item_oem,
        oemCode: o.oem_code,
        cleanOemCode: o.clean_oem_code,
        brandOrigin: o.brand_origin,
        oemType: o.oem_type,
        isMain: Boolean(o.is_main)
      }))
    };
  },

  toDomainList(rows) {
    if (!Array.isArray(rows)) return [];
    return rows.map(r => this.toDomain(r));
  },

  toPersistence(dto) {
    return {
      item_name: dto.itemName,
      item_description: dto.itemDescription,
      id_brand: dto.idBrand,
      sku: dto.sku,
      cost: dto.cost || 0,
      price: dto.price || 0,
      is_active: dto.isActive !== undefined ? Boolean(dto.isActive) : true
    };
  }
};
