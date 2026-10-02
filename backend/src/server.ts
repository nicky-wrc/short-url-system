import { app } from './app.js';
import { pool } from './db.js';
import { config } from './config.js';

await pool.query('SELECT 1');
const server = app.listen(config.PORT, '0.0.0.0', () => console.log(`Link Studio listening on port ${config.PORT}`));
function shutdown() {
  server.close(() => { pool.end().then(() => process.exit(0)); });
  setTimeout(() => process.exit(1), 10000).unref();
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
