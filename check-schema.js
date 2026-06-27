const db = require('./db');

db.all("PRAGMA table_info(news)", (error, columns) => {
  if (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }

  console.log('Current news table schema:');
  columns.forEach((col) => {
    console.log(`- ${col.name}: ${col.type} ${col.notnull ? 'NOT NULL' : ''} ${col.dflt_value ? `DEFAULT ${col.dflt_value}` : ''}`);
  });

  process.exit(0);
});
