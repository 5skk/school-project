const db = require('./db');

console.log('Starting news table migration...');

// Check current schema
db.all("PRAGMA table_info(news)", (error, columns) => {
  if (error) {
    console.error('Error checking schema:', error.message);
    process.exit(1);
  }

  const columnNames = columns.map(col => col.name);
  const hasOldColumns = columnNames.includes('preview') || columnNames.includes('body') || columnNames.includes('is_announcement');

  if (!hasOldColumns) {
    console.log('No migration needed - table already has correct schema.');
    process.exit(0);
  }

  console.log('Detected old columns, migrating...');

  // Create new table with correct schema
  db.run(`
    CREATE TABLE IF NOT EXISTS news_new (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      media TEXT,
      isImportant INTEGER DEFAULT 0,
      status TEXT DEFAULT 'pending',
      createdBy INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (createdBy) REFERENCES users(id)
    )
  `, (error) => {
    if (error) {
      console.error('Failed to create news_new table:', error.message);
      process.exit(1);
    }

    console.log('Created news_new table');

    // Copy data from old table to new table
    db.run(`
      INSERT INTO news_new (id, title, description, media, isImportant, status, createdBy, created_at, updated_at)
      SELECT id, title, 
             COALESCE(description, COALESCE(body, '')),
             COALESCE(media, ''),
             COALESCE(isImportant, is_announcement, 0),
             COALESCE(status, 'approved'),
             createdBy,
             created_at,
             COALESCE(updated_at, created_at)
      FROM news
    `, (error) => {
      if (error) {
        console.error('Failed to copy data to news_new:', error.message);
        process.exit(1);
      }

      console.log('Copied data to news_new');

      // Drop old table
      db.run('DROP TABLE news', (error) => {
        if (error) {
          console.error('Failed to drop old news table:', error.message);
          process.exit(1);
        }

        console.log('Dropped old news table');

        // Rename new table
        db.run('ALTER TABLE news_new RENAME TO news', (error) => {
          if (error) {
            console.error('Failed to rename news_new to news:', error.message);
            process.exit(1);
          }

          console.log('Migration completed successfully!');
          process.exit(0);
        });
      });
    });
  });
});
