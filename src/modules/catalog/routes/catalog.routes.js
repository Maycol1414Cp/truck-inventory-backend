import { Router } from 'express';
import { brandController } from '../controllers/brand.controller.js';
import { itemController } from '../controllers/item.controller.js';
import { oemController } from '../controllers/oem.controller.js';
import { uploadItemImages } from '../../../common/middlewares/upload.middleware.js';

const router = Router();

// =========================================================================
// RUTAS DE MARCAS (/api/v1/catalog/brands)
// =========================================================================
router.get('/brands', brandController.getAllBrands);
router.get('/brands/:idBrand', brandController.getBrandById);
router.post('/brands', brandController.createBrand);

// =========================================================================
// RUTAS DE BÚSQUEDA AVANZADA (pg_trgm + GIN)
// Debe definirse antes de /items/:idItem para evitar conflicto de parámetros
// =========================================================================
router.get('/items/search', itemController.searchItems);

// =========================================================================
// RUTAS DE REPUESTOS / ÍTEMS (/api/v1/catalog/items)
// =========================================================================
router.get('/items', itemController.getAllItems);
router.get('/items/:idItem', itemController.getItemById);
router.post('/items', itemController.createItem);
router.put('/items/:idItem', itemController.updateItem);

// =========================================================================
// RUTAS MULTIMEDIA (MULTER + SHARP)
// =========================================================================
router.post('/items/:idItem/images', uploadItemImages, itemController.uploadImages);
router.delete('/items/:idItem/images/:idImage', itemController.deleteImage);

// =========================================================================
// RUTAS DE CÓDIGOS OEM Y REFERENCIAS CRUZADAS
// =========================================================================
router.get('/items/:idItem/oems', oemController.getOemsByItem);
router.post('/items/:idItem/oems', oemController.addOemToItem);
router.delete('/items/:idItem/oems/:idItemOem', oemController.removeOem);

export default router;
