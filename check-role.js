const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./school.db');

db.get("SELECT id, email, role FROM users WHERE email = ?", ['kik675846@gmail.com'], (error, user) => {
  if (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }

  if (!user) {
    console.log('User not found');
    process.exit(1);
  }

  console.log('Current user data:', user);

  db.run("UPDATE users SET role = 'owner' WHERE id = ?", [user.id], (error) => {
    if (error) {
      console.error('Error updating role:', error.message);
      process.exit(1);
    }

    console.log('Role updated to owner');

    db.get("SELECT id, email, role FROM users WHERE id = ?", [user.id], (error, updatedUser) => {
      if (error) {
        console.error('Error verifying:', error.message);
        process.exit(1);
      }

      console.log('Verified user data:', updatedUser);
      db.close();
      process.exit(0);
    });
  });
});
