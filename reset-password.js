const db = require('./db');
const bcrypt = require('bcrypt');
const crypto = require('crypto');

const email = process.argv[2] || 'kik675846@gmail.com';
const newPassword = process.argv[3] || crypto.randomBytes(12).toString('base64url');
const isGenerated = !process.argv[3];

console.log(`Usage: node reset-password.js [email] [password]`);
console.log(`If no password is provided, a secure random one will be generated.\n`);

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
