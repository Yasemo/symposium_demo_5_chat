import { Database as SQLiteDatabase } from "https://deno.land/x/sqlite3@0.11.1/mod.ts";
import { Client as PostgreSQLClient } from "https://deno.land/x/postgres@v0.19.3/mod.ts";

// Database abstraction layer to support both SQLite and PostgreSQL
export class DatabaseFactory {
  static async create() {
    const databaseUrl = Deno.env.get("DATABASE_URL");
    
    if (databaseUrl) {
      console.log("🐘 Using PostgreSQL (Cloud SQL) connection");
      return new PostgreSQLAdapter(databaseUrl);
    } else {
      console.log("📁 Using SQLite (local development) connection");
      return new SQLiteAdapter("symposium.db");
    }
  }
}

// SQLite adapter (existing behavior)
class SQLiteAdapter {
  constructor(filename) {
    this.db = new SQLiteDatabase(filename);
    this.type = 'sqlite';
  }

  prepare(sql) {
    return this.db.prepare(sql);
  }

  exec(sql) {
    return this.db.exec(sql);
  }

  close() {
    return this.db.close();
  }
}

// PostgreSQL adapter
class PostgreSQLAdapter {
  constructor(databaseUrl) {
    this.client = new PostgreSQLClient(databaseUrl);
    this.type = 'postgresql';
    this._connected = false;
  }

  async connect() {
    if (!this._connected) {
      await this.client.connect();
      this._connected = true;
    }
  }

  prepare(sql) {
    // Convert SQLite syntax to PostgreSQL
    const pgSql = this.convertSqlSyntax(sql);
    
    return {
      get: async (...params) => {
        await this.connect();
        const result = await this.client.queryObject(pgSql, params);
        return result.rows[0] || null;
      },
      all: async (...params) => {
        await this.connect();
        const result = await this.client.queryObject(pgSql, params);
        return result.rows;
      },
      run: async (...params) => {
        await this.connect();
        const result = await this.client.queryObject(pgSql, params);
        return {
          changes: result.rowCount || 0,
          lastInsertRowid: result.rows[0]?.id || null
        };
      }
    };
  }

  async exec(sql) {
    await this.connect();
    const pgSql = this.convertSqlSyntax(sql);
    return await this.client.queryObject(pgSql);
  }

  async close() {
    if (this._connected) {
      await this.client.end();
      this._connected = false;
    }
  }

  // Convert SQLite syntax to PostgreSQL
  convertSqlSyntax(sql) {
    return sql
      // Convert AUTOINCREMENT to SERIAL
      .replace(/INTEGER PRIMARY KEY AUTOINCREMENT/gi, 'SERIAL PRIMARY KEY')
      // Convert SQLite datetime function to PostgreSQL
      .replace(/datetime\('now'\)/gi, 'NOW()')
      // Convert TEXT to VARCHAR for better PostgreSQL compatibility
      .replace(/\bTEXT\b/gi, 'TEXT')
      // Handle RETURNING clause (PostgreSQL supports this)
      .replace(/RETURNING \*/gi, 'RETURNING *')
      // Convert INTEGER to INT for PostgreSQL
      .replace(/\bINTEGER\b/gi, 'INTEGER')
      // Handle INSERT OR REPLACE (convert to ON CONFLICT for PostgreSQL)
      .replace(/INSERT OR REPLACE INTO/gi, 'INSERT INTO')
      // Handle UNIQUE constraints in CREATE TABLE
      .replace(/UNIQUE\(([^)]+)\)/gi, 'UNIQUE($1)');
  }
}

// Database initialization with cross-platform SQL
export async function initDatabase(db) {
  const isPostgreSQL = db.type === 'postgresql';
  
  // Create symposiums table
  const symposiumsTable = `
    CREATE TABLE IF NOT EXISTS symposiums (
      id ${isPostgreSQL ? 'SERIAL PRIMARY KEY' : 'INTEGER PRIMARY KEY AUTOINCREMENT'},
      name TEXT NOT NULL,
      description TEXT NOT NULL,
      created_at ${isPostgreSQL ? 'TIMESTAMP DEFAULT NOW()' : 'TEXT NOT NULL'}
    )
  `;
  
  if (isPostgreSQL) {
    await db.exec(symposiumsTable);
  } else {
    db.exec(symposiumsTable);
  }

  // Create consultants table
  const consultantsTable = `
    CREATE TABLE IF NOT EXISTS consultants (
      id ${isPostgreSQL ? 'SERIAL PRIMARY KEY' : 'INTEGER PRIMARY KEY AUTOINCREMENT'},
      symposium_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      model TEXT NOT NULL,
      system_prompt TEXT NOT NULL,
      consultant_type TEXT DEFAULT 'standard',
      created_at ${isPostgreSQL ? 'TIMESTAMP DEFAULT NOW()' : 'TEXT NOT NULL'},
      FOREIGN KEY (symposium_id) REFERENCES symposiums (id) ON DELETE CASCADE
    )
  `;
  
  if (isPostgreSQL) {
    await db.exec(consultantsTable);
  } else {
    db.exec(consultantsTable);
    
    // Add consultant_type column if it doesn't exist (SQLite migration)
    try {
      db.exec(`ALTER TABLE consultants ADD COLUMN consultant_type TEXT DEFAULT 'standard'`);
      console.log("Added consultant_type column to existing consultants table");
    } catch (error) {
      if (!error.message.includes('duplicate column name')) {
        console.error("Error adding consultant_type column:", error);
      }
    }
  }

  // Create airtable configurations table
  const airtableConfigsTable = `
    CREATE TABLE IF NOT EXISTS airtable_configs (
      id ${isPostgreSQL ? 'SERIAL PRIMARY KEY' : 'INTEGER PRIMARY KEY AUTOINCREMENT'},
      consultant_id INTEGER NOT NULL,
      base_id TEXT NOT NULL,
      api_key TEXT NOT NULL,
      table_name TEXT,
      created_at ${isPostgreSQL ? 'TIMESTAMP DEFAULT NOW()' : 'TEXT NOT NULL'},
      FOREIGN KEY (consultant_id) REFERENCES consultants (id) ON DELETE CASCADE,
      UNIQUE(consultant_id)
    )
  `;
  
  if (isPostgreSQL) {
    await db.exec(airtableConfigsTable);
  } else {
    db.exec(airtableConfigsTable);
  }

  // Create messages table
  const messagesTable = `
    CREATE TABLE IF NOT EXISTS messages (
      id ${isPostgreSQL ? 'SERIAL PRIMARY KEY' : 'INTEGER PRIMARY KEY AUTOINCREMENT'},
      symposium_id INTEGER NOT NULL,
      consultant_id INTEGER,
      content TEXT NOT NULL,
      is_user INTEGER NOT NULL DEFAULT 0,
      timestamp ${isPostgreSQL ? 'TIMESTAMP DEFAULT NOW()' : 'TEXT NOT NULL'},
      updated_at ${isPostgreSQL ? 'TIMESTAMP' : 'TEXT'},
      FOREIGN KEY (symposium_id) REFERENCES symposiums (id) ON DELETE CASCADE,
      FOREIGN KEY (consultant_id) REFERENCES consultants (id) ON DELETE SET NULL
    )
  `;
  
  if (isPostgreSQL) {
    await db.exec(messagesTable);
  } else {
    db.exec(messagesTable);
    
    // Add updated_at column if it doesn't exist (SQLite migration)
    try {
      db.exec(`ALTER TABLE messages ADD COLUMN updated_at TEXT`);
      console.log("Added updated_at column to existing messages table");
    } catch (error) {
      if (!error.message.includes('duplicate column name')) {
        console.error("Error adding updated_at column:", error);
      }
    }
  }

  // Create message visibility table
  const messageVisibilityTable = `
    CREATE TABLE IF NOT EXISTS message_visibility (
      id ${isPostgreSQL ? 'SERIAL PRIMARY KEY' : 'INTEGER PRIMARY KEY AUTOINCREMENT'},
      message_id INTEGER NOT NULL,
      consultant_id INTEGER NOT NULL,
      is_hidden INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY (message_id) REFERENCES messages (id) ON DELETE CASCADE,
      FOREIGN KEY (consultant_id) REFERENCES consultants (id) ON DELETE CASCADE,
      UNIQUE(message_id, consultant_id)
    )
  `;
  
  if (isPostgreSQL) {
    await db.exec(messageVisibilityTable);
  } else {
    db.exec(messageVisibilityTable);
  }

  // Create knowledge base cards table
  const knowledgeBaseTable = `
    CREATE TABLE IF NOT EXISTS knowledge_base_cards (
      id ${isPostgreSQL ? 'SERIAL PRIMARY KEY' : 'INTEGER PRIMARY KEY AUTOINCREMENT'},
      symposium_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      card_type TEXT NOT NULL DEFAULT 'user_created',
      source_message_id INTEGER,
      is_visible INTEGER NOT NULL DEFAULT 1,
      created_at ${isPostgreSQL ? 'TIMESTAMP DEFAULT NOW()' : 'TEXT NOT NULL'},
      updated_at ${isPostgreSQL ? 'TIMESTAMP DEFAULT NOW()' : 'TEXT NOT NULL'},
      FOREIGN KEY (symposium_id) REFERENCES symposiums (id) ON DELETE CASCADE,
      FOREIGN KEY (source_message_id) REFERENCES messages (id) ON DELETE SET NULL
    )
  `;
  
  if (isPostgreSQL) {
    await db.exec(knowledgeBaseTable);
  } else {
    db.exec(knowledgeBaseTable);
  }

  console.log(`Database initialized successfully (${db.type})`);
}
