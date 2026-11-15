import express from 'express';
import { app as weddingApp } from './server/app.js';

// Vercel detects Express through the root entrypoint's direct import.
const app = express();
app.disable('x-powered-by');
app.use(weddingApp);

export default app;
