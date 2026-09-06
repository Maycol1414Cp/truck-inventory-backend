import {brandRepository} from '../repositories/brandRepository.js';

export const getBrands = async (req, res) => {
    try {
        const brands = await brandRepository.getAllBrands();
        res.status(200).json(brands);
    } catch (error) {
        console.error('Error al obtener las marcas:', error);
        res.status(500).json({error: 'Error al obtener las marcas'});
    }
};
export const getBrandById = async (req, res) => {
    try {
        const { idBrand } = req.params;
        const brand = await brandRepository.getBrandById(idBrand);
        if (!brand) {
            return res.status(404).json({ error: 'Marca no encontrada' });
        }
        res.status(200).json(brand);
    } catch (error) {
        console.error('Error al obtener la marca por ID:', error);
        res.status(500).json({ error: 'Error al obtener la marca por ID' });
    }
};

export const createBrand = async (req, res) => {
    try {
        const brandData = req.body;
        const newBrand = await brandRepository.createBrand(brandData);
        res.status(201).json(newBrand);
    } catch (error) {
        console.error('Error al crear la marca:', error);
        res.status(500).json({error: 'Error al crear la marca'});
    }
};