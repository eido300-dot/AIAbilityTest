import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createPool } from './index';
import { databaseUrl } from './env';

async function migrate(): Promise<void> {
  const pool = createPool(databaseUrl('DATABASE_ADMIN_URL'), 1);
  const client = await pool.connect();
  try {
    await client.query('SELECT pg_advisory_lock(827341)');
    await client.query(`CREATE TABLE IF NOT EXISTS public.schema_migrations (
      name text PRIMARY KEY,
      checksum text NOT NULL,
      applied_at timestamptz NOT NULL DEFAULT now()
    )`);
    const directory = resolve(__dirname, '../migrations');
    const files = (await readdir(directory))
      .filter((name) => name.endsWith('.sql'))
      .sort();
    for (const name of files) {
      const sql = await readFile(resolve(directory, name), 'utf8');
      const checksum = createHash('sha256').update(sql).digest('hex');
      const previous = await client.query<{ checksum: string }>(
        'SELECT checksum FROM public.schema_migrations WHERE name = $1',
        [name],
      );
      if (previous.rows[0]) {
        if (previous.rows[0].checksum !== checksum) {
          throw new Error(`Applied migration was modified: ${name}`);
        }
        continue;
      }
      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query(
          'INSERT INTO public.schema_migrations (name, checksum) VALUES ($1, $2)',
          [name, checksum],
        );
        await client.query('COMMIT');
        console.log(`Applied migration: ${name}`);
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      }
    }
    console.log('מבנה בסיס הנתונים מעודכן.');
  } finally {
    await client.query('SELECT pg_advisory_unlock(827341)');
    client.release();
    await pool.end();
  }
}

migrate().catch((error: unknown) => {
  // שגיאת חיבור עלולה להכיל פרטי גישה; אין להדפיס אותה בשלמותה.
  console.error(
    'עדכון בסיס הנתונים נכשל. בדקו חיבור, הרשאות ושלמות קובצי הגרסאות.',
  );
  if (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    typeof error.code === 'string' &&
    /^[A-Z0-9_]+$/.test(error.code)
  ) {
    console.error(`קוד אבחון: ${error.code}`);
  }
  process.exitCode = 1;
});
