import { Router } from 'express';
import { branchController } from '../controllers/branch.controller.js';
import { inventoryController } from '../controllers/inventory.controller.js';
import { alertController } from '../controllers/alert.controller.js';
import { transferController } from '../controllers/transfer.controller.js';

const router = Router();

// =========================================================================
// RUTAS DE SUCURSALES (/api/v1/inventory/branches)
// =========================================================================
router.get('/branches', branchController.getAllBranches);
router.get('/branches/:idSucursal', branchController.getBranchById);
router.post('/branches', branchController.createBranch);

// =========================================================================
// RUTAS DE ALERTAS DE REPOSICIÓN TIENDA VS. DEPÓSITO
// Deben ir antes de rutas con parámetros variables para evitar colisión
// =========================================================================
router.get('/alerts/restock/:idSucursal', alertController.getRestockAlerts);
router.get('/alerts/restock', alertController.getRestockAlerts);

// =========================================================================
// RUTAS DE STOCK SEGREGADO Y COORDENADAS FÍSICAS
// =========================================================================
router.get('/branches/:idSucursal/stock', inventoryController.getStockByBranch);
router.put('/branches/:idSucursal/stock/:idItem/location', inventoryController.updateItemLocation);
router.post('/stock/assign', inventoryController.assignStock);

// =========================================================================
// RUTAS DE TRASPASOS INTERNOS Y KARDEX AUDITABLE
// =========================================================================
router.post('/transfers', transferController.executeTransfer);
router.get('/kardex/:idSucursal/:idItem', transferController.getKardexByItem);

export default router;
