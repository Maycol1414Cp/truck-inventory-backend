import pool from '../../../config/database.js';

export const kardexRepository = {
  async createMovement(movementData, client = pool) {
    const query = `
      INSERT INTO inventario_movimiento (
        id_item, id_sucursal, tipo_movimiento, origen_tipo, destino_tipo,
        cantidad, stock_previo, stock_posterior, referencia_id,
        usuario_responsable, motivo
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *;
    `;
    const values = [
      movementData.idItem,
      movementData.idSucursal,
      movementData.movementType,
      movementData.originType,
      movementData.destinationType,
      movementData.quantity,
      movementData.stockPrevio,
      movementData.stockPosterior,
      movementData.referenceId || null,
      movementData.userResponsible || 'SISTEMA',
      movementData.reason || null
    ];
    const { rows } = await client.query(query, values);
    return rows[0];
  },

  async findByItemAndBranch(idItem, idSucursal, { limit = 50, offset = 0 } = {}, client = pool) {
    const query = `
      SELECT 
        m.id_movimiento,
        m.id_item,
        i.item_name,
        i.sku,
        m.id_sucursal,
        s.name AS sucursal_nombre,
        m.tipo_movimiento,
        m.origen_tipo,
        m.destino_tipo,
        m.cantidad,
        m.stock_previo,
        m.stock_posterior,
        m.referencia_id,
        m.usuario_responsable,
        m.motivo,
        m.created_at
      FROM inventario_movimiento m
      JOIN item i ON m.id_item = i.id_item
      JOIN sucursal s ON m.id_sucursal = s.id_sucursal
      WHERE m.id_item = $1 AND m.id_sucursal = $2
      ORDER BY m.created_at DESC, m.id_movimiento DESC
      LIMIT $3 OFFSET $4;
    `;
    const { rows } = await client.query(query, [idItem, idSucursal, limit, offset]);
    return rows.map(r => ({
      idMovimiento: r.id_movimiento,
      idItem: r.id_item,
      itemName: r.item_name,
      sku: r.sku,
      idSucursal: r.id_sucursal,
      sucursalNombre: r.sucursal_nombre,
      tipoMovimiento: r.tipo_movimiento,
      origenTipo: r.origen_tipo,
      destinoTipo: r.destino_tipo,
      cantidad: parseInt(r.cantidad, 10),
      stockPrevio: parseInt(r.stock_previo, 10),
      stockPosterior: parseInt(r.stock_posterior, 10),
      referenciaId: r.referencia_id,
      usuarioResponsable: r.usuario_responsable,
      motivo: r.motivo,
      createdAt: r.created_at
    }));
  }
};
