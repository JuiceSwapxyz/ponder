-- PostgreSQL initialization script
-- This file will be executed when the PostgreSQL container is first created
-- Place this file in postgres-init/ directory and mount it to /docker-entrypoint-initdb.d/

-- Ensure we're using the correct database
\c ponder;

-- Grant all privileges on the database
GRANT ALL PRIVILEGES ON DATABASE ponder TO ponder;

-- Grant schema permissions
GRANT USAGE, CREATE ON SCHEMA public TO ponder;

-- Grant all privileges on all objects in public schema
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO ponder;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO ponder;
GRANT ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA public TO ponder;

-- Set default privileges for future objects
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO ponder;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO ponder;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO ponder;

-- Optional: Make ponder the owner of public schema
-- Uncomment if you want full ownership
-- ALTER SCHEMA public OWNER TO ponder;

-- Confirm permissions are set
DO $$
BEGIN
  RAISE NOTICE 'PostgreSQL permissions have been configured for user: ponder';
END $$;