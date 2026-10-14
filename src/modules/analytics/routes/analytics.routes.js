import { Router } from 'express';
import { analyticsController } from '../controllers/analytics.controller.js';

const router = Router();

// =========================================================================
// MÓDULO DE ANALÍTICA Y PREDICCIÓN DE IMPORTACIONES (FASE 3)
// =========================================================================

// Analítica de Demanda Estacional por Trimestres (Q1..Q4)
router.get('/seasonal-demand', analyticsController.getSeasonalDemand);

// Reporte Predictivo de Punto de Reorden (ROP = D_avg * LT + SS) para Importaciones
router.get('/reorder-points', analyticsController.getReorderPoints);

// Dashboard Ejecutivo de KPIs (Catálogo, Stock, Valuación y Ventas Netas)
router.get('/dashboard', analyticsController.getDashboard);

export default router;
