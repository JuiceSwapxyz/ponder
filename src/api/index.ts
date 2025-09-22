import express, { Request, Response, NextFunction, ErrorRequestHandler } from 'express';
import cors from 'cors';
import { getCampaignProgress, checkSwapTransaction, completeTask } from './controllers/campaignController';

const app = express();
const PORT = process.env.PORT || 3003;

// Middleware
app.use(cors());
app.use(express.json());

// Health check endpoint
app.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', service: 'JuiceSwap Campaign API' });
});

// Campaign endpoints
app.post('/campaign/progress', getCampaignProgress);
app.post('/campaign/check-swap', checkSwapTransaction);
app.post('/campaign/complete-task', completeTask);

// Error handling middleware
const errorHandler: ErrorRequestHandler = (error, req, res, next) => {
  console.error('API Error:', error);
  res.status(500).json({
    error: 'Internal server error',
    code: 'SERVER_ERROR'
  });
};

app.use(errorHandler);

// Start server
if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`🚀 JuiceSwap Campaign API running on port ${PORT}`);
  });
}

export default app;