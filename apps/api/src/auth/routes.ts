import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { accounts } from '../db/schema.js';
import { verifyPassword } from './password.js';

const loginSchema = z.object({ email: z.string().email(), password: z.string().min(1) });

export function authRoutes(app: FastifyInstance, db: NodePgDatabase) {
  app.post('/auth/login', async (req, reply) => {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ ok: false, error: 'Datos inválidos' });
    const { email, password } = parsed.data;
    const [acc] = await db.select().from(accounts).where(eq(accounts.email, email)).limit(1);
    if (!acc || !(await verifyPassword(acc.passwordHash, password))) {
      return reply.code(401).send({ ok: false, error: 'Credenciales inválidas' });
    }
    const token = app.jwt.sign({ sub: acc.id, email: acc.email, rol: acc.rol });
    return { ok: true, data: { token } };
  });

  app.get('/me', { preHandler: [async (r, rep) => {
    try { await r.jwtVerify(); } catch { rep.code(401).send({ ok: false, error: 'No autorizado' }); }
  }] }, async (req) => ({ ok: true, data: req.user }));
}
