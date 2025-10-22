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
import { homeRouter } from './routes/home.routes';
import { auth } from './middlewares/auth';
import { requireRole } from './middlewares/roles';
import reportsRoutes from './routes/reports.routes';

const app = express();

app.use(cors({
  origin: ['http://localhost:4200'],    // tu front
  methods: ['GET','POST','PUT','PATCH','DELETE','OPTIONS'],
  allowedHeaders: ['Content-Type','Authorization'],
  credentials: true,
}));

app.options('*', cors({
  origin: ['http://localhost:4200'],
  methods: ['GET','POST','PUT','PATCH','DELETE','OPTIONS'],
  allowedHeaders: ['Content-Type','Authorization'],
  credentials: true,
}));

app.use(express.json());

// públicas:
app.use('/api/auth', authRoutes);

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

//Ruta para usuarios
app.use('/api/usuarios', auth, requireRole('admin'), usersRouter);

//Ruta para clientes
app.use('/api/clientes', auth, clientesRouter);

//Ruta para productos
app.use('/api/productos', auth, productosRouter);
app.use('/api/inventario', auth, inventarioRouter);

// Ruta para ventas
app.use('/api/ventas', auth, ventasRouter);

//Ruta para recomendaciones
app.use('/api/recs', auth, recsRouter);

//Ruta para home
app.use('/api/home', auth, homeRouter);

//Ruta para reportes
app.use('/api/reports', auth, reportsRoutes);

// 404 controlado
app.use((_req, res) => {
  res.status(404).json({ ok: false, message: 'Ruta no encontrada' });
});

startRecsScheduler();

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`API escuchando en http://localhost:${PORT}`);
});
