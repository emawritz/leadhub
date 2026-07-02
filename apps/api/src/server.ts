import { buildApp } from './app.js';
import { config } from './config.js';

const app = buildApp();
app.listen({ port: config.port, host: '0.0.0.0' })
  .then(() => console.log(`API on :${config.port}`))
  .catch((e) => { console.error(e); process.exit(1); });
