import { Pool, type PoolClient } from 'pg';

export { databaseUrl } from './env';

export function createPool(connectionString: string, max = 5): Pool {
  const pool = new Pool({
    connectionString,
    max,
    connectionTimeoutMillis: 3_000,
    idleTimeoutMillis: 10_000,
    statement_timeout: 5_000,
    idle_in_transaction_session_timeout: 10_000,
  });
  pool.on('error', () => {
    // ניתוק חיבור לא פעיל לא יפיל את התהליך ולא יחשוף פרטי גישה.
    console.error('חיבור לא פעיל לבסיס הנתונים נותק.');
  });
  return pool;
}

export async function withTenant<T>(
  pool: Pool,
  tenantId: string,
  operation: (client: PoolClient) => Promise<T>,
): Promise<T> {
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      tenantId,
    )
  ) {
    throw new Error('Invalid tenant identifier');
  }
  // זהות העסק חייבת להגיע מחברות מאומתת, לעולם לא ישירות מבקשת משתמש.
  const client = await pool.connect();
  let discard = false;
  try {
    await client.query('BEGIN');
    await client.query("SELECT set_config('app.tenant_id', $1, true)", [
      tenantId,
    ]);
    const result = await operation(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch {
      discard = true;
    }
    throw error;
  } finally {
    client.release(discard);
  }
}
