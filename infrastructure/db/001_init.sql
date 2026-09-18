CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$ BEGIN
  CREATE TYPE verification_status AS ENUM ('PENDING','VERIFIED','NEEDS_REVIEW','REJECTED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE freshness_status AS ENUM ('FRESH','AGING','STALE','UNKNOWN');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE capture_session_status AS ENUM ('CREATED','READY','CAPTURING','SUBMITTED','PROCESSING','COMPLETED','EXPIRED','CANCELLED','REJECTED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE evidence_integrity_status AS ENUM ('PENDING','MATCHED','FAILED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  public_id text UNIQUE NOT NULL,
  display_name text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS devices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  public_id text UNIQUE NOT NULL,
  platform text NOT NULL CHECK (platform IN ('ios','android','unknown')),
  attestation_status text NOT NULL DEFAULT 'NOT_CONFIGURED',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS places (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  public_id text UNIQUE NOT NULL,
  name text NOT NULL,
  category text NOT NULL,
  location geography(Point, 4326) NOT NULL,
  external_ids jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS places_location_gix ON places USING GIST(location);

CREATE TABLE IF NOT EXISTS features (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  public_id text UNIQUE NOT NULL,
  place_id uuid NOT NULL REFERENCES places(id) ON DELETE CASCADE,
  feature_type text NOT NULL,
  name text NOT NULL,
  location geography(Point, 4326),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS features_place_idx ON features(place_id);
CREATE INDEX IF NOT EXISTS features_location_gix ON features USING GIST(location);

CREATE TABLE IF NOT EXISTS verification_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  public_id text UNIQUE NOT NULL,
  feature_id uuid NOT NULL REFERENCES features(id) ON DELETE CASCADE,
  question_type text NOT NULL,
  question_text text NOT NULL,
  required_photo_count int NOT NULL DEFAULT 1 CHECK (required_photo_count >= 0),
  required_video_count int NOT NULL DEFAULT 0 CHECK (required_video_count >= 0),
  max_distance_m numeric(8,2) NOT NULL DEFAULT 15,
  max_accuracy_m numeric(8,2) NOT NULL DEFAULT 15,
  freshness_policy_days int NOT NULL DEFAULT 30,
  priority int NOT NULL DEFAULT 50,
  policy_version text NOT NULL DEFAULT '1.0',
  status text NOT NULL DEFAULT 'OPEN',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS verification_tasks_feature_idx ON verification_tasks(feature_id);
CREATE INDEX IF NOT EXISTS verification_tasks_status_idx ON verification_tasks(status);

CREATE TABLE IF NOT EXISTS capture_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  public_id text UNIQUE NOT NULL,
  task_id uuid NOT NULL REFERENCES verification_tasks(id),
  user_id uuid REFERENCES users(id),
  device_id uuid REFERENCES devices(id),
  nonce text NOT NULL,
  target_location geography(Point, 4326) NOT NULL,
  max_distance_m numeric(8,2) NOT NULL,
  max_accuracy_m numeric(8,2) NOT NULL,
  verification_policy_version text NOT NULL,
  task_snapshot jsonb NOT NULL,
  server_started_at timestamptz NOT NULL DEFAULT now(),
  server_expires_at timestamptz NOT NULL,
  status capture_session_status NOT NULL DEFAULT 'CREATED',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS capture_sessions_task_idx ON capture_sessions(task_id);
CREATE INDEX IF NOT EXISTS capture_sessions_user_idx ON capture_sessions(user_id);
CREATE INDEX IF NOT EXISTS capture_sessions_target_gix ON capture_sessions USING GIST(target_location);

CREATE TABLE IF NOT EXISTS location_samples (
  id bigserial PRIMARY KEY,
  capture_session_id uuid NOT NULL REFERENCES capture_sessions(id) ON DELETE CASCADE,
  location geography(Point, 4326) NOT NULL,
  accuracy_m numeric(8,2) NOT NULL,
  altitude_m numeric(10,2),
  heading_deg numeric(8,2),
  speed_mps numeric(10,3),
  device_timestamp timestamptz NOT NULL,
  server_received_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS location_samples_session_idx ON location_samples(capture_session_id, server_received_at);
CREATE INDEX IF NOT EXISTS location_samples_location_gix ON location_samples USING GIST(location);

CREATE TABLE IF NOT EXISTS media_evidence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  public_id text UNIQUE NOT NULL,
  capture_session_id uuid NOT NULL REFERENCES capture_sessions(id) ON DELETE CASCADE,
  media_type text NOT NULL CHECK (media_type IN ('photo','video','360')),
  capture_step int NOT NULL DEFAULT 1,
  storage_key text NOT NULL UNIQUE,
  mime_type text NOT NULL,
  byte_size bigint,
  client_sha256 text NOT NULL,
  server_sha256 text,
  captured_at timestamptz NOT NULL,
  server_received_at timestamptz,
  capture_location geography(Point, 4326) NOT NULL,
  gps_accuracy_m numeric(8,2) NOT NULL,
  width int,
  height int,
  duration_ms int,
  source text NOT NULL DEFAULT 'GOREADYTO_IN_APP_CAPTURE',
  integrity_status evidence_integrity_status NOT NULL DEFAULT 'PENDING',
  privacy_status text NOT NULL DEFAULT 'PENDING',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS media_evidence_session_idx ON media_evidence(capture_session_id);
CREATE INDEX IF NOT EXISTS media_evidence_location_gix ON media_evidence USING GIST(capture_location);

CREATE TABLE IF NOT EXISTS observations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  public_id text UNIQUE NOT NULL,
  feature_id uuid NOT NULL REFERENCES features(id),
  capture_session_id uuid NOT NULL REFERENCES capture_sessions(id),
  question_type text NOT NULL,
  value_boolean boolean,
  value_text text,
  value_number numeric,
  value_json jsonb,
  observed_at timestamptz NOT NULL,
  supersedes_observation_id uuid REFERENCES observations(id),
  publication_status text NOT NULL DEFAULT 'PUBLISHED',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS observations_feature_idx ON observations(feature_id, observed_at DESC);
CREATE INDEX IF NOT EXISTS observations_session_idx ON observations(capture_session_id);

CREATE TABLE IF NOT EXISTS verifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  observation_id uuid NOT NULL UNIQUE REFERENCES observations(id) ON DELETE CASCADE,
  location_score numeric(5,2) NOT NULL,
  time_score numeric(5,2) NOT NULL,
  device_score numeric(5,2) NOT NULL,
  media_integrity_score numeric(5,2) NOT NULL,
  task_completion_score numeric(5,2) NOT NULL,
  confidence_score numeric(5,2) NOT NULL,
  status verification_status NOT NULL,
  policy_version text NOT NULL,
  verified_at timestamptz,
  review_reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS freshness_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  observation_id uuid NOT NULL UNIQUE REFERENCES observations(id) ON DELETE CASCADE,
  fresh_from timestamptz NOT NULL,
  fresh_until timestamptz NOT NULL,
  aging_from timestamptz NOT NULL,
  status freshness_status NOT NULL DEFAULT 'FRESH',
  policy_days int NOT NULL,
  checked_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS audit_events (
  id bigserial PRIMARY KEY,
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  event_type text NOT NULL,
  actor_type text NOT NULL DEFAULT 'SYSTEM',
  actor_id uuid,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS audit_events_entity_idx ON audit_events(entity_type, entity_id, created_at DESC);

INSERT INTO users(public_id, display_name)
VALUES ('GR-USER-DEV', 'Development User')
ON CONFLICT (public_id) DO NOTHING;
