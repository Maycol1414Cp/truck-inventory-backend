export const branchMapper = {
  toDomain(row) {
    if (!row) return null;
    return {
      idSucursal: row.id_sucursal,
      code: row.code,
      name: row.name,
      address: row.address,
      phone: row.phone || null,
      isMainHub: Boolean(row.is_main_hub),
      isActive: Boolean(row.is_active),
      createdAt: row.created_at
    };
  },

  toDomainList(rows) {
    if (!Array.isArray(rows)) return [];
    return rows.map(r => this.toDomain(r));
  },

  toPersistence(dto) {
    return {
      code: dto.code ? dto.code.trim().toUpperCase() : null,
      name: dto.name ? dto.name.trim() : null,
      address: dto.address ? dto.address.trim() : null,
      phone: dto.phone ? dto.phone.trim() : null,
      is_main_hub: Boolean(dto.isMainHub),
      is_active: dto.isActive !== undefined ? Boolean(dto.isActive) : true
    };
  }
};
