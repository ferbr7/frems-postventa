import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import authRoutes from './routes/auth.routes';
import usersRouter from './routes/users.routes';
import { clientesRouter } from './routes/clientes.routes';
import { productosRouter } from './routes/productos.routes';
import { inventarioRouter } from './routes/inventario.routes';
import { ventasRouter } from './routes/ventas.routes';
import { recsRouter} from './routes/recs.routes';
import { startRecsScheduler } from './recs.scheduler';

const app = express();

// Logs de depuración de rutas:
app.use((req, _res, next) => {
  console.log(`[${req.method}] ${req.originalUrl}`);
  next();
});

// Middlewares
app.use(cors({ origin: 'http://localhost:4200', credentials: true }));
app.use(express.json());

// Ruta para probar rápido
app.get('/api/health', (_req, res) => {
  res.json({ ok: true, timestamp: new Date().toISOString() });
});

// Ruta de autenticación
app.use('/api/auth', authRoutes);

//Ruta para usuarios
app.use('/api/usuarios', usersRouter);

//Ruta para clientes
app.use('/api/clientes', clientesRouter);

//Ruta para productos
app.use('/api/productos', productosRouter);
app.use('/api/inventario', inventarioRouter);

// Ruta para ventas
app.use('/api/ventas', ventasRouter);

app.use('/api/recs', recsRouter);

// 404 controlado
app.use((_req, res) => {
  res.status(404).json({ ok: false, message: 'Ruta no encontrada' });
});

startRecsScheduler();

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`API escuchando en http://localhost:${PORT}`);
});
