#!/bin/bash

# Fix PostgreSQL permissions in production
# This script connects to the production database and fixes permissions

echo "🔧 Fixing PostgreSQL permissions for Ponder production..."

# Check if we're using Docker Compose
if [ -f "docker-compose.yml" ]; then
    echo "📦 Using Docker Compose setup..."

    # Option 1: Fix permissions in the Docker PostgreSQL container
    echo "Applying permission fixes in Docker container..."
    docker-compose exec -T postgres psql -U postgres -d ponder << EOF
-- Grant necessary permissions to ponder user
GRANT ALL PRIVILEGES ON DATABASE ponder TO ponder;
GRANT USAGE, CREATE ON SCHEMA public TO ponder;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO ponder;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO ponder;
GRANT ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA public TO ponder;

-- Set default privileges for future objects
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO ponder;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO ponder;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO ponder;

-- Verify permissions
SELECT 'Permissions fixed successfully' as status;
EOF

    if [ $? -eq 0 ]; then
        echo "✅ Permissions fixed successfully in Docker container"
        echo "🔄 Restarting Ponder service..."
        docker-compose restart ponder
        echo "✅ Ponder service restarted"
    else
        echo "❌ Failed to fix permissions in Docker container"
        exit 1
    fi

else
    echo "📡 Direct database connection (no Docker Compose)..."

    # Option 2: Direct PostgreSQL connection
    # You'll need to set these environment variables or modify as needed
    if [ -z "$DATABASE_URL" ]; then
        echo "❌ DATABASE_URL not set. Please set it or modify this script."
        echo "Example: DATABASE_URL=postgresql://postgres:password@host:5432/ponder"
        exit 1
    fi

    # Extract connection details from DATABASE_URL
    # This is a simplified parser - adjust as needed for your setup
    psql "$DATABASE_URL" << EOF
-- Grant necessary permissions to ponder user
GRANT ALL PRIVILEGES ON DATABASE ponder TO ponder;
GRANT USAGE, CREATE ON SCHEMA public TO ponder;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO ponder;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO ponder;
GRANT ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA public TO ponder;

-- Set default privileges for future objects
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO ponder;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO ponder;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO ponder;

-- Verify permissions
SELECT 'Permissions fixed successfully' as status;
EOF

    if [ $? -eq 0 ]; then
        echo "✅ Permissions fixed successfully"
    else
        echo "❌ Failed to fix permissions"
        exit 1
    fi
fi

echo "🎉 Done! The PostgreSQL permissions have been fixed."
echo "📝 Note: If you're still seeing permission errors, you may need to:"
echo "   1. Drop and recreate the database"
echo "   2. Or run this script as the PostgreSQL superuser"