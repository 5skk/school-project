const sqlite3 = require('sqlite3').verbose();

// The SQLite file is created automatically in the project folder.
const db = new sqlite3.Database('./school.db', (error) => {
  if (error) {
    console.error('Failed to connect to SQLite:', error.message);
    process.exit(1);
  }

  console.log('Connected to SQLite database.');
});

// Create the users table once when the app starts.
db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL UNIQUE,
      password TEXT NOT NULL,
      nickname TEXT,
      avatar TEXT,
      birthDate TEXT,
      theme TEXT DEFAULT 'blue',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Existing databases are upgraded gently without changing stored auth data.
  db.run('ALTER TABLE users ADD COLUMN nickname TEXT', (error) => {
    if (error && !error.message.includes('duplicate column')) {
      console.error('Failed to add nickname column:', error.message);
    }
  });

  db.run("ALTER TABLE users ADD COLUMN theme TEXT DEFAULT 'blue'", (error) => {
    if (error && !error.message.includes('duplicate column')) {
      console.error('Failed to add theme column:', error.message);
    }
  });

  db.run('ALTER TABLE users ADD COLUMN avatar TEXT', (error) => {
    if (error && !error.message.includes('duplicate column')) {
      console.error('Failed to add avatar column:', error.message);
    }
  });

  db.run('ALTER TABLE users ADD COLUMN birthDate TEXT', (error) => {
    if (error && !error.message.includes('duplicate column')) {
      console.error('Failed to add birthDate column:', error.message);
    }
  });

  db.run("ALTER TABLE users ADD COLUMN role TEXT DEFAULT 'student'", (error) => {
    if (error && !error.message.includes('duplicate column')) {
      console.error('Failed to add role column:', error.message);
    }
  });

  // Update existing 'student' roles to 'user' for consistency
  db.run("UPDATE users SET role = 'user' WHERE role = 'student' OR role IS NULL", (error) => {
    if (error) {
      console.error('Failed to update role names:', error.message);
    }
  });

  // Force assign Owner role to kik675846@gmail.com (ID: 4)
  db.get("SELECT id, role FROM users WHERE email = ?", ['kik675846@gmail.com'], (error, targetUser) => {
    if (error) {
      console.error('Failed to get target user:', error.message);
      return;
    }

    if (targetUser) {
      console.log(`Found user: kik675846@gmail.com (ID: ${targetUser.id}, current role: ${targetUser.role})`);

      // First, remove owner role from all other users
      db.run("UPDATE users SET role = 'user' WHERE role = 'owner' AND id != ?", [targetUser.id], (error) => {
        if (error) {
          console.error('Failed to remove owner from others:', error.message);
        }
      });

      // Then assign owner role to target user
      db.run("UPDATE users SET role = 'owner' WHERE id = ?", [targetUser.id], (error) => {
        if (error) {
          console.error('Failed to assign owner role:', error.message);
        } else {
          console.log(`Successfully assigned owner role to user: kik675846@gmail.com (ID: ${targetUser.id})`);

          // Verify the change
          db.get("SELECT role FROM users WHERE id = ?", [targetUser.id], (error, user) => {
            if (!error && user) {
              console.log(`Verified role for user ${targetUser.id}: ${user.role}`);
            }
          });
        }
      });
    } else {
      console.error('User kik675846@gmail.com not found in database');
    }
  });

  db.run(`
    CREATE TABLE IF NOT EXISTS news (
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
  `, (createNewsError) => {
    if (createNewsError) {
      console.error('Failed to create news table:', createNewsError.message);
      return;
    }

    // Add new columns if table already exists but doesn't have them
    db.run('ALTER TABLE news ADD COLUMN description TEXT', (error) => {
      if (error && !error.message.includes('duplicate column')) {
        console.error('Failed to add description column:', error.message);
      }
    });

    db.run('ALTER TABLE news ADD COLUMN media TEXT', (error) => {
      if (error && !error.message.includes('duplicate column')) {
        console.error('Failed to add media column:', error.message);
      }
    });

    db.run('ALTER TABLE news ADD COLUMN isImportant INTEGER DEFAULT 0', (error) => {
      if (error && !error.message.includes('duplicate column')) {
        console.error('Failed to add isImportant column:', error.message);
      }
    });

    db.run('ALTER TABLE news ADD COLUMN status TEXT DEFAULT "pending"', (error) => {
      if (error && !error.message.includes('duplicate column')) {
        console.error('Failed to add status column:', error.message);
      }
    });

    db.run('ALTER TABLE news ADD COLUMN createdBy INTEGER', (error) => {
      if (error && !error.message.includes('duplicate column')) {
        console.error('Failed to add createdBy column:', error.message);
      }
    });

    db.run('ALTER TABLE news ADD COLUMN updated_at DATETIME DEFAULT CURRENT_TIMESTAMP', (error) => {
      if (error && !error.message.includes('duplicate column')) {
        console.error('Failed to add updated_at column:', error.message);
      }
    });
  });
});

module.exports = db;
