import {itemMapper} from '../mappers/itemMapper.js';
import { sealMapper } from '../mappers/sealMapper.js'; 
//items
export const getAllItems = async (req, res) => {
    try{
        const items = await itemMapper.getAllItems();
        res.status(200).json({succes: true, message: "Items obtenidos correctamente", data: items});
    }catch(error){
        console.error('Error al obtener items:\n', error.message);
        res.status(500).json({error: "Error al obtener items"});
    }
};

export const getItemByOem = async (req, res) =>{
    try{
        const item = await itemMapper.getItemByOem(req.params.oemNumber);
        if(!item){
            return res.status(404).json({error: "Item no encontrado"});
        }
        res.status(200).json({success: true, message: "item obtenido correctamente", data: item});
    }catch(error){
        console.log('Error al obtener item:\n', error.message);
        res.status(500).json({error: "Error al obtener item"});
    }
};

export const createItem = async (req, res) => {
    try{
        // 1. Extraemos de forma limpia las variables usando destructuring de JS
        const { tipo, especificaciones, ...itemData } = req.body;

        // 2. CASO A: Si el usuario especifica que es un retén (seal)
        if (tipo === 'seal') {
            if (!especificaciones) {
                return res.status(400).json({ 
                    success: false, 
                    error: 'Faltan las especificaciones técnicas del retén.' 
                });
            }
            
            // Llamamos a la transacción que creamos en el sealMapper
            const newSeal = await sealMapper.createSeal(itemData, especificaciones);
            
            return res.status(201).json({
                success: true, 
                message: "Retén (Seal) creado correctamente con sus especificaciones", 
                data: newSeal
            });
        }
        // 3. CASO B: Si es un ítem común y corriente (General sin subtipo)
        const newItem = await itemMapper.createItem(itemData);
        
        return res.status(201).json({
            success: true, 
            message: "Item general creado correctamente", 
            data: newItem
        });

    } catch (error) {
        // Captura de claves duplicadas en Postgres (OEM único)
        if (error.code === '23505') {
            return res.status(400).json({ 
                success: false,
                error: `El Número OEM '${req.body.oemNumber}' ya existe`
            });
        }
        
        console.error('Error al crear item:', error.message);
        return res.status(500).json({ 
            success: false, 
            error: "Error interno del servidor al crear el ítem" 
        });
    }
};
export const updateItem = async (req, res) => {
    try {
        const { oemNumber } = req.params;
        const { tipo, especificaciones, ...itemData } = req.body;

        let updatedItem;

        // Si desde el frontend nos dicen que el objeto editado es un seal (retén)
        if (tipo === 'seal') {
            updatedItem = await itemMapper.updateItem(oemNumber, itemData, especificaciones);
        } else {
            // Si es un ítem general, el tercer parámetro se queda como null
            updatedItem = await itemMapper.updateItem(oemNumber, itemData);
        }

        if (!updatedItem) {
            return res.status(404).json({ success: false, error: 'El componente no existe.' });
        }

        return res.status(200).json({
            success: true,
            message: "Componente actualizado correctamente",
            data: updatedItem
        });

    } catch (error) {
        console.error('🔴 Error al actualizar ítem:', error.message);
        res.status(500).json({ success: false, error: "Error interno al actualizar." });
    }
};

export const deleteItem = async (req, res) => {
    try{
        const deleted = await itemMapper.deleteItem(req.params.oemNumber);
        if(!deleted){
            return res.status(404).json({error: "Item no encontrado"});
        }
        res.status(200).json({success: true, message: "Item eliminado exitosamente"});
    }catch(error){
        console.error('Error al eliminar item:\n', error.message);
        res.status(500).json({error: "Error al eliminar item"});
    }
};

//seals
export const getSealByOem = async (req, res) =>{
    try{
        const seal = await sealMapper.getSealByOem(req.params.oemNumber);
        if(!seal){
            return res.status(404).json({error: "Seal no encontrado"});
        }
        res.status(200).json({success: true, message: "Seal obtenido correctamente", data: seal});
    }catch(error){
        console.log('Error al obtener seal:\n', error.message);
        res.status(500).json({error: "Error al obtener seal"});
    }
};

