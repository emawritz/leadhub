import Fastify, { type FastifyInstance } from 'fastify';
import cors from '@fastify/cors';

export function buildApp(): FastifyInstance {
  const app = Fastify({ logger: false });
  app.register(cors, { origin: true });
  app.get('/health', async () => ({ ok: true, data: { status: 'up' } }));
  return app;
}
