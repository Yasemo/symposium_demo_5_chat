export async function initDatabase(db) {
  // Create symposiums table
  db.exec(`
    CREATE TABLE IF NOT EXISTS symposiums (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT NOT NULL,
      created_at TEXT NOT NULL
    )
  `);

  // Create consultant templates table
  db.exec(`
    CREATE TABLE IF NOT EXISTS consultant_templates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      display_name TEXT NOT NULL,
      description TEXT NOT NULL,
      api_type TEXT NOT NULL,
      default_system_prompt TEXT NOT NULL,
      required_config_fields TEXT NOT NULL, -- JSON array of required fields
      icon TEXT DEFAULT '🤖',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  // Create consultants table (enhanced)
  db.exec(`
    CREATE TABLE IF NOT EXISTS consultants (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      symposium_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      model TEXT NOT NULL,
      system_prompt TEXT NOT NULL,
      template_id INTEGER,
      consultant_type TEXT DEFAULT 'standard', -- kept for backward compatibility
      created_at TEXT NOT NULL,
      FOREIGN KEY (symposium_id) REFERENCES symposiums (id) ON DELETE CASCADE,
      FOREIGN KEY (template_id) REFERENCES consultant_templates (id) ON DELETE SET NULL
    )
  `);

  // Add template_id column if it doesn't exist (migration)
  try {
    db.exec(`ALTER TABLE consultants ADD COLUMN template_id INTEGER REFERENCES consultant_templates(id) ON DELETE SET NULL`);
    console.log("Added template_id column to existing consultants table");
  } catch (error) {
    if (!error.message.includes('duplicate column name')) {
      console.error("Error adding template_id column:", error);
    }
  }

  // Add consultant_type column if it doesn't exist (migration)
  try {
    db.exec(`ALTER TABLE consultants ADD COLUMN consultant_type TEXT DEFAULT 'standard'`);
    console.log("Added consultant_type column to existing consultants table");
  } catch (error) {
    if (!error.message.includes('duplicate column name')) {
      console.error("Error adding consultant_type column:", error);
    }
  }

  // Create external API configurations table
  db.exec(`
    CREATE TABLE IF NOT EXISTS external_api_configs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      consultant_id INTEGER NOT NULL,
      api_type TEXT NOT NULL,
      config_json TEXT NOT NULL, -- encrypted JSON configuration
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (consultant_id) REFERENCES consultants (id) ON DELETE CASCADE,
      UNIQUE(consultant_id)
    )
  `);

  // Create API interaction logs table
  db.exec(`
    CREATE TABLE IF NOT EXISTS api_interaction_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      consultant_id INTEGER NOT NULL,
      api_type TEXT NOT NULL,
      request_data TEXT, -- JSON
      response_data TEXT, -- JSON
      success INTEGER NOT NULL DEFAULT 0,
      error_message TEXT,
      execution_time_ms INTEGER,
      timestamp TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (consultant_id) REFERENCES consultants (id) ON DELETE CASCADE
    )
  `);

  // Keep existing airtable_configs table for backward compatibility
  db.exec(`
    CREATE TABLE IF NOT EXISTS airtable_configs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      consultant_id INTEGER NOT NULL,
      base_id TEXT NOT NULL,
      api_key TEXT NOT NULL,
      table_name TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (consultant_id) REFERENCES consultants (id) ON DELETE CASCADE,
      UNIQUE(consultant_id)
    )
  `);

  // Create messages table
  db.exec(`
    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      symposium_id INTEGER NOT NULL,
      consultant_id INTEGER,
      objective_id INTEGER,
      content TEXT NOT NULL,
      is_user INTEGER NOT NULL DEFAULT 0,
      timestamp TEXT NOT NULL,
      updated_at TEXT,
      FOREIGN KEY (symposium_id) REFERENCES symposiums (id) ON DELETE CASCADE,
      FOREIGN KEY (consultant_id) REFERENCES consultants (id) ON DELETE SET NULL,
      FOREIGN KEY (objective_id) REFERENCES objectives (id) ON DELETE CASCADE
    )
  `);

  // Add updated_at column if it doesn't exist (migration)
  try {
    db.exec(`ALTER TABLE messages ADD COLUMN updated_at TEXT`);
    console.log("Added updated_at column to existing messages table");
  } catch (error) {
    if (!error.message.includes('duplicate column name')) {
      console.error("Error adding updated_at column:", error);
    }
  }

  // Add objective_id column if it doesn't exist (migration)
  try {
    db.exec(`ALTER TABLE messages ADD COLUMN objective_id INTEGER REFERENCES objectives(id) ON DELETE CASCADE`);
    console.log("Added objective_id column to existing messages table");
  } catch (error) {
    if (!error.message.includes('duplicate column name')) {
      console.error("Error adding objective_id column:", error);
    }
  }

  // Create message visibility table
  db.exec(`
    CREATE TABLE IF NOT EXISTS message_visibility (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      message_id INTEGER NOT NULL,
      consultant_id INTEGER NOT NULL,
      is_hidden INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY (message_id) REFERENCES messages (id) ON DELETE CASCADE,
      FOREIGN KEY (consultant_id) REFERENCES consultants (id) ON DELETE CASCADE,
      UNIQUE(message_id, consultant_id)
    )
  `);

  // Create knowledge base cards table (now global, not symposium-specific)
  db.exec(`
    CREATE TABLE IF NOT EXISTS knowledge_base_cards (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      symposium_id INTEGER, -- Made optional for backward compatibility
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      card_type TEXT NOT NULL DEFAULT 'user_created',
      source_message_id INTEGER,
      is_visible INTEGER NOT NULL DEFAULT 1,
      is_global INTEGER NOT NULL DEFAULT 1, -- New field to mark global cards
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (symposium_id) REFERENCES symposiums (id) ON DELETE SET NULL,
      FOREIGN KEY (source_message_id) REFERENCES messages (id) ON DELETE SET NULL
    )
  `);

  // Add is_global column if it doesn't exist (migration)
  try {
    db.exec(`ALTER TABLE knowledge_base_cards ADD COLUMN is_global INTEGER NOT NULL DEFAULT 1`);
    console.log("Added is_global column to existing knowledge_base_cards table");
  } catch (error) {
    if (!error.message.includes('duplicate column name')) {
      console.error("Error adding is_global column:", error);
    }
  }

  // Update existing knowledge base cards to be global
  try {
    db.exec(`UPDATE knowledge_base_cards SET is_global = 1 WHERE is_global IS NULL`);
    console.log("Updated existing knowledge base cards to be global");
  } catch (error) {
    console.error("Error updating existing knowledge base cards:", error);
  }

  // Create objectives table
  db.exec(`
    CREATE TABLE IF NOT EXISTS objectives (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      symposium_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      order_index INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (symposium_id) REFERENCES symposiums (id) ON DELETE CASCADE
    )
  `);

  // Create objective tasks table (replaces symposium_tasks)
  db.exec(`
    CREATE TABLE IF NOT EXISTS objective_tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      objective_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      is_completed INTEGER NOT NULL DEFAULT 0,
      order_index INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (objective_id) REFERENCES objectives (id) ON DELETE CASCADE
    )
  `);

  console.log("Database initialized successfully");
}
