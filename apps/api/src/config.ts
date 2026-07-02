import 'dotenv/config';

export const config = {
  databaseUrl: process.env.DATABASE_URL ?? '',
  databaseUrlTest: process.env.DATABASE_URL_TEST ?? '',
  jwtSecret: process.env.JWT_SECRET ?? 'dev-change-me',
  port: Number(process.env.PORT ?? 3001),
};
