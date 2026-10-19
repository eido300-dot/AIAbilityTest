import { randomBytes } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const adminPassword = randomBytes(24).toString('hex');
const appPassword = randomBytes(24).toString('hex');
const content = [
  '# קובץ מקומי בלבד. אין להעלות למאגר או להשתמש בו בייצור.',
  `POSTGRES_PASSWORD=${adminPassword}`,
  `CRM_APP_PASSWORD=${appPassword}`,
  'POSTGRES_PORT=54329',
  `DATABASE_ADMIN_URL=postgresql://postgres:${adminPassword}@127.0.0.1:54329/crm`,
  `DATABASE_URL=postgresql://crm_app:${appPassword}@127.0.0.1:54329/crm`,
  'API_HOST=127.0.0.1',
  'API_PORT=3001',
  '',
].join('\n');

try {
  await writeFile(fileURLToPath(new URL('../.env', import.meta.url)), content, {
    flag: 'wx',
    mode: 0o600,
  });
  console.log('נוצר קובץ הגדרות מקומי עם סיסמאות אקראיות.');
} catch (error) {
  if (error.code !== 'EEXIST') throw error;
  console.log('קובץ ההגדרות הקיים נשמר ללא שינוי.');
}
