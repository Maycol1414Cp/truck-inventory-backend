import { Router } from 'express';
import { posController } from '../controllers/pos.controller.js';
import { returnController } from '../controllers/return.controller.js';

const router = Router();

// =========================================================================
// RUTAS DE VENTAS TRANSACCIONALES POS (/api/v1/pos/sales)
// =========================================================================
router.post('/sales', posController.createSale);
router.get('/sales', posController.getAllSales);
router.get('/sales/:idVenta', posController.getSaleById);
router.get('/sales/:idVenta/returns', returnController.getReturnsBySale);

// =========================================================================
// RUTAS DE DEVOLUCIONES Y REINTEGROS (/api/v1/pos/returns)
// =========================================================================
router.post('/returns', returnController.processReturn);
router.get('/returns/:idDevolucion', returnController.getReturnById);

export default router;
