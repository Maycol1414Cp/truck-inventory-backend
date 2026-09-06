import pool from '../config/database.js';

export const brandMapper = {
    toDomain(dbRow) {
        if (!dbRow) return null;

        const baseBrand = {
            idBrand: dbRow.id_brand,
            brandName: dbRow.brand_name,
            logoUrl: dbRow.logo_url,
            country: dbRow.country
        };
        return baseBrand;
    },
    toDomainList(dbRows) {
        if (!dbRows || dbRows.length === 0) return [];
        return dbRows.map(row => this.toDomain(row));
    },

    toPersistence(dto) {
        if (!dto) return null;
        return {
            brand_name: dto.brandName ? dto.brandName.trim() : null,
            logo_url: dto.logoUrl || null,
            country: dto.country ? dto.country.trim() : null
        };
    }
};
