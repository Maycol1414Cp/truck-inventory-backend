/**
 * Especificación OpenAPI 3.1.0 completa para el Sistema Integral de Inventarios y POS
 * de Repuestos de Camiones (Heavy-Duty Truck Parts).
 */

export const openApiSpec = {
  openapi: '3.1.0',
  info: {
    title: 'Truck Parts ERP & POS API Reference',
    version: '1.0.0',
    description: `
API RESTful de alto rendimiento para la gestión integral de repuestos de camiones pesados (Heavy Duty), control de inventarios multi-sucursal con segregación Tienda vs. Depósito, Punto de Venta (POS) transaccional con bloqueos pesimistas anti-concurrencia, matriz de compatibilidad con modelos y motores (Cummins, Detroit, Mack, Volvo, Scania) y módulo predictivo de Punto de Reorden (ROP).

### Estándar de Comunicación
- Todas las respuestas exitosas devuelven la estructura \`{ success: true, data: ..., meta: ... }\`.
- Todos los errores devuelven \`{ success: false, error: { code, message, details } }\`.
- Toda la persistencia opera directamente sobre **PostgreSQL nativo** sin intermediación de ORMs.
    `,
    contact: {
      name: 'Equipo de Ingeniería Truck Parts',
      email: 'soporte@truckparts-erp.com'
    }
  },
  servers: [
    {
      url: 'http://localhost:8080',
      description: 'Servidor Local de Desarrollo'
    },
    {
      url: 'https://api.truckparts-erp.com',
      description: 'Entorno de Producción Cloud'
    }
  ],
  tags: [
    { name: 'Catálogo & Multimedia', description: 'CRUD de repuestos, marcas y procesamiento de imágenes WebP con Sharp' },
    { name: 'Códigos OEM & Equivalencias', description: 'Gestión de números de parte originales y referencias aftermarket' },
    { name: 'Inventario & Sucursales', description: 'Stock segregado (Tienda vs Depósito), coordenadas físicas y traspasos con Kardex' },
    { name: 'Alertas de Reposición', description: 'Monitoreo de quiebres en mostrador con existencia en almacén central' },
    { name: 'Punto de Venta (POS)', description: 'Venta atómica ACID con bloqueo pesimista y auditoría Kardex' },
    { name: 'Devoluciones & Garantías', description: 'Procesamiento de reembolsos con reintegro automático de stock' },
    { name: 'Vehículos & Compatibilidad', description: 'Modelos de camión, familias de motor y búsqueda inversa de repuestos' },
    { name: 'Analítica & Predicción (ROP)', description: 'Demanda estacional por trimestres, Punto de Reorden y Dashboard de KPIs' }
  ],
  paths: {
    '/health': {
      get: {
        tags: ['Catálogo & Multimedia'],
        summary: 'Health Check del Sistema',
        description: 'Verifica el estado del servidor Express y conectividad.',
        responses: {
          200: {
            description: 'Servidor saludable',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    data: {
                      type: 'object',
                      properties: {
                        status: { type: 'string', example: 'HEALTHY' },
                        uptime: { type: 'number', example: 124.5 },
                        timestamp: { type: 'string', format: 'date-time' }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    },

    // =======================================================================
    // 1. CATÁLOGO & MULTIMEDIA
    // =======================================================================
    '/api/v1/catalog/brands': {
      get: {
        tags: ['Catálogo & Multimedia'],
        summary: 'Listar marcas de repuestos',
        responses: {
          200: {
            description: 'Lista de marcas obtenida exitosamente',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    data: {
                      type: 'array',
                      items: { $ref: '#/components/schemas/Brand' }
                    }
                  }
                }
              }
            }
          }
        }
      },
      post: {
        tags: ['Catálogo & Multimedia'],
        summary: 'Crear nueva marca de repuestos',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['brandName'],
                properties: {
                  brandName: { type: 'string', example: 'Donaldson' },
                  countryOrigin: { type: 'string', example: 'EE.UU.' },
                  logoUrl: { type: 'string', example: 'https://storage.googleapis.com/demo/donaldson.webp' }
                }
              }
            }
          }
        },
        responses: {
          201: {
            description: 'Marca creada exitosamente',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/BrandResponse' } } }
          },
          409: { description: 'Marca ya existente', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
        }
      }
    },

    '/api/v1/catalog/items/search': {
      get: {
        tags: ['Catálogo & Multimedia'],
        summary: 'Búsqueda difusa Trigram y Códigos OEM',
        description: 'Búsqueda de alta velocidad utilizando índices GIN de similitud de palabras sobre Nombre de Repuesto, Marca y Códigos OEM.',
        parameters: [
          { name: 'q', in: 'query', required: true, description: 'Término de búsqueda (ej: FS1000, válvula pedal, Meritor)', schema: { type: 'string', example: 'valvula pedal' } },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 20 } }
        ],
        responses: {
          200: {
            description: 'Resultados de coincidencia difusa',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    data: { type: 'array', items: { $ref: '#/components/schemas/Item' } },
                    meta: { $ref: '#/components/schemas/PaginationMeta' }
                  }
                }
              }
            }
          }
        }
      }
    },

    '/api/v1/catalog/items': {
      get: {
        tags: ['Catálogo & Multimedia'],
        summary: 'Listar repuestos paginados',
        parameters: [
          { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 20 } },
          { name: 'idBrand', in: 'query', schema: { type: 'integer' } },
          { name: 'search', in: 'query', schema: { type: 'string' } }
        ],
        responses: {
          200: {
            description: 'Listado de ítems con metadatos de paginación',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    data: { type: 'array', items: { $ref: '#/components/schemas/Item' } },
                    meta: { $ref: '#/components/schemas/PaginationMeta' }
                  }
                }
              }
            }
          }
        }
      },
      post: {
        tags: ['Catálogo & Multimedia'],
        summary: 'Crear nuevo repuesto en catálogo',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['itemName', 'idBrand', 'sku', 'cost', 'price'],
                properties: {
                  itemName: { type: 'string', example: 'Secador de Aire AD-IP 24V' },
                  itemDescription: { type: 'string', example: 'Secador de aire desecante integrado con calentador 24V' },
                  idBrand: { type: 'integer', example: 2 },
                  sku: { type: 'string', example: 'SEC-BEN-011' },
                  cost: { type: 'number', example: 210.00 },
                  price: { type: 'number', example: 340.00 },
                  category: { type: 'string', example: 'VALVULA' }
                }
              }
            }
          }
        },
        responses: {
          201: { description: 'Repuesto creado', content: { 'application/json': { schema: { $ref: '#/components/schemas/ItemResponse' } } } },
          409: { description: 'SKU duplicado', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
        }
      }
    },

    '/api/v1/catalog/items/{idItem}': {
      get: {
        tags: ['Catálogo & Multimedia'],
        summary: 'Obtener detalle completo de un repuesto',
        description: 'Incluye especificaciones técnicas, galería de imágenes WebP y códigos OEM vinculados.',
        parameters: [{ name: 'idItem', in: 'path', required: true, schema: { type: 'integer' } }],
        responses: {
          200: { description: 'Detalle del repuesto', content: { 'application/json': { schema: { $ref: '#/components/schemas/ItemDetailResponse' } } } },
          404: { description: 'Repuesto no encontrado', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
        }
      },
      put: {
        tags: ['Catálogo & Multimedia'],
        summary: 'Actualizar repuesto existente',
        parameters: [{ name: 'idItem', in: 'path', required: true, schema: { type: 'integer' } }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  itemName: { type: 'string' },
                  itemDescription: { type: 'string' },
                  idBrand: { type: 'integer' },
                  cost: { type: 'number' },
                  price: { type: 'number' },
                  isActive: { type: 'boolean' }
                }
              }
            }
          }
        },
        responses: {
          200: { description: 'Repuesto actualizado', content: { 'application/json': { schema: { $ref: '#/components/schemas/ItemResponse' } } } }
        }
      }
    },

    '/api/v1/catalog/items/{idItem}/images': {
      post: {
        tags: ['Catálogo & Multimedia'],
        summary: 'Cargar imágenes de repuesto (Sharp WebP)',
        description: 'Recibe hasta 5 archivos de imagen (multipart/form-data). Las optimiza automáticamente con Sharp convirtiéndolas a WebP (1200px máx) y genera thumbnails (300px).',
        parameters: [{ name: 'idItem', in: 'path', required: true, schema: { type: 'integer' } }],
        requestBody: {
          required: true,
          content: {
            'multipart/form-data': {
              schema: {
                type: 'object',
                properties: {
                  images: {
                    type: 'array',
                    items: { type: 'string', format: 'binary' }
                  }
                }
              }
            }
          }
        },
        responses: {
          201: { description: 'Imágenes procesadas y almacenadas exitosamente' }
        }
      }
    },

    // =======================================================================
    // 2. CÓDIGOS OEM
    // =======================================================================
    '/api/v1/catalog/items/{idItem}/oems': {
      get: {
        tags: ['Códigos OEM & Equivalencias'],
        summary: 'Listar códigos OEM de un repuesto',
        parameters: [{ name: 'idItem', in: 'path', required: true, schema: { type: 'integer' } }],
        responses: {
          200: { description: 'Códigos OEM del repuesto' }
        }
      },
      post: {
        tags: ['Códigos OEM & Equivalencias'],
        summary: 'Asociar código OEM o referencia cruzada',
        parameters: [{ name: 'idItem', in: 'path', required: true, schema: { type: 'integer' } }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['oemCode'],
                properties: {
                  oemCode: { type: 'string', example: '5011016' },
                  brandOrigin: { type: 'string', example: 'Bendix' },
                  oemType: { type: 'string', enum: ['ORIGINAL', 'AFTERMARKET', 'CROSS_REFERENCE'], default: 'ORIGINAL' },
                  isMain: { type: 'boolean', default: false }
                }
              }
            }
          }
        },
        responses: {
          201: { description: 'Código OEM asociado' },
          409: { description: 'Código OEM ya asociado' }
        }
      }
    },

    // =======================================================================
    // 3. INVENTARIO & MULTI-SUCURSAL
    // =======================================================================
    '/api/v1/inventory/branches': {
      get: {
        tags: ['Inventario & Sucursales'],
        summary: 'Listar sucursales de la empresa',
        responses: {
          200: { description: 'Lista de sucursales activas' }
        }
      },
      post: {
        tags: ['Inventario & Sucursales'],
        summary: 'Registrar nueva sucursal',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['code', 'name', 'address'],
                properties: {
                  code: { type: 'string', example: 'SUC-03' },
                  name: { type: 'string', example: 'Sucursal Puerto Cabello' },
                  address: { type: 'string', example: 'Zona Portuaria, Galpón 4' },
                  phone: { type: 'string', example: '+58 242 1234567' },
                  isMainHub: { type: 'boolean', default: false }
                }
              }
            }
          }
        },
        responses: {
          201: { description: 'Sucursal creada exitosamente' }
        }
      }
    },

    '/api/v1/inventory/branches/{idSucursal}/stock': {
      get: {
        tags: ['Inventario & Sucursales'],
        summary: 'Consultar stock segregado de una sucursal',
        description: 'Devuelve el desglose físico diferenciado entre piso de venta (TIENDA) y bodega (DEPOSITO), junto a coordenadas de estantería.',
        parameters: [
          { name: 'idSucursal', in: 'path', required: true, schema: { type: 'integer' } },
          { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 20 } },
          { name: 'tipoAlmacen', in: 'query', schema: { type: 'string', enum: ['TIENDA', 'DEPOSITO'] } }
        ],
        responses: {
          200: { description: 'Stock segregado paginado' }
        }
      }
    },

    '/api/v1/inventory/branches/{idSucursal}/stock/{idItem}/location': {
      put: {
        tags: ['Inventario & Sucursales'],
        summary: 'Actualizar coordenadas físicas en estantería',
        description: 'Asigna pasillo, estante y sección de almacenamiento físico en la sucursal.',
        parameters: [
          { name: 'idSucursal', in: 'path', required: true, schema: { type: 'integer' } },
          { name: 'idItem', in: 'path', required: true, schema: { type: 'integer' } }
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['tipoAlmacen', 'pasillo', 'estante', 'seccion'],
                properties: {
                  tipoAlmacen: { type: 'string', enum: ['TIENDA', 'DEPOSITO'], example: 'TIENDA' },
                  pasillo: { type: 'string', example: 'P-03' },
                  estante: { type: 'string', example: 'E-05' },
                  seccion: { type: 'string', example: 'S-02' }
                }
              }
            }
          }
        },
        responses: {
          200: { description: 'Coordenadas físicas actualizadas' }
        }
      }
    },

    '/api/v1/inventory/alerts/restock': {
      get: {
        tags: ['Alertas de Reposición'],
        summary: 'Listar alertas globales de reposición interna',
        description: 'Detecta en tiempo real todos los repuestos con stock agotado o bajo en piso de venta (TIENDA <= stock_minimo) que cuentan con disponibilidad en almacén (DEPOSITO > 0).',
        responses: {
          200: { description: 'Listado global de alertas de reposición' }
        }
      }
    },

    '/api/v1/inventory/alerts/restock/{idSucursal}': {
      get: {
        tags: ['Alertas de Reposición'],
        summary: 'Alertas de reposición por sucursal',
        parameters: [{ name: 'idSucursal', in: 'path', required: true, schema: { type: 'integer' } }],
        responses: {
          200: { description: 'Alertas de reposición de la sucursal indicada' }
        }
      }
    },

    '/api/v1/inventory/transfers': {
      post: {
        tags: ['Inventario & Sucursales'],
        summary: 'Ejecutar traspaso interno (Depósito -> Tienda)',
        description: 'Mueve inventario atómicamente desde Bodega central a Mostrador, asentando el correspondiente movimiento en el Kardex.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['idSucursal', 'idItem', 'quantity'],
                properties: {
                  idSucursal: { type: 'integer', example: 1 },
                  idItem: { type: 'integer', example: 1 },
                  quantity: { type: 'integer', example: 2 },
                  userResponsible: { type: 'string', example: 'ALMACENISTA_01' },
                  reason: { type: 'string', example: 'Reposición por quiebre en exhibición' }
                }
              }
            }
          }
        },
        responses: {
          200: { description: 'Traspaso completado y registrado en Kardex' },
          409: { description: 'Stock insuficiente en depósito' }
        }
      }
    },

    '/api/v1/inventory/kardex/{idSucursal}/{idItem}': {
      get: {
        tags: ['Inventario & Sucursales'],
        summary: 'Consultar historial de movimientos (Kardex)',
        parameters: [
          { name: 'idSucursal', in: 'path', required: true, schema: { type: 'integer' } },
          { name: 'idItem', in: 'path', required: true, schema: { type: 'integer' } },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 50 } }
        ],
        responses: {
          200: { description: 'Asientos de auditoría de movimientos del repuesto' }
        }
      }
    },

    // =======================================================================
    // 4. PUNTO DE VENTA (POS) Y DEVOLUCIONES
    // =======================================================================
    '/api/v1/pos/sales': {
      get: {
        tags: ['Punto de Venta (POS)'],
        summary: 'Listar facturas de venta',
        parameters: [
          { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 20 } },
          { name: 'idSucursal', in: 'query', schema: { type: 'integer' } },
          { name: 'status', in: 'query', schema: { type: 'string', enum: ['COMPLETADA', 'DEVUELTA_PARCIAL', 'DEVUELTA_TOTAL', 'ANULADA'] } }
        ],
        responses: {
          200: { description: 'Listado paginado de ventas' }
        }
      },
      post: {
        tags: ['Punto de Venta (POS)'],
        summary: 'Procesar venta POS atómica (ACID)',
        description: 'Bloquea filas pesimistamente (`SELECT ... FOR UPDATE` ordenado por `id_inventario ASC`), valida saldo disponible en TIENDA, descuenta inventario, genera factura correlativa (`FAC-XXXXXXXX`) y asienta el movimiento en Kardex.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['idSucursal', 'paymentMethod', 'items'],
                properties: {
                  idSucursal: { type: 'integer', example: 1 },
                  clientName: { type: 'string', example: 'Transportes Los Andes C.A.' },
                  clientDoc: { type: 'string', example: 'J-12345678-9' },
                  paymentMethod: { type: 'string', enum: ['EFECTIVO', 'TARJETA', 'TRANSFERENCIA', 'CREDITO', 'MIXTO'], example: 'EFECTIVO' },
                  items: {
                    type: 'array',
                    items: {
                      type: 'object',
                      required: ['idItem', 'quantity'],
                      properties: {
                        idItem: { type: 'integer', example: 3 },
                        quantity: { type: 'integer', example: 2 },
                        discount: { type: 'number', example: 0.00 }
                      }
                    }
                  }
                }
              }
            }
          }
        },
        responses: {
          201: { description: 'Venta procesada exitosamente y factura generada' },
          409: { description: 'Stock insuficiente en piso de venta (Anti-Negativos)' }
        }
      }
    },

    '/api/v1/pos/sales/{idVenta}': {
      get: {
        tags: ['Punto de Venta (POS)'],
        summary: 'Consultar detalle completo de una venta',
        parameters: [{ name: 'idVenta', in: 'path', required: true, schema: { type: 'integer' } }],
        responses: {
          200: { description: 'Factura con sus líneas de detalle' },
          404: { description: 'Venta no encontrada' }
        }
      }
    },

    '/api/v1/pos/returns': {
      post: {
        tags: ['Devoluciones & Garantías'],
        summary: 'Procesar devolución de repuesto (Total o Parcial)',
        description: 'Registra nota de devolución (`DEV-XXXXXXXX`), reintegra stock físico (a `TIENDA`, `DEPOSITO` o `CUARENTENA` para revisión), asienta en Kardex y actualiza el estado de la venta original.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['idVenta', 'motivo', 'items'],
                properties: {
                  idVenta: { type: 'integer', example: 1 },
                  motivo: { type: 'string', example: 'Pieza incompatible con el chasis del cliente' },
                  metodoReembolso: { type: 'string', example: 'EFECTIVO' },
                  items: {
                    type: 'array',
                    items: {
                      type: 'object',
                      required: ['idDetalleVenta', 'quantity'],
                      properties: {
                        idDetalleVenta: { type: 'integer', example: 1 },
                        quantity: { type: 'integer', example: 1 },
                        destinoAlmacen: { type: 'string', enum: ['TIENDA', 'DEPOSITO', 'CUARENTENA'], default: 'TIENDA' }
                      }
                    }
                  }
                }
              }
            }
          }
        },
        responses: {
          201: { description: 'Devolución procesada y stock reintegrado' },
          409: { description: 'La cantidad a devolver excede la cantidad vendida original' }
        }
      }
    },

    // =======================================================================
    // 5. VEHÍCULOS & COMPATIBILIDAD
    // =======================================================================
    '/api/v1/vehicles/trucks': {
      get: {
        tags: ['Vehículos & Compatibilidad'],
        summary: 'Listar modelos de camiones',
        parameters: [
          { name: 'brand', in: 'query', schema: { type: 'string' } },
          { name: 'engine', in: 'query', schema: { type: 'string' } },
          { name: 'search', in: 'query', schema: { type: 'string' } },
          { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 20 } }
        ],
        responses: {
          200: { description: 'Listado paginado de camiones' }
        }
      },
      post: {
        tags: ['Vehículos & Compatibilidad'],
        summary: 'Registrar nuevo modelo de camión y motorización',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['truckBrand', 'truckModel', 'firstYear'],
                properties: {
                  truckBrand: { type: 'string', example: 'Kenworth' },
                  truckModel: { type: 'string', example: 'W900L' },
                  engineModel: { type: 'string', example: 'Caterpillar C15 15.2L' },
                  firstYear: { type: 'integer', example: 2005 },
                  lastYear: { type: 'integer', example: 2020 },
                  notes: { type: 'string', example: 'Capó largo tradicional' }
                }
              }
            }
          }
        },
        responses: {
          201: { description: 'Camión registrado exitosamente' },
          409: { description: 'Camión con idéntica configuración ya registrado' }
        }
      }
    },

    '/api/v1/vehicles/trucks/brands': {
      get: {
        tags: ['Vehículos & Compatibilidad'],
        summary: 'Listar marcas de camiones registradas',
        responses: {
          200: { description: 'Array de nombres de marcas pesadas' }
        }
      }
    },

    '/api/v1/vehicles/trucks/{idTruck}/items': {
      get: {
        tags: ['Vehículos & Compatibilidad'],
        summary: 'Búsqueda Inversa: Repuestos compatibles con un camión',
        description: 'Permite a un vendedor o taller seleccionar un modelo de camión y consultar todos los repuestos (filtros, válvulas, rodamientos, sensores) compatibles con él, incluyendo stock actual en tienda y almacén.',
        parameters: [
          { name: 'idTruck', in: 'path', required: true, schema: { type: 'integer' } },
          { name: 'search', in: 'query', schema: { type: 'string' } },
          { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 20 } }
        ],
        responses: {
          200: { description: 'Repuestos compatibles con el camión' }
        }
      }
    },

    '/api/v1/vehicles/items/{idItem}/trucks': {
      get: {
        tags: ['Vehículos & Compatibilidad'],
        summary: 'Búsqueda Directa: Camiones compatibles con un repuesto',
        parameters: [{ name: 'idItem', in: 'path', required: true, schema: { type: 'integer' } }],
        responses: {
          200: { description: 'Lista de camiones donde aplica el repuesto' }
        }
      }
    },

    '/api/v1/vehicles/compatibility': {
      post: {
        tags: ['Vehículos & Compatibilidad'],
        summary: 'Vincular repuesto a modelo de camión',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['idItem', 'idTruck'],
                properties: {
                  idItem: { type: 'integer', example: 4 },
                  idTruck: { type: 'integer', example: 1 },
                  positionNote: { type: 'string', example: 'Filtro primario de chasis' }
                }
              }
            }
          }
        },
        responses: {
          201: { description: 'Enlace de compatibilidad establecido' }
        }
      }
    },

    // =======================================================================
    // 6. ANALÍTICA & PREDICCIÓN (ROP)
    // =======================================================================
    '/api/v1/analytics/seasonal-demand': {
      get: {
        tags: ['Analítica & Predicción (ROP)'],
        summary: 'Demanda estacional por trimestres (Q1..Q4)',
        description: 'Desglose analítico de unidades vendidas y facturación neta por trimestre del año, identificando temporadas pico de rotación.',
        parameters: [
          { name: 'year', in: 'query', schema: { type: 'integer', example: 2026 } },
          { name: 'idItem', in: 'query', schema: { type: 'integer' } },
          { name: 'idSucursal', in: 'query', schema: { type: 'integer' } }
        ],
        responses: {
          200: { description: 'Métricas de rotación estacional' }
        }
      }
    },

    '/api/v1/analytics/reorder-points': {
      get: {
        tags: ['Analítica & Predicción (ROP)'],
        summary: 'Punto de Reorden (ROP) y Predicción de Importaciones',
        description: 'Calcula el ROP logístico: `ROP = (D_avg * LeadTime) + SafetyStock`, diagnosticando piezas críticas y generando la orden sugerida de compra y presupuesto estimado.',
        parameters: [
          { name: 'lookbackDays', in: 'query', schema: { type: 'integer', default: 90 }, description: 'Días hacia atrás para calcular la demanda diaria promedio' },
          { name: 'leadTimeDays', in: 'query', schema: { type: 'integer', default: 30 }, description: 'Tiempo de entrega logística del fabricante en días' },
          { name: 'safetyStockDays', in: 'query', schema: { type: 'integer', default: 7 }, description: 'Días de stock de seguridad para amortiguar picos' },
          { name: 'onlyAlerts', in: 'query', schema: { type: 'boolean', default: false }, description: 'Filtrar exclusivamente piezas con necesidad de reorden' },
          { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 50 } }
        ],
        responses: {
          200: { description: 'Reporte de reorden y sugerencias de importación' }
        }
      }
    },

    '/api/v1/analytics/dashboard': {
      get: {
        tags: ['Analítica & Predicción (ROP)'],
        summary: 'Dashboard Ejecutivo de KPIs',
        description: 'Métricas macro consolidadas: total de ítems activos, stock global por almacén, valuación a costo y precio de venta, facturas completadas y revenue neto.',
        responses: {
          200: { description: 'Dashboard de KPIs consolidado' }
        }
      }
    }
  },

  components: {
    schemas: {
      Brand: {
        type: 'object',
        properties: {
          idBrand: { type: 'integer', example: 1 },
          brandName: { type: 'string', example: 'Wabco' },
          countryOrigin: { type: 'string', example: 'Alemania' },
          logoUrl: { type: 'string', example: 'https://storage.googleapis.com/demo/wabco.webp' },
          createdAt: { type: 'string', format: 'date-time' }
        }
      },
      BrandResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: true },
          data: { $ref: '#/components/schemas/Brand' }
        }
      },
      Item: {
        type: 'object',
        properties: {
          idItem: { type: 'integer', example: 1 },
          itemName: { type: 'string', example: 'Válvula Pedal de Freno Neumático Doble Circuito' },
          itemDescription: { type: 'string', example: 'Válvula de servicio doble para Freightliner y Kenworth' },
          idBrand: { type: 'integer', example: 1 },
          brandName: { type: 'string', example: 'Wabco' },
          sku: { type: 'string', example: 'VAL-WAB-001' },
          cost: { type: 'number', example: 120.00 },
          price: { type: 'number', example: 185.00 },
          isActive: { type: 'boolean', example: true },
          mainOemCode: { type: 'string', example: '4725000072' },
          category: { type: 'string', example: 'VALVULA' }
        }
      },
      ItemResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: true },
          data: { $ref: '#/components/schemas/Item' }
        }
      },
      ItemDetailResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: true },
          data: {
            allOf: [
              { $ref: '#/components/schemas/Item' },
              {
                type: 'object',
                properties: {
                  oemCodes: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        idItemOem: { type: 'integer' },
                        oemCode: { type: 'string' },
                        cleanOemCode: { type: 'string' },
                        brandOrigin: { type: 'string' },
                        oemType: { type: 'string' },
                        isMain: { type: 'boolean' }
                      }
                    }
                  },
                  images: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        idImage: { type: 'integer' },
                        url: { type: 'string' },
                        thumbnailUrl: { type: 'string' },
                        isPrimary: { type: 'boolean' }
                      }
                    }
                  }
                }
              }
            ]
          }
        }
      },
      PaginationMeta: {
        type: 'object',
        properties: {
          total: { type: 'integer', example: 45 },
          page: { type: 'integer', example: 1 },
          limit: { type: 'integer', example: 20 },
          totalPages: { type: 'integer', example: 3 }
        }
      },
      ErrorResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: false },
          error: {
            type: 'object',
            properties: {
              code: { type: 'string', example: 'INSUFFICIENT_STOCK' },
              message: { type: 'string', example: 'Stock insuficiente para repuesto ID 1.' },
              details: { type: 'array', items: { type: 'object' } }
            }
          }
        }
      }
    }
  }
};
