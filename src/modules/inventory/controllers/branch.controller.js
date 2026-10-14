import { branchService } from '../services/branch.service.js';

export const branchController = {
  async getAllBranches(req, res, next) {
    try {
      const branches = await branchService.getAllBranches();
      res.status(200).json({
        success: true,
        data: branches
      });
    } catch (error) {
      next(error);
    }
  },

  async getBranchById(req, res, next) {
    try {
      const { idSucursal } = req.params;
      const branch = await branchService.getBranchById(parseInt(idSucursal, 10));
      res.status(200).json({
        success: true,
        data: branch
      });
    } catch (error) {
      next(error);
    }
  },

  async createBranch(req, res, next) {
    try {
      const newBranch = await branchService.createBranch(req.body);
      res.status(201).json({
        success: true,
        data: newBranch
      });
    } catch (error) {
      next(error);
    }
  }
};
