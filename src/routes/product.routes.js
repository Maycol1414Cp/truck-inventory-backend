import { Router } from 'express';
import { createProduct } from '../controllers/product.controller.js';

const router = Router();

//endpoint POST /api/products
router.post('/', createProduct);

export default router;