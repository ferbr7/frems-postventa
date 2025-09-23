import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import authRoutes from './routes/auth.routes';
import usersRouter from './routes/users.routes';


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

// 404 controlado
app.use((_req, res) => {
  res.status(404).json({ ok: false, message: 'Ruta no encontrada' });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`API escuchando en http://localhost:${PORT}`);
});
