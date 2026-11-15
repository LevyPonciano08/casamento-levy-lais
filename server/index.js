import { app } from './app.js';
import { pool } from './db.js';
const server = app.listen(Number(process.env.PORT || 3000), () => console.log(`Site: http://localhost:${process.env.PORT || 3000}`));
for (const signal of ['SIGTERM','SIGINT']) process.on(signal, () => server.close(async () => { await pool.end(); process.exit(0); }));
