import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createPool, withTenant } from './index';
import { databaseUrl } from './env';

// חיבורי בדיקה חייבים להיות למסד פיתוח ייעודי. אין להריץ נגד נתוני ייצור.
const admin = createPool(databaseUrl('DATABASE_ADMIN_URL'), 1);
const runtime = createPool(databaseUrl(), 1);
const concurrent = createPool(databaseUrl(), 2);
const tenantA = randomUUID();
const tenantB = randomUUID();
const customerA = randomUUID();
const customerB = randomUUID();

beforeAll(async () => {
  await admin.query(
    'INSERT INTO crm.tenants (id, name) VALUES ($1, $2), ($3, $4)',
    [tenantA, 'עסק בדיקה א', tenantB, 'עסק בדיקה ב'],
  );
  await admin.query(
    "INSERT INTO crm.customers (tenant_id, id, name, kind) VALUES ($1, $2, 'לקוח א', 'company'), ($3, $4, 'לקוח ב', 'person')",
    [tenantA, customerA, tenantB, customerB],
  );
});

afterAll(async () => {
  try {
    await admin.query(
      'DELETE FROM crm.customers WHERE tenant_id = ANY($1::uuid[])',
      [[tenantA, tenantB]],
    );
    await admin.query('DELETE FROM crm.tenants WHERE id = ANY($1::uuid[])', [
      [tenantA, tenantB],
    ]);
  } finally {
    await Promise.all([runtime.end(), concurrent.end(), admin.end()]);
  }
});

describe('בידוד עסקים מול פוסטגרס אמיתי', () => {
  it('חשבון היישום אינו מנהל ואינו עוקף בידוד', async () => {
    const result = await runtime.query(
      'SELECT rolsuper, rolbypassrls, rolcreatedb, rolcreaterole FROM pg_roles WHERE rolname = current_user',
    );
    expect(result.rows[0]).toEqual({
      rolsuper: false,
      rolbypassrls: false,
      rolcreatedb: false,
      rolcreaterole: false,
    });
  });

  it('ללא הקשר עסקי לא מוחזר מידע', async () => {
    expect((await runtime.query('SELECT * FROM crm.customers')).rows).toEqual(
      [],
    );
    expect((await runtime.query('SELECT * FROM crm.tenants')).rows).toEqual([]);
  });

  it('עסק רואה את הרשומות שלו בלבד', async () => {
    const result = await withTenant(runtime, tenantA, (client) =>
      client.query('SELECT id FROM crm.customers'),
    );
    expect(result.rows).toEqual([{ id: customerA }]);
  });

  it('גם רשימת העסקים מבודדת', async () => {
    const result = await withTenant(runtime, tenantB, (client) =>
      client.query('SELECT id FROM crm.tenants'),
    );
    expect(result.rows).toEqual([{ id: tenantB }]);
  });

  it('ניחוש מזהה של לקוח מעסק אחר אינו חושף אותו', async () => {
    const result = await withTenant(runtime, tenantA, (client) =>
      client.query('SELECT * FROM crm.customers WHERE id = $1', [customerB]),
    );
    expect(result.rowCount).toBe(0);
  });

  it('יצירת רשומה לעסק אחר נחסמת', async () => {
    await expect(
      withTenant(runtime, tenantA, (client) =>
        client.query(
          "INSERT INTO crm.customers (tenant_id, name, kind) VALUES ($1, 'אסור', 'person')",
          [tenantB],
        ),
      ),
    ).rejects.toMatchObject({ code: '42501' });
  });

  it('עדכון רשומה מעסק אחר אינו משנה דבר', async () => {
    const result = await withTenant(runtime, tenantA, (client) =>
      client.query("UPDATE crm.customers SET name = 'אסור' WHERE id = $1", [
        customerB,
      ]),
    );
    expect(result.rowCount).toBe(0);
  });

  it('מחיקת רשומה מעסק אחר אינה מוחקת דבר', async () => {
    const result = await withTenant(runtime, tenantA, (client) =>
      client.query('DELETE FROM crm.customers WHERE id = $1', [customerB]),
    );
    expect(result.rowCount).toBe(0);
  });

  it('אי אפשר להעביר רשומה לעסק אחר באמצעות עדכון', async () => {
    await expect(
      withTenant(runtime, tenantA, (client) =>
        client.query('UPDATE crm.customers SET tenant_id = $1 WHERE id = $2', [
          tenantB,
          customerA,
        ]),
      ),
    ).rejects.toMatchObject({ code: '42501' });
  });

  it('הקשר אינו דולף בחיבור ממוחזר לאחר הצלחה', async () => {
    await withTenant(runtime, tenantA, (client) =>
      client.query('SELECT * FROM crm.customers'),
    );
    expect((await runtime.query('SELECT * FROM crm.customers')).rows).toEqual(
      [],
    );
  });

  it('כשל מבטל שינויים ומנקה את ההקשר', async () => {
    const id = randomUUID();
    await expect(
      withTenant(runtime, tenantA, async (client) => {
        await client.query(
          "INSERT INTO crm.customers (tenant_id, id, name, kind) VALUES ($1, $2, 'יבוטל', 'person')",
          [tenantA, id],
        );
        throw new Error('בדיקת ביטול');
      }),
    ).rejects.toThrow('בדיקת ביטול');
    expect(
      (await admin.query('SELECT id FROM crm.customers WHERE id = $1', [id]))
        .rowCount,
    ).toBe(0);
    expect((await runtime.query('SELECT * FROM crm.customers')).rowCount).toBe(
      0,
    );
  });

  it('עסק יכול ליצור, לעדכן ולמחוק רשומה שלו', async () => {
    await withTenant(runtime, tenantA, async (client) => {
      const inserted = await client.query(
        "INSERT INTO crm.customers (tenant_id, name, kind) VALUES ($1, 'חדש', 'company') RETURNING id",
        [tenantA],
      );
      const id: string = inserted.rows[0].id;
      expect(
        (
          await client.query(
            "UPDATE crm.customers SET name = 'עודכן' WHERE id = $1 RETURNING name",
            [id],
          )
        ).rows,
      ).toEqual([{ name: 'עודכן' }]);
      expect(
        (await client.query('DELETE FROM crm.customers WHERE id = $1', [id]))
          .rowCount,
      ).toBe(1);
    });
  });

  it('חשבונות מקבילים אינם מחליפים הקשר', async () => {
    const results = await Promise.all(
      [tenantA, tenantB].map((tenant) =>
        withTenant(concurrent, tenant, async (client) => {
          await client.query('SELECT pg_sleep(0.05)');
          return (await client.query('SELECT tenant_id FROM crm.customers'))
            .rows;
        }),
      ),
    );
    expect(results).toEqual([
      [{ tenant_id: tenantA }],
      [{ tenant_id: tenantB }],
    ]);
  });

  it('חשבון היישום אינו רשאי לשנות מבנה', async () => {
    await expect(
      runtime.query('ALTER TABLE crm.customers DISABLE ROW LEVEL SECURITY'),
    ).rejects.toMatchObject({ code: '42501' });
  });

  it('מזהה עסק שאינו תקין נדחה לפני ביצוע', async () => {
    await expect(
      withTenant(runtime, 'invalid', async () => 'never'),
    ).rejects.toThrow('Invalid tenant identifier');
  });
});
