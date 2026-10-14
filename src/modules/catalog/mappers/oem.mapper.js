export const oemMapper = {
  toDomain(row) {
    if (!row) return null;
    return {
      idItemOem: row.id_item_oem,
      idItem: row.id_item,
      oemCode: row.oem_code,
      cleanOemCode: row.clean_oem_code,
      brandOrigin: row.brand_origin || null,
      oemType: row.oem_type,
      isMain: Boolean(row.is_main),
      createdAt: row.created_at
    };
  },

  toDomainList(rows) {
    if (!Array.isArray(rows)) return [];
    return rows.map(r => this.toDomain(r));
  },

  toPersistence(dto) {
    return {
      id_item: dto.idItem,
      oem_code: dto.oemCode,
      clean_oem_code: dto.cleanOemCode,
      brand_origin: dto.brandOrigin || null,
      oem_type: dto.oemType || 'ORIGINAL',
      is_main: Boolean(dto.isMain)
    };
  }
};
