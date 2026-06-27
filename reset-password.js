const db = require('./db');
const bcrypt = require('bcrypt');

const email = 'kik675846@gmail.com';
const newPassword = '123456';

db.get('SELECT * FROM users WHERE email = ?', [email], async (error, user) => {
  if (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }

  if (!user) {
    console.log('User not found. Creating new user...');
    
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    
    db.run(
      'INSERT INTO users (email, password, role) VALUES (?, ?, ?)',
      [email, hashedPassword, 'owner'],
      function (error) {
        if (error) {
          console.error('Error creating user:', error.message);
          process.exit(1);
        }
        console.log(`User created successfully. ID: ${this.lastID}`);
        console.log(`Email: ${email}`);
        console.log(`Password: ${newPassword}`);
        process.exit(0);
      }
    );
  } else {
    console.log('User found:', user.email, 'ID:', user.id, 'Role:', user.role);
    
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    
    db.run('UPDATE users SET password = ? WHERE email = ?', [hashedPassword, email], (error) => {
      if (error) {
        console.error('Error updating password:', error.message);
        process.exit(1);
      }
      console.log('Password updated successfully.');
      console.log(`Email: ${email}`);
      console.log(`New password: ${newPassword}`);
      process.exit(0);
    });
  }
});
