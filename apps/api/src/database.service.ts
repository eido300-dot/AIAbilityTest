import { Injectable, type OnApplicationShutdown } from '@nestjs/common';
import { createPool, databaseUrl } from '@crm/database';

@Injectable()
export class DatabaseService implements OnApplicationShutdown {
  private readonly pool = createPool(databaseUrl());

  async isReady(): Promise<boolean> {
    try {
      const result = await this.pool.query<{
        safe: boolean;
        migrated: boolean;
      }>(`
        SELECT NOT (rolsuper OR rolbypassrls OR rolcreaterole OR rolcreatedb) AS safe,
               to_regclass('crm.customers') IS NOT NULL AS migrated
        FROM pg_roles WHERE rolname = current_user
      `);
      return result.rows[0]?.safe === true && result.rows[0].migrated === true;
    } catch {
      return false;
    }
  }

  async onApplicationShutdown(): Promise<void> {
    await this.pool.end();
  }
}
