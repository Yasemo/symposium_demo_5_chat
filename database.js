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
      created_at TEXT NOT NULL,
      FOREIGN KEY (symposium_id) REFERENCES symposiums (id) ON DELETE CASCADE
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
      FOREIGN KEY (symposium_id) REFERENCES symposiums (id) ON DELETE CASCADE,
      FOREIGN KEY (consultant_id) REFERENCES consultants (id) ON DELETE SET NULL
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

  console.log("Database initialized successfully");
}
