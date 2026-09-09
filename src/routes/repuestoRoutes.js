import {Router} from "express";
import {
    getAllRepuestos,
    getRepuestoById,
    createRepuesto,
} from "../controllers/repuestoController.js"

const router = Router();

router.get("/", getAllRepuestos);
router.get("/:idItem", getRepuestoById);
router.post("/",createRepuesto)
export default router;

