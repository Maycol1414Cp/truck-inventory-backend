import { repuestoRepository } from "../repositories/repuestoRepository.js";

export const getAllRepuestos = async (req,res)=> {
    try{
        const repuestos = await brandRepository.getRepuestos();
        res.status(200).json(repuestos)
    }catch (error){
        console.error('Error al obtener los repuestos', error);
        res.status(500).json({error: "Error al obtener los repuestos"});
    }

};
export const getRepuestoById =async (req,res) => {
    try {
        const { idItem } = req.params;
        const repuesto =await repuestoRepository.getRespuestoByIdItem(idItem);
        if(!repuesto){
            return res.status(404).json({error:"item no encontrado"});
        }
        res.status(200).json(repuesto);
    }catch{
        console.error('Error al obtener el repuesto por id_item:', error);
        res.status(500).json({ error: 'Error al obtener el repuesto' });
    }
};
export const createRepuesto = async (req, res) => {
    try {
        const repuestoData = req.body;
        const newRepuesto = await repuestoRepository.createRepuesto(repuestoData);
        res.status(201).json(newRepuesto);
    } catch (error) {
        console.error('Error al crear repuesto:', error);
        res.status(500).json({error: 'Error al crear el repuesto'});
    }
};