import { Router } from 'express';
import { truckController } from '../controllers/truck.controller.js';
import { compatibilityController } from '../controllers/compatibility.controller.js';

const router = Router();

// =========================================================================
// 1. CATÁLOGO DE CAMIONES Y MOTORIZACIONES
// =========================================================================

// Listar marcas únicas de camiones
router.get('/trucks/brands', truckController.listBrands);

// Listar camiones paginados con filtros
router.get('/trucks', truckController.listTrucks);

// Detalle de un modelo de camión
router.get('/trucks/:idTruck', truckController.getTruckById);

// Registrar nuevo camión / motorización
router.post('/trucks', truckController.createTruck);

// Actualizar datos de camión
router.put('/trucks/:idTruck', truckController.updateTruck);

// Eliminar camión del catálogo
router.delete('/trucks/:idTruck', truckController.deleteTruck);

// =========================================================================
// 2. MATRIZ DE COMPATIBILIDAD Y BÚSQUEDA INVERSA
// =========================================================================

// Vincular repuesto con un modelo de camión
router.post('/compatibility', compatibilityController.linkCompatibility);

// Desvincular repuesto de un modelo de camión
router.delete('/compatibility/:idItem/:idTruck', compatibilityController.unlinkCompatibility);

// Búsqueda Inversa: Obtener todos los repuestos compatibles con un camión
router.get('/trucks/:idTruck/items', compatibilityController.listItemsByTruck);

// Obtener todos los camiones compatibles con un repuesto específico
router.get('/items/:idItem/trucks', compatibilityController.listTrucksByItem);

export default router;
