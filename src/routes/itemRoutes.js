import { Router } from "express";
import {
    getAllItems,
    getItemById,
    getItemByname,
    createItem
} from "../controllers/itemController.js";

const router = Router();

router.get("/",getAllItems);
router.get("/:idItem",getItemById);
router.get("/", getItemByname);
router.post("/",createItem);
export default router;
