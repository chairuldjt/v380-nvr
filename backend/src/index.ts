import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import apiRoutes from './routes/api';

// This will instantiate the service and auto-start cameras if configured
import './services/v380-wrapper';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

// Main API Routes
app.use('/api', apiRoutes);

app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'v380-nvr-backend' });
});

app.listen(PORT, () => {
  console.log(`[Backend] V380 NVR Backend running on http://localhost:${PORT}`);
});
