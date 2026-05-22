import pool from "../config/database.js";

 

//POST /api/products 
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
        // El código "23505" es el estándar de Postgres para "Unique Violation"
        if (error.code === '23505') {
        return res.status(400).json({ 
            error: "El SKU ya existe", 
            message: `Ya hay un repuesto registrado con el código ${sku}.` 
        });
        }
    }
}

//GET /api/products
export const getProducts = async (req, res) => {
    try{
        const queryText = `SELECT * FROM truck_parts;`;

        const result = await pool.query(queryText);

        res.status(200).json({
            message: "Productos obtenidos exitosamente",
            products: result.rows
        });
    } catch (error) {
        console.error(':( Error al obtener productos:\n', error.message);
        res.status(500).json({ error: "Error al obtener productos" });
    }
}

//PATCH /api/products
export const editProduct = async (req, res) => {
    const { id } = req.params;
    const {part_name, brand, sku, model_year, stock, price, category_id } = req.body;
    try {
        const queryText = `
            UPDATE truck_parts 
            SET 
                part_name = $1, 
                brand = $2, 
                sku = $3, 
                model_year = $4, 
                stock = $5, 
                price = $6, 
                category_id = $7,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = $8
            RETURNING *;
        `
        const values = [part_name, brand, sku, model_year, stock, price, category_id, id]
        const response = await pool.query(queryText, values);
        
        if (response.rowCount === 0) {
            return res.status(404).json({ error: "Producto no encontrado" });
        }
        res.status(200).json({
            message: "Producto actualizado exitosamente",
            product: response.rows[0]
        });
    }catch (error) {
        console.error(':( Error al actualizar producto:\n', error.message);
        res.status(500).json({ error: "Error al actualizar producto" });
    }
}