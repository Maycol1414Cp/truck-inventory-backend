import pool from "../config/database.js";

export const itemMapper = {
    toDomain(dbRow) {
        if (!dbRow) return null;

        const baseItem={
            idItem: dbRow.id_item,
            itemName: dbRow.item_name,
            itemDescription: dbRow.item_description,
            photo: dbRow.photo,
            // calculamos el stock
            stock: parseInt(dbRow.stock) || parseInt(dbRow.stock)||0,
        };
        return baseItem;
    },
    toDomainList(dbRows){
       if (!dbRows || dbRows.length === 0) return [];
        return dbRows.map(row => this.toDomain(row));
    },
    toPersistence(dto) {
        if (!dto) return null;
        return {
            item_name: dto.itemName ? dto.itemName.trim() : null,
            item_description: dto.itemDescription || null,
            photo: dto.photo ? dto.photo.trim() : null,
            stock: dto.stock || 0
        };
    }
};
