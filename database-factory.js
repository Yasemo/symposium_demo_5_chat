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

  // Create consultant templates table
  const consultantTemplatesTable = `
    CREATE TABLE IF NOT EXISTS consultant_templates (
      id ${isPostgreSQL ? 'SERIAL PRIMARY KEY' : 'INTEGER PRIMARY KEY AUTOINCREMENT'},
      name TEXT NOT NULL UNIQUE,
      display_name TEXT NOT NULL,
      description TEXT NOT NULL,
      api_type TEXT NOT NULL,
      default_system_prompt TEXT NOT NULL,
      required_config_fields TEXT NOT NULL,
      form_schema TEXT,
      api_schema TEXT,
      context_requirements TEXT,
      icon TEXT DEFAULT '🤖',
      created_at ${isPostgreSQL ? 'TIMESTAMP DEFAULT NOW()' : 'TEXT NOT NULL DEFAULT (datetime(\'now\'))'}
    )
  `;
  
  if (isPostgreSQL) {
    await db.exec(consultantTemplatesTable);
  } else {
    db.exec(consultantTemplatesTable);
  }

  // Create consultants table (enhanced)
  const consultantsTable = `
    CREATE TABLE IF NOT EXISTS consultants (
      id ${isPostgreSQL ? 'SERIAL PRIMARY KEY' : 'INTEGER PRIMARY KEY AUTOINCREMENT'},
      symposium_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      model TEXT NOT NULL,
      system_prompt TEXT NOT NULL,
      template_id INTEGER,
      consultant_type TEXT DEFAULT 'standard',
      is_default INTEGER DEFAULT 0,
      created_at ${isPostgreSQL ? 'TIMESTAMP DEFAULT NOW()' : 'TEXT NOT NULL'},
      FOREIGN KEY (symposium_id) REFERENCES symposiums (id) ON DELETE CASCADE,
      FOREIGN KEY (template_id) REFERENCES consultant_templates (id) ON DELETE SET NULL
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

  // Create external API configurations table
  const externalApiConfigsTable = `
    CREATE TABLE IF NOT EXISTS external_api_configs (
      id ${isPostgreSQL ? 'SERIAL PRIMARY KEY' : 'INTEGER PRIMARY KEY AUTOINCREMENT'},
      consultant_id INTEGER NOT NULL,
      api_type TEXT NOT NULL,
      config_json TEXT NOT NULL,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at ${isPostgreSQL ? 'TIMESTAMP DEFAULT NOW()' : 'TEXT NOT NULL DEFAULT (datetime(\'now\'))'},
      updated_at ${isPostgreSQL ? 'TIMESTAMP DEFAULT NOW()' : 'TEXT NOT NULL DEFAULT (datetime(\'now\'))'},
      FOREIGN KEY (consultant_id) REFERENCES consultants (id) ON DELETE CASCADE,
      UNIQUE(consultant_id)
    )
  `;
  
  if (isPostgreSQL) {
    await db.exec(externalApiConfigsTable);
  } else {
    db.exec(externalApiConfigsTable);
  }

  // Create API interaction logs table
  const apiInteractionLogsTable = `
    CREATE TABLE IF NOT EXISTS api_interaction_logs (
      id ${isPostgreSQL ? 'SERIAL PRIMARY KEY' : 'INTEGER PRIMARY KEY AUTOINCREMENT'},
      consultant_id INTEGER NOT NULL,
      api_type TEXT NOT NULL,
      request_data TEXT,
      response_data TEXT,
      success INTEGER NOT NULL DEFAULT 0,
      error_message TEXT,
      execution_time_ms INTEGER,
      timestamp ${isPostgreSQL ? 'TIMESTAMP DEFAULT NOW()' : 'TEXT NOT NULL DEFAULT (datetime(\'now\'))'},
      FOREIGN KEY (consultant_id) REFERENCES consultants (id) ON DELETE CASCADE
    )
  `;
  
  if (isPostgreSQL) {
    await db.exec(apiInteractionLogsTable);
  } else {
    db.exec(apiInteractionLogsTable);
  }

  // Keep existing airtable_configs table for backward compatibility
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
      objective_id INTEGER,
      content TEXT NOT NULL,
      is_user INTEGER NOT NULL DEFAULT 0,
      timestamp ${isPostgreSQL ? 'TIMESTAMP DEFAULT NOW()' : 'TEXT NOT NULL'},
      updated_at ${isPostgreSQL ? 'TIMESTAMP' : 'TEXT'},
      FOREIGN KEY (symposium_id) REFERENCES symposiums (id) ON DELETE CASCADE,
      FOREIGN KEY (consultant_id) REFERENCES consultants (id) ON DELETE SET NULL,
      FOREIGN KEY (objective_id) REFERENCES objectives (id) ON DELETE SET NULL
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
    
    // Add objective_id column if it doesn't exist (SQLite migration)
    try {
      db.exec(`ALTER TABLE messages ADD COLUMN objective_id INTEGER REFERENCES objectives(id) ON DELETE SET NULL`);
      console.log("Added objective_id column to existing messages table");
    } catch (error) {
      if (!error.message.includes('duplicate column name')) {
        console.error("Error adding objective_id column:", error);
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

  // Create knowledge base cards table (now global, not symposium-specific)
  const knowledgeBaseTable = `
    CREATE TABLE IF NOT EXISTS knowledge_base_cards (
      id ${isPostgreSQL ? 'SERIAL PRIMARY KEY' : 'INTEGER PRIMARY KEY AUTOINCREMENT'},
      symposium_id INTEGER,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      card_type TEXT NOT NULL DEFAULT 'user_created',
      source_message_id INTEGER,
      is_visible INTEGER NOT NULL DEFAULT 1,
      is_global INTEGER NOT NULL DEFAULT 1,
      created_at ${isPostgreSQL ? 'TIMESTAMP DEFAULT NOW()' : 'TEXT NOT NULL'},
      updated_at ${isPostgreSQL ? 'TIMESTAMP DEFAULT NOW()' : 'TEXT NOT NULL'},
      FOREIGN KEY (symposium_id) REFERENCES symposiums (id) ON DELETE SET NULL,
      FOREIGN KEY (source_message_id) REFERENCES messages (id) ON DELETE SET NULL
    )
  `;
  
  if (isPostgreSQL) {
    await db.exec(knowledgeBaseTable);
  } else {
    db.exec(knowledgeBaseTable);
    
    // Add is_global column if it doesn't exist (SQLite migration)
    try {
      db.exec(`ALTER TABLE knowledge_base_cards ADD COLUMN is_global INTEGER NOT NULL DEFAULT 1`);
      console.log("Added is_global column to existing knowledge_base_cards table");
    } catch (error) {
      if (!error.message.includes('duplicate column name')) {
        console.error("Error adding is_global column:", error);
      }
    }
  }

  // Create symposium tasks table
  const symposiumTasksTable = `
    CREATE TABLE IF NOT EXISTS symposium_tasks (
      id ${isPostgreSQL ? 'SERIAL PRIMARY KEY' : 'INTEGER PRIMARY KEY AUTOINCREMENT'},
      symposium_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      is_completed INTEGER NOT NULL DEFAULT 0,
      order_index INTEGER NOT NULL DEFAULT 0,
      created_at ${isPostgreSQL ? 'TIMESTAMP DEFAULT NOW()' : 'TEXT NOT NULL DEFAULT (datetime(\'now\'))'},
      updated_at ${isPostgreSQL ? 'TIMESTAMP DEFAULT NOW()' : 'TEXT NOT NULL DEFAULT (datetime(\'now\'))'},
      FOREIGN KEY (symposium_id) REFERENCES symposiums (id) ON DELETE CASCADE
    )
  `;
  
  if (isPostgreSQL) {
    await db.exec(symposiumTasksTable);
  } else {
    db.exec(symposiumTasksTable);
  }

  // Create objectives table
  const objectivesTable = `
    CREATE TABLE IF NOT EXISTS objectives (
      id ${isPostgreSQL ? 'SERIAL PRIMARY KEY' : 'INTEGER PRIMARY KEY AUTOINCREMENT'},
      symposium_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      order_index INTEGER NOT NULL DEFAULT 0,
      created_at ${isPostgreSQL ? 'TIMESTAMP DEFAULT NOW()' : 'TEXT NOT NULL DEFAULT (datetime(\'now\'))'},
      updated_at ${isPostgreSQL ? 'TIMESTAMP DEFAULT NOW()' : 'TEXT NOT NULL DEFAULT (datetime(\'now\'))'},
      FOREIGN KEY (symposium_id) REFERENCES symposiums (id) ON DELETE CASCADE
    )
  `;
  
  if (isPostgreSQL) {
    await db.exec(objectivesTable);
  } else {
    db.exec(objectivesTable);
  }

  // Create objective tasks table
  const objectiveTasksTable = `
    CREATE TABLE IF NOT EXISTS objective_tasks (
      id ${isPostgreSQL ? 'SERIAL PRIMARY KEY' : 'INTEGER PRIMARY KEY AUTOINCREMENT'},
      objective_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      is_completed INTEGER NOT NULL DEFAULT 0,
      order_index INTEGER NOT NULL DEFAULT 0,
      created_at ${isPostgreSQL ? 'TIMESTAMP DEFAULT NOW()' : 'TEXT NOT NULL DEFAULT (datetime(\'now\'))'},
      updated_at ${isPostgreSQL ? 'TIMESTAMP DEFAULT NOW()' : 'TEXT NOT NULL DEFAULT (datetime(\'now\'))'},
      FOREIGN KEY (objective_id) REFERENCES objectives (id) ON DELETE CASCADE
    )
  `;
  
  if (isPostgreSQL) {
    await db.exec(objectiveTasksTable);
  } else {
    db.exec(objectiveTasksTable);
  }

  // Create consultant dynamic context table for form options
  const consultantDynamicContextTable = `
    CREATE TABLE IF NOT EXISTS consultant_dynamic_context (
      id ${isPostgreSQL ? 'SERIAL PRIMARY KEY' : 'INTEGER PRIMARY KEY AUTOINCREMENT'},
      consultant_id INTEGER NOT NULL,
      context_type TEXT NOT NULL,
      context_data TEXT NOT NULL,
      last_updated ${isPostgreSQL ? 'TIMESTAMP DEFAULT NOW()' : 'TEXT NOT NULL DEFAULT (datetime(\'now\'))'},
      FOREIGN KEY (consultant_id) REFERENCES consultants (id) ON DELETE CASCADE,
      UNIQUE(consultant_id, context_type)
    )
  `;
  
  if (isPostgreSQL) {
    await db.exec(consultantDynamicContextTable);
  } else {
    db.exec(consultantDynamicContextTable);
  }

  // Create tags table
  const tagsTable = `
    CREATE TABLE IF NOT EXISTS tags (
      id ${isPostgreSQL ? 'SERIAL PRIMARY KEY' : 'INTEGER PRIMARY KEY AUTOINCREMENT'},
      name TEXT NOT NULL UNIQUE,
      color TEXT NOT NULL DEFAULT '#4f46e5',
      created_at ${isPostgreSQL ? 'TIMESTAMP DEFAULT NOW()' : 'TEXT NOT NULL DEFAULT (datetime(\'now\'))'}
    )
  `;
  
  if (isPostgreSQL) {
    await db.exec(tagsTable);
  } else {
    db.exec(tagsTable);
  }

  // Create card-tag relationships table (many-to-many)
  const cardTagsTable = `
    CREATE TABLE IF NOT EXISTS card_tags (
      id ${isPostgreSQL ? 'SERIAL PRIMARY KEY' : 'INTEGER PRIMARY KEY AUTOINCREMENT'},
      card_id INTEGER NOT NULL,
      tag_id INTEGER NOT NULL,
      created_at ${isPostgreSQL ? 'TIMESTAMP DEFAULT NOW()' : 'TEXT NOT NULL DEFAULT (datetime(\'now\'))'},
      FOREIGN KEY (card_id) REFERENCES knowledge_base_cards (id) ON DELETE CASCADE,
      FOREIGN KEY (tag_id) REFERENCES tags (id) ON DELETE CASCADE,
      UNIQUE(card_id, tag_id)
    )
  `;
  
  if (isPostgreSQL) {
    await db.exec(cardTagsTable);
  } else {
    db.exec(cardTagsTable);
  }

  // Create selected tags table for chat interface persistence
  const selectedTagsTable = `
    CREATE TABLE IF NOT EXISTS selected_tags (
      id ${isPostgreSQL ? 'SERIAL PRIMARY KEY' : 'INTEGER PRIMARY KEY AUTOINCREMENT'},
      symposium_id INTEGER NOT NULL,
      objective_id INTEGER,
      tag_id INTEGER NOT NULL,
      created_at ${isPostgreSQL ? 'TIMESTAMP DEFAULT NOW()' : 'TEXT NOT NULL DEFAULT (datetime(\'now\'))'},
      FOREIGN KEY (symposium_id) REFERENCES symposiums (id) ON DELETE CASCADE,
      FOREIGN KEY (objective_id) REFERENCES objectives (id) ON DELETE CASCADE,
      FOREIGN KEY (tag_id) REFERENCES tags (id) ON DELETE CASCADE,
      UNIQUE(symposium_id, objective_id, tag_id)
    )
  `;
  
  if (isPostgreSQL) {
    await db.exec(selectedTagsTable);
  } else {
    db.exec(selectedTagsTable);
  }

  console.log(`Database initialized successfully (${db.type})`);
}
