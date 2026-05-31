const mysql = require('mysql2/promise');
require('dotenv').config();

async function run() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'maccans4_fa_system',
  });

  try {
    console.log('Dropping fk_voucher_entries_voucher...');
    await connection.query('ALTER TABLE voucher_entries DROP FOREIGN KEY fk_voucher_entries_voucher');
    console.log('Dropped successfully!');

    console.log('--- show create table voucher_entries ---');
    const [[createVe]] = await connection.query('SHOW CREATE TABLE voucher_entries');
    console.log(createVe['Create Table']);
  } catch (err) {
    console.error('Error during DROP:', err);
  } finally {
    await connection.end();
  }
}

run();
