-- Fix PostgreSQL permissions for Ponder user
-- This script grants necessary permissions to the ponder user
-- to create tables and work with the public schema

-- First, ensure we're connected to the correct database
-- Run this script as superuser (postgres) in the ponder database

-- Grant all privileges on the database itself
GRANT ALL PRIVILEGES ON DATABASE ponder TO ponder;

-- Grant usage and create permissions on the public schema
GRANT USAGE, CREATE ON SCHEMA public TO ponder;

-- Grant all privileges on all existing tables in public schema
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO ponder;

-- Grant all privileges on all existing sequences in public schema
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO ponder;

-- Grant all privileges on all existing functions in public schema
GRANT ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA public TO ponder;

-- Set default privileges for future objects created by ponder
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO ponder;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO ponder;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO ponder;

-- Make ponder the owner of the public schema (optional, but ensures full control)
-- ALTER SCHEMA public OWNER TO ponder;

-- Verify the permissions (optional check)
SELECT
    nspname as schema_name,
    has_schema_privilege('ponder', nspname, 'CREATE') as can_create,
    has_schema_privilege('ponder', nspname, 'USAGE') as can_use
FROM pg_namespace
WHERE nspname = 'public';

-- Check table permissions
SELECT
    tablename,
    has_table_privilege('ponder', schemaname||'.'||tablename, 'SELECT') as can_select,
    has_table_privilege('ponder', schemaname||'.'||tablename, 'INSERT') as can_insert,
    has_table_privilege('ponder', schemaname||'.'||tablename, 'UPDATE') as can_update,
    has_table_privilege('ponder', schemaname||'.'||tablename, 'DELETE') as can_delete
FROM pg_tables
WHERE schemaname = 'public'
LIMIT 5;