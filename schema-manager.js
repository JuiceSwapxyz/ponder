#!/usr/bin/env node

import { Client } from "pg";

async function getStoredSchemaVersion(database, schema) {
  try {
    const client = new Client({ connectionString: database });
    await client.connect();

    // Read the version
    const result = await client.query(`
      SELECT schema_version FROM ${schema}.ponder_schema_version
      WHERE id = 'current' LIMIT 1
    `);

    await client.end();

    return result.rows.length > 0 ? result.rows[0].schema_version : null;
  } catch (error) {
    console.warn("Failed to read schema version:", error.message);
    return null;
  }
}

async function storeSchemaVersion(database, schema, version) {
  try {
    const client = new Client({ connectionString: database });
    await client.connect();

    // Create Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS ${schema}.ponder_schema_version (
        id TEXT PRIMARY KEY,
        schema_version TEXT NOT NULL,
        reset_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // Store the version
    await client.query(
      `
      INSERT INTO ${schema}.ponder_schema_version (id, schema_version)
      VALUES ('current', $1)
      ON CONFLICT (id) DO UPDATE SET
        schema_version = $1,
        reset_at = NOW()
    `,
      [version]
    );

    await client.end();

    console.log(`Stored schema version ${version}`);
  } catch (error) {
    console.error("Failed to store schema version:", error.message);
    throw error;
  }
}

async function performSchemaReset(database, schema) {
  try {
    const client = new Client({ connectionString: database });
    await client.connect();

    const dropTablesInSchema = async (schemaName) => {
      const tablesResult = await client.query(`
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = $1 AND table_type = 'BASE TABLE'
      `, [schemaName]);

      for (const row of tablesResult.rows) {
        console.log(`Dropping table ${schemaName}.${row.table_name}`);
        await client.query(`DROP TABLE IF EXISTS ${schemaName}.${row.table_name} CASCADE`);
      }
    };

    await dropTablesInSchema(schema);
    await dropTablesInSchema('ponder_sync');

    await client.end();

    console.log("Schema reset completed successfully");
  } catch (error) {
    console.error("Schema reset failed:", error.message);
    throw error;
  }
}

async function manageSchemaVersion() {
  const database = process.env.DATABASE_URL;
  const schema = process.env.DATABASE_SCHEMA || "public";
  const requestedVersion = process.env.PONDER_SCHEMA_VERSION;

  if (!database) {
    console.error("DATABASE_URL is required but not set");
    process.exit(1);
  }

  if (!requestedVersion) {
    console.error("PONDER_SCHEMA_VERSION is required but not set");
    process.exit(1);
  }

  try {
    const currentStoredVersion = await getStoredSchemaVersion(database, schema);

    if (currentStoredVersion) {
      if (requestedVersion === currentStoredVersion) {
        console.log("Schema version unchanged, no reset needed");
        return;
      }

      console.log("Schema version changed, reset required");
    } else {
      console.log("No stored schema version found, reset required");
    }

    await performSchemaReset(database, schema);
    await storeSchemaVersion(database, schema, requestedVersion);
  } catch (error) {
    console.error("Schema management failed:", error.message);
    process.exit(1);
  }
}

manageSchemaVersion();
