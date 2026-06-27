const db = require('./db');

console.log('Current users:');
db.all('SELECT id, email, role FROM users ORDER BY id', (error, users) => {
  if (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }

  console.log(users);
  
  const idsToKeep = [4, 11];
  const idsToDelete = users.filter(u => !idsToKeep.includes(u.id)).map(u => u.id);
  
  console.log('Users to delete:', idsToDelete);
  
  if (idsToDelete.length === 0) {
    console.log('No users to delete.');
    process.exit(0);
  }
  
  db.run('DELETE FROM users WHERE id NOT IN (4, 11)', (error) => {
    if (error) {
      console.error('Error deleting users:', error.message);
      process.exit(1);
    }
    
    console.log('Deleted users successfully.');
    
    db.all('SELECT id, email, role FROM users ORDER BY id', (error, remainingUsers) => {
      if (error) {
        console.error('Error:', error.message);
        process.exit(1);
      }
      
      console.log('Remaining users:', remainingUsers);
      process.exit(0);
    });
  });
});
