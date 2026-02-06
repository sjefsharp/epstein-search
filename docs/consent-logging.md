# Consent logging (Neon)

This project logs consent events in Neon Postgres with separate tables per locale.

## Schema

```sql
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS consent_events_en (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type text NOT NULL CHECK (event_type IN ('accept','reject','update','withdraw')),
  ads_consent boolean NOT NULL,
  policy_version text NOT NULL,
  locale text NOT NULL CHECK (locale = 'en'),
  event_timestamp timestamptz NOT NULL,
  received_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS consent_events_nl (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type text NOT NULL CHECK (event_type IN ('accept','reject','update','withdraw')),
  ads_consent boolean NOT NULL,
  policy_version text NOT NULL,
  locale text NOT NULL CHECK (locale = 'nl'),
  event_timestamp timestamptz NOT NULL,
  received_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS consent_events_fr (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type text NOT NULL CHECK (event_type IN ('accept','reject','update','withdraw')),
  ads_consent boolean NOT NULL,
  policy_version text NOT NULL,
  locale text NOT NULL CHECK (locale = 'fr'),
  event_timestamp timestamptz NOT NULL,
  received_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS consent_events_de (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type text NOT NULL CHECK (event_type IN ('accept','reject','update','withdraw')),
  ads_consent boolean NOT NULL,
  policy_version text NOT NULL,
  locale text NOT NULL CHECK (locale = 'de'),
  event_timestamp timestamptz NOT NULL,
  received_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS consent_events_es (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type text NOT NULL CHECK (event_type IN ('accept','reject','update','withdraw')),
  ads_consent boolean NOT NULL,
  policy_version text NOT NULL,
  locale text NOT NULL CHECK (locale = 'es'),
  event_timestamp timestamptz NOT NULL,
  received_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS consent_events_pt (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type text NOT NULL CHECK (event_type IN ('accept','reject','update','withdraw')),
  ads_consent boolean NOT NULL,
  policy_version text NOT NULL,
  locale text NOT NULL CHECK (locale = 'pt'),
  event_timestamp timestamptz NOT NULL,
  received_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS consent_events_en_received_at_idx ON consent_events_en (received_at);
CREATE INDEX IF NOT EXISTS consent_events_nl_received_at_idx ON consent_events_nl (received_at);
CREATE INDEX IF NOT EXISTS consent_events_fr_received_at_idx ON consent_events_fr (received_at);
CREATE INDEX IF NOT EXISTS consent_events_de_received_at_idx ON consent_events_de (received_at);
CREATE INDEX IF NOT EXISTS consent_events_es_received_at_idx ON consent_events_es (received_at);
CREATE INDEX IF NOT EXISTS consent_events_pt_received_at_idx ON consent_events_pt (received_at);
```

## Retention cleanup (12 months)

```sql
DELETE FROM consent_events_en WHERE received_at < NOW() - INTERVAL '12 months';
DELETE FROM consent_events_nl WHERE received_at < NOW() - INTERVAL '12 months';
DELETE FROM consent_events_fr WHERE received_at < NOW() - INTERVAL '12 months';
DELETE FROM consent_events_de WHERE received_at < NOW() - INTERVAL '12 months';
DELETE FROM consent_events_es WHERE received_at < NOW() - INTERVAL '12 months';
DELETE FROM consent_events_pt WHERE received_at < NOW() - INTERVAL '12 months';
```

## API endpoints

- `POST /api/consent` logs consent events.
- `POST /api/consent/cleanup` removes records older than 12 months (requires `CRON_SECRET`).

## Cron scheduling

For Vercel Cron, configure a daily schedule that calls `/api/consent/cleanup`.
The endpoint accepts the Vercel Cron header (`x-vercel-cron: 1`) or `x-cron-secret` for manual runs.
