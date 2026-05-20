import pool from "../config/database.js";

export const createProduct = async (req, res) => {
     
    const { 
    part_name, 
    brand, 
    sku, 
    model_year, 
    stock, 
    price, 
    category_id 
  } = req.body;

    try {
    const queryText = `
      INSERT INTO truck_parts (part_name, brand, sku, model_year, stock, price, category_id)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *;
    `;

        const values = [
            part_name, 
            brand, 
            sku || null, // Si no viene SKU, inserta null
            model_year, 
            stock || 0,   // Default 0 si no se envía
            price, 
            category_id || null
            ];
        const result = await pool.query(queryText, values);

        // Si la inserción fue exitosa, result.rows[0] contendrá el producto creado
        res.status(201).json({
            message: "Producto creado exitosamente",
            product: result.rows[0]
        });
    } catch (error) {
        console.error(':( Error al crear producto:\n', error.message);
        res.status(500).json({ error: "Error al crear producto" });
    }

}