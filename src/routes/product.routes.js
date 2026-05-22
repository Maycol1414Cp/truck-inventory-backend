import { Router } from 'express';
import { createProduct,getProducts } from '../controllers/product.controller.js';

const router = Router();

//endpoint POST /api/products
router.post('/', createProduct);
//encdpoint GET /api/products
router.get('/', getProducts);

export default router;