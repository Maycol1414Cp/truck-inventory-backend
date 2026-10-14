export const brandMapper = {
  toDomain(row) {
    if (!row) return null;
    return {
      idBrand: row.id_brand,
      brandName: row.brand_name,
      country: row.country || null,
      logoUrl: row.logo_url || null,
      createdAt: row.created_at
    };
  },

  toDomainList(rows) {
    if (!Array.isArray(rows)) return [];
    return rows.map(r => this.toDomain(r));
  },

  toPersistence(dto) {
    return {
      brand_name: dto.brandName,
      country: dto.country || null,
      logo_url: dto.logoUrl || null
    };
  }
};
