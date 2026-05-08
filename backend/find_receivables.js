const db = require('./db');

async function run() {
    try {
        const [rows] = await db.query("SELECT id, account_name, account_code FROM chart_of_accounts WHERE account_name LIKE '%RECEIVABLE%'");
        console.log(JSON.stringify(rows, null, 2));
    } catch (err) {
        console.error(err);
    } finally {
        process.exit(0);
    }
}

run();
