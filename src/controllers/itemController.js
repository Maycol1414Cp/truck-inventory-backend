import { itemRepository } from "../repositories/itemRepository.js";

export const getAllItems = async (req,res)=> {
    const items = await itemRepository.getAllItems();
    res.status(200).json(items);
};
export const getItemById = async (req,res)=>{
    try{
        const {idItem} = req.params;
        const item = await itemRepository.getItemById(idItem);
        if (!item){
            return res.status(404).json({error: "problema al bucar el id"});
        }
        res.status(200).json(item);
    }catch(error){
        console.error('error al obtener el item',error);
        res.status(500).json({error: "error al obtener el item por id" })
    }
};
export const getItemByname = async(req,res)=>{
    try{
        const {itemName} = req.query;
        if (!itemName){
            return res.status(400).json({error:"debe ingresar el nombre a buscar"});
        }
        const rows = await itemRepository.getItemByName(itemName[0]);
        if(!rows){
            return res.status(404).json({error:"nose encontro el item"});
        }
        res.status(200).json({"info":"items encontrados por nombre \n",rows})
    }catch(error){
        console.error("error en la busqueda por nombre",error);
        res.status(500).json({error:"error en la busqueda por nombre"});
    }
};
export const createItem = async (req, res) => {
    try {
        const itemData = req.body;
        const newItem = await itemRepository.createItem(itemData);
        res.status(201).json(newItem);
    } catch (error) {
        console.error('Error al crear el item:', error);
        res.status(500).json({error: 'Error al crear el item'});
    }
};