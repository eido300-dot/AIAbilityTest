import { resolve } from 'node:path';
import { config } from 'dotenv';

// משתני סביבה שהוזרקו מקבלים עדיפות; אין הדפסה של ערכים.
config({ path: resolve(__dirname, '../../../.env'), quiet: true });

export function databaseUrl(name = 'DATABASE_URL'): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required configuration: ${name}`);
  const url = new URL(value);
  if (!['postgresql:', 'postgres:'].includes(url.protocol)) {
    throw new Error(`Invalid database protocol: ${name}`);
  }
  return value;
}
