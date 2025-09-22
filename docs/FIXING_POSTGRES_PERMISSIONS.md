# Fixing PostgreSQL Permission Errors in Production

## Problem

The production server shows the following error:
```
error: permission denied for schema public
```

This prevents Ponder from creating tables in the PostgreSQL database.

## Solutions

### Solution 1: Quick Fix (Existing Database)

Run the fix script if your production database is already running:

```bash
# From the project root
./scripts/fix-production-permissions.sh
```

This script will:
1. Connect to your PostgreSQL database
2. Grant all necessary permissions to the `ponder` user
3. Restart the Ponder service

### Solution 2: Docker Compose (Recommended)

If using Docker Compose, the permissions are now automatically fixed on container creation:

1. **For a fresh deployment:**
   ```bash
   docker-compose down -v  # Remove old volumes
   docker-compose up -d    # Start with fixed permissions
   ```

2. **For an existing deployment:**
   ```bash
   # Connect to the postgres container and run the fix
   docker-compose exec postgres psql -U postgres -d ponder -f /docker-entrypoint-initdb.d/01-fix-permissions.sql

   # Then restart the ponder service
   docker-compose restart ponder
   ```

### Solution 3: Manual SQL Fix

If you have direct database access, run this SQL as a superuser:

```sql
-- Connect to the ponder database
\c ponder;

-- Grant permissions
GRANT ALL PRIVILEGES ON DATABASE ponder TO ponder;
GRANT USAGE, CREATE ON SCHEMA public TO ponder;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO ponder;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO ponder;
GRANT ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA public TO ponder;

-- Set default privileges for future objects
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO ponder;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO ponder;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO ponder;
```

## Prevention

The docker-compose.yml has been updated to automatically apply these permissions when creating a new PostgreSQL container. The init script is mounted at:
```yaml
volumes:
  - ./postgres-init:/docker-entrypoint-initdb.d:ro
```

## Verification

After applying the fix, verify it worked:

1. Check the health endpoint:
   ```bash
   curl https://dev.ponder.deuro.com/health
   ```

2. Check container logs:
   ```bash
   docker-compose logs ponder | grep -i error
   ```

3. Verify in PostgreSQL:
   ```sql
   SELECT has_schema_privilege('ponder', 'public', 'CREATE');
   ```

## Troubleshooting

If permissions are still denied:

1. **Check user exists:**
   ```sql
   SELECT usename FROM pg_user WHERE usename = 'ponder';
   ```

2. **Check current permissions:**
   ```sql
   \l ponder     -- List database permissions
   \dn+ public   -- Show schema permissions
   ```

3. **Nuclear option - recreate database:**
   ```bash
   docker-compose down -v
   docker-compose up -d
   ```

## Important Notes

- These permissions are required for Ponder to create its internal tables
- The `ponder` user needs CREATE permission on the `public` schema
- Default privileges ensure future tables are accessible
- Always backup your database before making permission changes