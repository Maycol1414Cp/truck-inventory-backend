# 🤖 AGENTS.MD: PROTOCOLO OPERATIVO DEL SISTEMA DE INVENTARIO Y POS

Este documento es el **manual operativo de lectura obligatoria** para cualquier agente de inteligencia artificial, desarrollador o proceso automatizado que trabaje en el repositorio `backend-inventario-truck-parts`. Todo cambio de código o refactorización debe apegarse estrictamente a los lineamientos aquí descritos.

---

## 1. IDENTIDAD TÉCNICA Y STACK OBLIGATORIO

- **Entorno de Ejecución:** Node.js v18+ / v20+ LTS.
- **Sistema de Módulos:** **ES Modules (ESM) estricto**. Todo archivo JavaScript utiliza sintaxis `import / export`. 
  - **REGLA DE ORO:** Las importaciones relativas locales **DEBEN** incluir la extensión `.js` de forma explícita (e.g. `import pool from '../config/database.js';`). Omitir la extensión provoca fallo inmediato de ejecución en Node.js ESM.
- **Framework Web:** Express 5 (`express@^5.2.1`).
- **Persistencia de Datos:** Driver nativo de PostgreSQL (`pg@^8.21.0`) con Pool de conexiones gestionado.
- **PROHIBICIÓN ESTRICTA DE ORMs:**
  > ⛔ **ESTÁ TOTALMENTE PROHIBIDO INSTALAR O UTILIZAR ORMs** (tales como Prisma, Sequelize, Drizzle, TypeORM o Mongoose).
  > **Razón técnica:** La lógica de concurrencia del módulo POS requiere bloqueos pesimistas granulares deterministas (`SELECT ... FOR UPDATE`), soporte nativo de extensiones (`pg_trgm`) y control absoluto del ciclo de vida de transacciones para evitar deadlocks y latencias de motor. Toda la persistencia se gestiona en la capa de Repositorios mediante consultas SQL nativas parametrizadas.
- **Procesamiento de Imágenes:** `multer` (configurado exclusivamente con `memoryStorage`) y `sharp` para optimización y conversión a WebP.

---

## 2. COMANDOS ESTÁNDAR DE TERMINAL (NPM SCRIPTS)

El proyecto debe operar mediante los siguientes scripts estandarizados en `package.json`:

| Comando | Propósito | Descripción Técnica |
| :--- | :--- | :--- |
| `npm run dev` | Servidor en desarrollo | Ejecuta `nodemon src/app.js` con recarga en caliente ante cambios. |
| `npm start` | Servidor en producción | Ejecuta `node src/app.js` en modo servidor standalone. |
| `npm run migrate` | Ejecución de DDL | Ejecuta `node src/database/runMigration.js` para aplicar el esquema maestro de base de datos de manera controlada. |
| `npm run seed` | Carga de datos demo | Ejecuta `node src/database/seeds/runSeed.js` para poblar sucursales, marcas y repuestos de prueba. |
| `npm test` | Suite de pruebas | Ejecuta el runner de pruebas (Node Test Runner / Jest / Vitest en ESM). |
| `npm run lint` | Análisis estático | Verifica consistencia de código y ausencia de variables no utilizadas o malas prácticas de sintaxis. |

---

## 3. RESTRICCIONES Y POLÍTICAS DEL AGENTE

1. **Inmutabilidad de `src/database/init.sql` post-migración:**
   - Una vez consolidada la versión base en producción/desarrollo, está prohibido modificar `init.sql` para alterar estructuras existentes.
   - Cualquier evolución de tablas, índices o vistas debe generarse mediante scripts incrementales numerados dentro de `src/database/migrations/` (e.g., `001_add_column_x.sql`).
2. **Control Estricto de Dependencias NPM:**
   - Queda prohibido instalar paquetes npm de manera impulsiva o no justificada.
   - Todo paquete nuevo requiere justificación técnica sólida y compatibilidad nativa con ES Modules.
3. **Seguridad y Secretos:**
   - **NUNCA** commitear archivos `.env`, contraseñas de bases de datos, claves de acceso a buckets o tokens en el código fuente.
   - Todo valor sensible debe cargarse a través de `process.env` gestionado por `dotenv`.
4. **Buenas Prácticas de Código:**
   - No usar `var`; emplear únicamente `const` (por defecto) y `let` (cuando la reasignación sea indispensable).
   - Manejo de asincronía exclusivamente con `async / await` envuelto en bloques `try...catch` o delegando en middlewares de error centralizados.
   - Prohibido el código huérfano (código muerto o endpoints sin montar).
5. **Convenciones de Nomenclatura:**
   - **JavaScript / JSON:** `camelCase` para variables, funciones, nombres de propiedades de objetos, campos de requests/responses JSON y query params (e.g. `idItem`, `stockTienda`, `oemCode`).
   - **Base de Datos PostgreSQL:** `snake_case` para nombres de tablas, columnas, funciones y vistas (e.g. `id_item`, `inventario_stock`, `oem_code`).
   - La capa de Repositorios o Mappers es la responsable de transformar bidireccionalmente `snake_case` <-> `camelCase`.

---

## 4. PROTOCOLO DE VERIFICACIÓN AUTÓNOMA

Antes de dar por concluida cualquier tarea o reportar un cambio como finalizado, el agente debe ejecutar de forma autónoma el siguiente checklist:

```bash
# 1. Verificación de sintaxis de archivos nuevos o modificados
node --check src/path/al/archivo.js

# 2. Comprobación de que todas las importaciones relativas tienen extensión .js
# (Previene errores ERR_MODULE_NOT_FOUND en runtime)

# 3. Verificación de que el servidor levanta sin excepciones no controladas
# Comprobar que no existan errores de importación circular o variables no definidas

# 4. Prueba funcional del endpoint / consulta
# Ejecutar la llamada correspondiente o validar el script de base de datos
```

### Checklist Mental del Agente:
- [ ] ¿La consulta SQL está 100% parametrizada con `$1, $2, ...`? (Sin interpolación `${}`).
- [ ] En transacciones POS o movimientos de stock: ¿Se utilizó `withTransaction` con `client`?
- [ ] En operaciones de venta/descuento de stock: ¿Se implementó `FOR UPDATE` ordenado por `id_inventario ASC`?
- [ ] ¿Se registró el correspondiente asiento en el Kardex (`inventario_movimiento`)?
- [ ] ¿El endpoint responde bajo la estructura estándar de `{ success: true, data: ... }` o `{ success: false, error: ... }`?
- [ ] ¿Se actualizó la tarea correspondiente en `docs/TASKS.md` marcando con `[x]`?

---

## 5. ÍNDICE DE DOCUMENTACIÓN TÉCNICA OBLIGATORIA

Todo agente debe consultar y sincronizarse con la documentación oficial del proyecto antes de generar o alterar código:

| Documento | Ubicación | Propósito |
| :--- | :--- | :--- |
| **Hoja de Ruta Maestra** | [`docs/ROADMAP.md`](file:///home/mich/Documents/portafolio/inventario-truck-parts/backend-inventario-truck-parts/docs/ROADMAP.md) | Visión global, arquitectura del sistema, micro-fases y diseño conceptual de módulos. |
| **Estándar de Base de Datos** | [`docs/DATABASE.md`](file:///home/mich/Documents/portafolio/inventario-truck-parts/backend-inventario-truck-parts/docs/DATABASE.md) | DDL completo, transacciones ACID, protocolo anti-concurrencia, Kardex y consultas GIN/Trigram. |
| **Contratos de API REST** | [`docs/apiConventions.md`](file:///home/mich/Documents/portafolio/inventario-truck-parts/backend-inventario-truck-parts/docs/apiConventions.md) | Estructura JSON unificada, códigos HTTP, catálogo de errores de negocio y versionado `/api/v1/`. |
| **Control de Tareas y Estado** | [`docs/TASKS.md`](file:///home/mich/Documents/portafolio/inventario-truck-parts/backend-inventario-truck-parts/docs/TASKS.md) | Checklist interactivo granular de tareas por micro-fase. Debe mantenerse actualizado tras cada hito. |
