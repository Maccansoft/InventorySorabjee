const db = require('./db');
async function run() {
  const [rows] = await db.query('SELECT id, trans_no, location_id, fiscal_year_id FROM sales');
  console.log('Sales rows:', rows);
  process.exit(0);
}
run();
