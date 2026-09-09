import pool from "../config/database.js"

export const repuestoMapper = {
    toDomain(dbRow) {
        if (!dbRow) return null;

        const baseRepuesto = {
            idItem: dbRow.id_item,
            numberBrand: dbRow.number_brand,
            price: dbRow.price,
            cost: dbRow.cost,
            stock: dbRow.stock,
            idBrand: dbRow.id_brand
        };
        return baseRepuesto;
    },
    toDomainList(dbRows){
        if(!dbRows||dbRows,length===0) return[];
        return dbRows.map(row => this.toDomain(row));
    },

    toPersistence(dto){
        if (!dto) return null;
        return {
            number_brand: dto.numberBrand || null,
            price: dto.price|| null,
            cost: dto.cost || 0.00,
            stock: dto.stock || 0,
            id_brand: dto.idBrand || null
        };
    }

}