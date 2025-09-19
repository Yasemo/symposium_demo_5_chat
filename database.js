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

  // Create consultants table
  db.exec(`
    CREATE TABLE IF NOT EXISTS consultants (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      symposium_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      model TEXT NOT NULL,
      system_prompt TEXT NOT NULL,
      consultant_type TEXT DEFAULT 'standard',
      created_at TEXT NOT NULL,
      FOREIGN KEY (symposium_id) REFERENCES symposiums (id) ON DELETE CASCADE
    )
  `);

  // Add consultant_type column if it doesn't exist (migration)
  try {
    db.exec(`ALTER TABLE consultants ADD COLUMN consultant_type TEXT DEFAULT 'standard'`);
    console.log("Added consultant_type column to existing consultants table");
  } catch (error) {
    // Column already exists, ignore the error
    if (!error.message.includes('duplicate column name')) {
      console.error("Error adding consultant_type column:", error);
    }
  }

  // Create airtable configurations table
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
      content TEXT NOT NULL,
      is_user INTEGER NOT NULL DEFAULT 0,
      timestamp TEXT NOT NULL,
      updated_at TEXT,
      FOREIGN KEY (symposium_id) REFERENCES symposiums (id) ON DELETE CASCADE,
      FOREIGN KEY (consultant_id) REFERENCES consultants (id) ON DELETE SET NULL
    )
  `);

  // Add updated_at column if it doesn't exist (migration)
  try {
    db.exec(`ALTER TABLE messages ADD COLUMN updated_at TEXT`);
    console.log("Added updated_at column to existing messages table");
  } catch (error) {
    // Column already exists, ignore the error
    if (!error.message.includes('duplicate column name')) {
      console.error("Error adding updated_at column:", error);
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

  // Create knowledge base cards table
  db.exec(`
    CREATE TABLE IF NOT EXISTS knowledge_base_cards (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      symposium_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      card_type TEXT NOT NULL DEFAULT 'user_created',
      source_message_id INTEGER,
      is_visible INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (symposium_id) REFERENCES symposiums (id) ON DELETE CASCADE,
      FOREIGN KEY (source_message_id) REFERENCES messages (id) ON DELETE SET NULL
    )
  `);

  console.log("Database initialized successfully");
}
