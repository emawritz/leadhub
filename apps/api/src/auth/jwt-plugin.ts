import fp from 'fastify-plugin';
import jwt from '@fastify/jwt';
import { config } from '../config.js';

export const jwtPlugin = fp(async (app) => {
  app.register(jwt, { secret: config.jwtSecret });
});
