import { Router } from "express";
import {
    getAllItems,
    getItemByOem,
    createItem,
    updateItem,
    deleteItem
} from "../controllers/itemController.js";

const router = Router();

router.get("/", getAllItems);
router.get("/:oemNumber", getItemByOem);
router.post("/", createItem);
router.patch("/:oemNumber", updateItem);
router.delete("/:oemNumber", deleteItem);

export default router;
