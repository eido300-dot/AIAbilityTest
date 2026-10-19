import { createApp } from './app';

async function main() {
  const port = Number(process.env.API_PORT ?? 3001);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('Invalid API_PORT');
  }
  const app = await createApp();
  await app.listen(port, process.env.API_HOST ?? '127.0.0.1');
  console.log('שרת הפיתוח פועל.');
}

main().catch(() => {
  console.error('הפעלת השרת נכשלה. בדקו הגדרות ויציאות פנויות.');
  process.exitCode = 1;
});
