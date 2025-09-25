#!/bin/sh
set -e

echo "Starting Ponder..."

# Check schema version and reset if needed
echo "Checking schema version..."

if node schema-manager.js; then
  echo "Schema version check completed"
else
  echo "Schema version check failed"
  exit 1
fi

# Start Ponder normally
npm start