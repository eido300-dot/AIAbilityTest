CREATE SCHEMA crm;
REVOKE CREATE ON SCHEMA public FROM PUBLIC;

CREATE TABLE crm.tenants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 200),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- תשתית בלבד: אין עדיין ממשק לקוחות או הרשאות אישיות/צוותיות.
CREATE TABLE crm.customers (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES crm.tenants(id),
  name text NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 200),
  kind text NOT NULL CHECK (kind IN ('person', 'company')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, id)
);

ALTER TABLE crm.tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm.tenants FORCE ROW LEVEL SECURITY;
ALTER TABLE crm.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm.customers FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON crm.tenants
  USING (id = nullif(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (id = nullif(current_setting('app.tenant_id', true), '')::uuid);

CREATE POLICY customer_isolation ON crm.customers
  USING (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);

GRANT USAGE ON SCHEMA crm TO crm_app;
GRANT SELECT ON crm.tenants TO crm_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON crm.customers TO crm_app;
