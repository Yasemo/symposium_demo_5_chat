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
      form_schema TEXT, -- JSON form configuration
      api_schema TEXT, -- JSON API parameter mapping
      context_requirements TEXT, -- JSON array of context types needed
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
      is_default INTEGER DEFAULT 0, -- flag for default conversational consultant
      created_at TEXT NOT NULL,
      FOREIGN KEY (symposium_id) REFERENCES symposiums (id) ON DELETE CASCADE,
      FOREIGN KEY (template_id) REFERENCES consultant_templates (id) ON DELETE SET NULL
    )
  `);


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

  // Create consultant dynamic context table for form options
  db.exec(`
    CREATE TABLE IF NOT EXISTS consultant_dynamic_context (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      consultant_id INTEGER NOT NULL,
      context_type TEXT NOT NULL, -- 'tables', 'fields', 'views', etc.
      context_data TEXT NOT NULL, -- JSON with current options
      last_updated TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (consultant_id) REFERENCES consultants (id) ON DELETE CASCADE,
      UNIQUE(consultant_id, context_type)
    )
  `);

  // Create tags table
  db.exec(`
    CREATE TABLE IF NOT EXISTS tags (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      color TEXT NOT NULL DEFAULT '#4f46e5',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  // Create card-tag relationships table (many-to-many)
  db.exec(`
    CREATE TABLE IF NOT EXISTS card_tags (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      card_id INTEGER NOT NULL,
      tag_id INTEGER NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (card_id) REFERENCES knowledge_base_cards (id) ON DELETE CASCADE,
      FOREIGN KEY (tag_id) REFERENCES tags (id) ON DELETE CASCADE,
      UNIQUE(card_id, tag_id)
    )
  `);

  console.log("Database initialized successfully");
}
