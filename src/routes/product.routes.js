import { Router } from 'express';
import { createProduct,getProducts, editProduct } from '../controllers/product.controller.js';

const router = Router();

//endpoint POST /api/products
router.post('/', createProduct);
//encdpoint GET /api/products
router.get('/', getProducts);
//endpoint PATCH /api/products/:id
router.patch('/:id', editProduct);

export default router;