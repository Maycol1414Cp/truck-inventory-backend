import "dotenv/config";
import express from "express";
import cors from "cors";

//importamos controlador de la db
import pool from "./config/database.js";

//importamos rutas

//importamos product routes
import productRoutes from "./routes/product.routes.js";
import itemRoutes from "./routes/itemRoutes.js";

//import productRoutes from "./routes/productRoutes.js";

const app = express();

//middlewares

//permitir recibir datos en formato json
app.use(express.json());
//permitir acceso desde otro dominio
app.use(cors());
//montaje de rutas
app.use('/api/products', productRoutes);
app.use('/api/items', itemRoutes);


//health-check
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK', uptime: process.uptime() });
});


//montar routes
//app.use('/api/products', productRoutes);

//iniciar servidor
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📡 Connecting to GCP Database at ${process.env.DB_HOST}`);
});
// En tu app.js o database.js agrega esto para debug:
pool.connect((err, client, release) => {
  if (err) {
    return console.error('❌ Error adquiriendo cliente:\n', err.stack);
  }
  console.log('✅ Conexión exitosa a la base de datos en GCP');
  release();
});