import {Router} from "express";
import {
    getBrands,
    getBrandById,
    createBrand
} from "../controllers/brandController.js";
 
const router = Router();

router.get("/", getBrands);
router.get("/:idBrand", getBrandById);
router.post("/", createBrand);

export default router;
