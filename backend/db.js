require('dotenv').config();
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'maccans4_fa_system',
  waitForConnections: true,
  connectionLimit: 15, // Increased for production
  queueLimit: 0,
  connectTimeout: 30000,
  enableKeepAlive: true,
});

// Improve error handling for pool
pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
  if (err.code === 'PROTOCOL_CONNECTION_LOST') {
    console.error('Database connection was closed.');
  }
  if (err.code === 'ER_CON_COUNT_ERROR') {
    console.error('Database has too many connections.');
  }
  if (err.code === 'ECONNREFUSED') {
    console.error('Database connection was refused.');
  }
});

// Helper for safe query execution during migrations
async function safeQuery(conn, label, sql, params = []) {
  try {
    await conn.query(sql, params);
    // console.log(`✓ ${label}`);
  } catch (err) {
    if (err.code === 'ER_DUP_FIELDNAME' || err.code === 'ER_DUP_KEYNAME' || err.code === 'ER_CANT_DROP_FIELD_OR_KEY') {
      // Ignore duplicate column/index errors
    } else {
      console.warn(`! ${label} failed: ${err.message}`);
    }
  }
}

// ── Test DB connection ────────────────────────────────────────────────────────
(async () => {
  try {
    const conn = await pool.getConnection();
    conn.release();
    console.log(`✅ MySQL connected → ${process.env.DB_HOST}:${process.env.DB_PORT || 3306} / ${process.env.DB_NAME}`);
  } catch (err) {
    console.error(`❌ MySQL connection FAILED: ${err.message}`);
  }
})();

async function initDB() {
  let conn;
  try {
    conn = await pool.getConnection();

    // 1. Locations
    await conn.query(`
      CREATE TABLE IF NOT EXISTS locations (
        id          INT PRIMARY KEY AUTO_INCREMENT,
        code        VARCHAR(20)  NOT NULL UNIQUE,
        name        VARCHAR(150) NOT NULL,
        is_head_office BOOLEAN  DEFAULT FALSE,
        is_active   BOOLEAN      DEFAULT TRUE,
        created_at  TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
        INDEX (is_active)
      )
    `);
    await safeQuery(conn, 'loc.is_head_office', 'ALTER TABLE locations ADD COLUMN is_head_office BOOLEAN DEFAULT FALSE');
    await safeQuery(conn, 'loc.is_active', 'ALTER TABLE locations ADD COLUMN is_active BOOLEAN DEFAULT TRUE');
    await safeQuery(conn, 'loc.idx_active', 'CREATE INDEX idx_loc_active ON locations(is_active)');
    await safeQuery(conn, 'loc.code', "ALTER TABLE locations ADD COLUMN code VARCHAR(20) NOT NULL DEFAULT 'XX'");

    // 2. Fiscal Years
    await conn.query(`
      CREATE TABLE IF NOT EXISTS fiscal_years (
        id          INT PRIMARY KEY AUTO_INCREMENT,
        label       VARCHAR(20)  NOT NULL UNIQUE,
        start_date  DATE         NOT NULL,
        end_date    DATE         NOT NULL,
        is_active   BOOLEAN      DEFAULT TRUE,
        is_closed   BOOLEAN      DEFAULT FALSE,
        closed_at   TIMESTAMP    NULL,
        created_at  TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
        INDEX (is_active, is_closed)
      )
    `);
    await safeQuery(conn, 'fy.is_active', 'ALTER TABLE fiscal_years ADD COLUMN is_active BOOLEAN DEFAULT TRUE');
    await safeQuery(conn, 'fy.is_closed', 'ALTER TABLE fiscal_years ADD COLUMN is_closed BOOLEAN DEFAULT FALSE');
    await safeQuery(conn, 'fy.idx_active', 'CREATE INDEX idx_fy_active ON fiscal_years(is_active, is_closed)');
    await safeQuery(conn, 'fy.closed_at', 'ALTER TABLE fiscal_years ADD COLUMN closed_at TIMESTAMP NULL');
    await safeQuery(conn, 'fy.rename_label', 'ALTER TABLE fiscal_years CHANGE COLUMN year_name label VARCHAR(50)');

    // 3. Users
    // 3. Users
    await conn.query(`
      CREATE TABLE IF NOT EXISTS users (
        id          INT PRIMARY KEY AUTO_INCREMENT,
        username    VARCHAR(100) NOT NULL UNIQUE,
        password    VARCHAR(255) NOT NULL,
        full_name   VARCHAR(200),
        role        ENUM('SUPER_ADMIN','ADMIN','USER') DEFAULT 'USER',
        location_id INT          NULL,
        is_active   BOOLEAN      DEFAULT TRUE,
        created_by  INT          NULL,
        created_at  TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
        INDEX (location_id),
        CONSTRAINT fk_user_location FOREIGN KEY (location_id) REFERENCES locations(id) ON DELETE SET NULL
      )
    `);
    await safeQuery(conn, 'users.full_name', 'ALTER TABLE users ADD COLUMN full_name VARCHAR(200)');
    await safeQuery(conn, 'users.role_enum', "ALTER TABLE users MODIFY COLUMN role ENUM('SUPER_ADMIN','ADMIN','USER') DEFAULT 'USER'");
    await safeQuery(conn, 'users.location_id', 'ALTER TABLE users ADD COLUMN location_id INT NULL');
    await safeQuery(conn, 'users.is_active', 'ALTER TABLE users ADD COLUMN is_active BOOLEAN DEFAULT TRUE');
    await safeQuery(conn, 'users.created_by', 'ALTER TABLE users ADD COLUMN created_by INT NULL');
    await safeQuery(conn, 'users.fix_empty_role', "UPDATE users SET role = 'USER' WHERE role IS NULL OR role = ''");

    // 4. User Roles
    await conn.query(`
      CREATE TABLE IF NOT EXISTS user_roles (
        id          INT PRIMARY KEY AUTO_INCREMENT,
        user_id     INT NOT NULL,
        permission  VARCHAR(100) NOT NULL,
        INDEX (user_id),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);
    await safeQuery(conn, 'user_roles.idx_user', 'CREATE INDEX idx_ur_user ON user_roles(user_id)');

    // 5. Chart of Accounts
    await conn.query(`
      CREATE TABLE IF NOT EXISTS chart_of_accounts (
        id            INT PRIMARY KEY AUTO_INCREMENT,
        account_code  VARCHAR(50)  NOT NULL UNIQUE,
        account_name  VARCHAR(150) NOT NULL,
        parent_id     INT          NULL,
        account_type  VARCHAR(50)  NOT NULL,
        level         INT          NOT NULL DEFAULT 1,
        is_main       BOOLEAN      DEFAULT FALSE,
        is_active     BOOLEAN      DEFAULT TRUE,
        statement_type ENUM('BALANCE_SHEET', 'PROFIT_LOSS', 'BOTH') DEFAULT 'BALANCE_SHEET',
        inventory_module ENUM('STOCK_PURCHASE', 'PURCHASE_RETURN', 'SALES_INVOICE', 'SALES_RETURN', 'NONE') DEFAULT 'NONE',
        location_id   INT          NULL,
        created_by    INT          NULL,
        created_at    TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
        INDEX (parent_id),
        INDEX (location_id),
        CONSTRAINT fk_parent_account FOREIGN KEY (parent_id) REFERENCES chart_of_accounts(id) ON DELETE CASCADE,
        CONSTRAINT fk_coa_location FOREIGN KEY (location_id) REFERENCES locations(id) ON DELETE SET NULL,
        CONSTRAINT fk_coa_creator FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
      )
    `);
    await safeQuery(conn, 'coa.statement_type', "ALTER TABLE chart_of_accounts MODIFY COLUMN statement_type ENUM('BALANCE_SHEET', 'PROFIT_LOSS', 'BOTH') DEFAULT 'BALANCE_SHEET'");
    await safeQuery(conn, 'coa.inventory_module', "ALTER TABLE chart_of_accounts ADD COLUMN inventory_module ENUM('STOCK_PURCHASE', 'PURCHASE_RETURN', 'SALES_INVOICE', 'SALES_RETURN', 'NONE') DEFAULT 'NONE'");
    await safeQuery(conn, 'coa.location_id', 'ALTER TABLE chart_of_accounts ADD COLUMN location_id INT NULL');
    await safeQuery(conn, 'coa.created_by', 'ALTER TABLE chart_of_accounts ADD COLUMN created_by INT NULL');

    // 6. Vouchers
    await conn.query(`
      CREATE TABLE IF NOT EXISTS vouchers (
        id            INT AUTO_INCREMENT PRIMARY KEY,
        voucher_no    VARCHAR(50)  UNIQUE,
        voucher_type  ENUM('PAYMENT','RECEIPT','JOURNAL'),
        date          DATE,
        description   TEXT,
        cheque_no     VARCHAR(50),
        cheque_date   VARCHAR(50),
        bank_name     VARCHAR(255),
        paid_by       VARCHAR(255),
        total_amount  DECIMAL(15,2),
        location_id   INT          NULL,
        fiscal_year_id INT         NULL,
        created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX (date),
        INDEX (location_id, fiscal_year_id),
        CONSTRAINT fk_voucher_location FOREIGN KEY (location_id) REFERENCES locations(id) ON DELETE RESTRICT,
        CONSTRAINT fk_voucher_fy FOREIGN KEY (fiscal_year_id) REFERENCES fiscal_years(id) ON DELETE RESTRICT
      )
    `);
    await safeQuery(conn, 'vouchers.location_id', 'ALTER TABLE vouchers ADD COLUMN location_id INT NULL');
    await safeQuery(conn, 'vouchers.fiscal_year_id', 'ALTER TABLE vouchers ADD COLUMN fiscal_year_id INT NULL');
    // Important: Change date to DATE type if it's VARCHAR
    await safeQuery(conn, 'vouchers.date_type', 'ALTER TABLE vouchers MODIFY COLUMN date DATE');
    await safeQuery(conn, 'vouchers.seq', 'ALTER TABLE vouchers ADD COLUMN sequence_no INT DEFAULT 1');
    await safeQuery(conn, 'vouchers.txn_type', 'ALTER TABLE vouchers ADD COLUMN transaction_type VARCHAR(20)');
    await safeQuery(conn, 'vouchers.loc_code', 'ALTER TABLE vouchers ADD COLUMN location_code VARCHAR(20)');
    await safeQuery(conn, 'vouchers.fy_label', 'ALTER TABLE vouchers ADD COLUMN fiscal_year_label VARCHAR(50)');

    // 7. Voucher Entries
    await conn.query(`
      CREATE TABLE IF NOT EXISTS voucher_entries (
        id          INT AUTO_INCREMENT PRIMARY KEY,
        voucher_id  INT,
        account_id  INT,
        dr_amount   DECIMAL(15,2) DEFAULT 0,
        cr_amount   DECIMAL(15,2) DEFAULT 0,
        description TEXT,
        INDEX (voucher_id),
        INDEX (account_id),
        CONSTRAINT fk_ve_voucher FOREIGN KEY (voucher_id) REFERENCES vouchers(id) ON DELETE CASCADE,
        CONSTRAINT fk_ve_account FOREIGN KEY (account_id) REFERENCES chart_of_accounts(id) ON DELETE RESTRICT
      )
    `);
    // Ensure ON DELETE CASCADE for existing table
    await safeQuery(conn, 've.fk_cascade_drop', 'ALTER TABLE voucher_entries DROP FOREIGN KEY voucher_entries_ibfk_1');
    await safeQuery(conn, 've.fk_cascade_add', 'ALTER TABLE voucher_entries ADD CONSTRAINT fk_ve_voucher FOREIGN KEY (voucher_id) REFERENCES vouchers(id) ON DELETE CASCADE');

    // 8. Opening Balances (Accounting)
    await conn.query(`
      CREATE TABLE IF NOT EXISTS opening_balances (
        id             INT PRIMARY KEY AUTO_INCREMENT,
        fiscal_year_id INT NOT NULL,
        account_id     INT NOT NULL,
        location_id    INT NOT NULL,
        opening_balance DECIMAL(15,2) DEFAULT 0,
        created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uq_fy_acc_loc (fiscal_year_id, account_id, location_id),
        CONSTRAINT fk_ob_fy FOREIGN KEY (fiscal_year_id) REFERENCES fiscal_years(id) ON DELETE CASCADE,
        CONSTRAINT fk_ob_acc FOREIGN KEY (account_id) REFERENCES chart_of_accounts(id) ON DELETE CASCADE,
        CONSTRAINT fk_ob_loc FOREIGN KEY (location_id) REFERENCES locations(id) ON DELETE CASCADE
      )
    `);

    // 9. Company Info
    await conn.query(`
      CREATE TABLE IF NOT EXISTS company_info (
        id            INT PRIMARY KEY AUTO_INCREMENT,
        CompanyName   VARCHAR(255) NOT NULL,
        Address       TEXT,
        Contact       VARCHAR(100),
        Email         VARCHAR(100),
        NTNo          VARCHAR(50),
        GSTNo         VARCHAR(50),
        GovtNo        VARCHAR(50),
        IATACode      VARCHAR(50),
        FaxNo         VARCHAR(100),
        updated_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);
    await safeQuery(conn, 'co_info.FaxNo', 'ALTER TABLE company_info ADD COLUMN FaxNo VARCHAR(100)');

    // 10. Inventory Masters
    await conn.query(`CREATE TABLE IF NOT EXISTS makers (id INT PRIMARY KEY AUTO_INCREMENT, name VARCHAR(150) NOT NULL UNIQUE, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`);
    await conn.query(`CREATE TABLE IF NOT EXISTS categories (id INT PRIMARY KEY AUTO_INCREMENT, name VARCHAR(150) NOT NULL, maker_id INT NOT NULL, rate DECIMAL(15,2) DEFAULT 0, description TEXT, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (maker_id) REFERENCES makers(id) ON DELETE CASCADE)`);
    await safeQuery(conn, 'cat.rate', 'ALTER TABLE categories ADD COLUMN rate DECIMAL(15,2) DEFAULT 0');
    await safeQuery(conn, 'cat.desc', 'ALTER TABLE categories ADD COLUMN description TEXT');
    await conn.query(`CREATE TABLE IF NOT EXISTS powers (id INT PRIMARY KEY AUTO_INCREMENT, power VARCHAR(100) NOT NULL UNIQUE, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`);
    await conn.query(`CREATE TABLE IF NOT EXISTS suppliers (id INT PRIMARY KEY AUTO_INCREMENT, name VARCHAR(150) NOT NULL, contact_person VARCHAR(150), mobile VARCHAR(20), phone VARCHAR(20), fax VARCHAR(20), email VARCHAR(100), address TEXT, ntn VARCHAR(50), gst VARCHAR(50), location_id INT NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, CONSTRAINT fk_sup_loc FOREIGN KEY (location_id) REFERENCES locations(id) ON DELETE SET NULL)`);
    await conn.query(`CREATE TABLE IF NOT EXISTS customers (id INT PRIMARY KEY AUTO_INCREMENT, name VARCHAR(150) NOT NULL, contact_person VARCHAR(150), mobile VARCHAR(20), phone VARCHAR(20), fax VARCHAR(20), email VARCHAR(100), address TEXT, ntn VARCHAR(50), gst VARCHAR(50), location_id INT NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, CONSTRAINT fk_cus_loc FOREIGN KEY (location_id) REFERENCES locations(id) ON DELETE SET NULL)`);
    await safeQuery(conn, 'suppliers.loc', 'ALTER TABLE suppliers ADD COLUMN location_id INT NULL');
    await safeQuery(conn, 'customers.loc', 'ALTER TABLE customers ADD COLUMN location_id INT NULL');
    await safeQuery(conn, 'customers.idx_loc', 'CREATE INDEX idx_customers_location ON customers(location_id)');


    // 11. Inventory Transactions (Consolidated logic)
    const txTables = [
      { name: 'stock_opening_balances', details: false },
      { name: 'purchases', details: 'purchase_details', fk: 'purchase_id' },
      { name: 'purchase_returns', details: 'purchase_return_details', fk: 'purchase_return_id' },
      { name: 'sales', details: 'sales_details', fk: 'sale_id' },
      { name: 'sales_returns', details: 'sales_return_details', fk: 'sales_return_id' },
      { name: 'transfers', details: 'transfer_details', fk: 'transfer_id' },
      { name: 'transfer_requests', details: 'transfer_request_details', fk: 'request_id' },
    ];

    for (const tx of txTables) {
      if (tx.name === 'stock_opening_balances') {
        await conn.query(`
            CREATE TABLE IF NOT EXISTS stock_opening_balances (
              id             INT PRIMARY KEY AUTO_INCREMENT,
              trans_no       VARCHAR(50),
              trans_date     DATE,
              maker_id       INT NOT NULL,
              category_id    INT NOT NULL,
              power_id       INT,
              lot_no         VARCHAR(100),
              sno            VARCHAR(100),
              qty            DECIMAL(15,2) DEFAULT 0,
              rate           DECIMAL(15,2) DEFAULT 0,
              amount         DECIMAL(15,2) DEFAULT 0,
              exp_date       DATE,
              mfg_date       DATE,
              location_id    INT NOT NULL,
              fiscal_year_id INT NOT NULL,
              created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
              sequence_no    INT DEFAULT 1,
              transaction_type VARCHAR(20) DEFAULT 'STK',
              location_code  VARCHAR(20),
              fiscal_year_label VARCHAR(50),
              INDEX (location_id, fiscal_year_id),
              FOREIGN KEY (maker_id) REFERENCES makers(id),
              FOREIGN KEY (category_id) REFERENCES categories(id),
              FOREIGN KEY (location_id) REFERENCES locations(id),
              FOREIGN KEY (fiscal_year_id) REFERENCES fiscal_years(id)
            )
         `);
        await safeQuery(conn, 'stk_op.drop_unique', 'ALTER TABLE stock_opening_balances DROP INDEX trans_no');
        await safeQuery(conn, 'stk_op.seq', 'ALTER TABLE stock_opening_balances ADD COLUMN sequence_no INT DEFAULT 1');
        await safeQuery(conn, 'stk_op.txn_type', 'ALTER TABLE stock_opening_balances ADD COLUMN transaction_type VARCHAR(20) DEFAULT "STK"');
        await safeQuery(conn, 'stk_op.loc_code', 'ALTER TABLE stock_opening_balances ADD COLUMN location_code VARCHAR(20)');
        await safeQuery(conn, 'stk_op.fy_label', 'ALTER TABLE stock_opening_balances ADD COLUMN fiscal_year_label VARCHAR(50)');
      } else if (tx.name === 'transfer_requests') {
        await conn.query(`
            CREATE TABLE IF NOT EXISTS transfer_requests (
              id             INT PRIMARY KEY AUTO_INCREMENT,
              trans_no       VARCHAR(50) UNIQUE,
              trans_date     DATE NOT NULL,
              location_id    INT NOT NULL,
              fiscal_year_id INT NOT NULL,
              user_id        INT NOT NULL,
              total_qty      DECIMAL(15,2) DEFAULT 0,
              status         VARCHAR(20) DEFAULT 'PENDING',
              created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
              sequence_no    INT DEFAULT 1,
              transaction_type VARCHAR(20) DEFAULT 'TRQ',
              location_code  VARCHAR(20),
              fiscal_year_label VARCHAR(50),
              FOREIGN KEY (location_id) REFERENCES locations(id),
              FOREIGN KEY (fiscal_year_id) REFERENCES fiscal_years(id),
              FOREIGN KEY (user_id) REFERENCES users(id)
            )
          `);
    await safeQuery(conn, 'tr.to_location_id', 'ALTER TABLE transfer_requests ADD COLUMN to_location_id INT NULL');
    await safeQuery(conn, 'tr.notification_seen', 'ALTER TABLE transfer_requests ADD COLUMN notification_seen TINYINT DEFAULT 0');
    await safeQuery(conn, 'tr.status_update_v2', "ALTER TABLE transfer_requests MODIFY COLUMN status ENUM('PENDING', 'TRANSFERRED', 'TRANSFER', 'CANCELLED') DEFAULT 'PENDING'");
    await safeQuery(conn, 'tr.seq', 'ALTER TABLE transfer_requests ADD COLUMN sequence_no INT DEFAULT 1');
    await safeQuery(conn, 'tr.txn_type', "ALTER TABLE transfer_requests ADD COLUMN transaction_type VARCHAR(20) DEFAULT 'TRQ'");
    await safeQuery(conn, 'tr.loc_code', 'ALTER TABLE transfer_requests ADD COLUMN location_code VARCHAR(20)');
    await safeQuery(conn, 'tr.fy_label', 'ALTER TABLE transfer_requests ADD COLUMN fiscal_year_label VARCHAR(50)');
    // Force fix any invalid/empty statuses to TRANSFERRED if they were previously WAITING_TRANSFER or got corrupted during ENUM change
    await conn.query(`UPDATE transfer_requests SET status = 'TRANSFERRED' WHERE status = 'WAITING_TRANSFER' OR status = '' OR status IS NULL`);
      } else {
        const partyCol = tx.name.includes('purchase') ? 'supplier_id' : (tx.name.includes('sale') ? 'customer_id' : null);
        const partyTable = tx.name.includes('purchase') ? 'suppliers' : 'customers';

        await conn.query(`
          CREATE TABLE IF NOT EXISTS ${tx.name} (
            id             INT PRIMARY KEY AUTO_INCREMENT,
            trans_no       VARCHAR(50) UNIQUE,
            trans_date     DATE NOT NULL,
            ${partyCol ? `${partyCol} INT NULL,` : ''}
            ${tx.name === 'transfers' ? 'from_location_id INT NULL, to_location_id INT NULL,' : ''}
            total_amount   DECIMAL(15,2) DEFAULT 0,
            voucher_id     INT NULL,
            fiscal_year_id INT NOT NULL,
            user_id        INT NOT NULL,
            location_id    INT NOT NULL,
            created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            sequence_no    INT DEFAULT 1,
            transaction_type VARCHAR(20),
            location_code  VARCHAR(20),
            fiscal_year_label VARCHAR(50),
            INDEX (location_id, fiscal_year_id),
            INDEX (trans_date),
            ${partyCol ? `CONSTRAINT fk_${tx.name}_party FOREIGN KEY (${partyCol}) REFERENCES ${partyTable}(id) ON DELETE SET NULL,` : ''}
            CONSTRAINT fk_${tx.name}_voucher FOREIGN KEY (voucher_id) REFERENCES vouchers(id) ON DELETE SET NULL,
            CONSTRAINT fk_${tx.name}_fy FOREIGN KEY (fiscal_year_id) REFERENCES fiscal_years(id) ON DELETE CASCADE,
            CONSTRAINT fk_${tx.name}_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
            CONSTRAINT fk_${tx.name}_loc FOREIGN KEY (location_id) REFERENCES locations(id) ON DELETE CASCADE
          )
        `);
        // Generic migrations for all these dynamically created tables
        await safeQuery(conn, `${tx.name}.seq`, `ALTER TABLE ${tx.name} ADD COLUMN sequence_no INT DEFAULT 1`);
        await safeQuery(conn, `${tx.name}.txn_type`, `ALTER TABLE ${tx.name} ADD COLUMN transaction_type VARCHAR(20)`);
        await safeQuery(conn, `${tx.name}.loc_code`, `ALTER TABLE ${tx.name} ADD COLUMN location_code VARCHAR(20)`);
        await safeQuery(conn, `${tx.name}.fy_label`, `ALTER TABLE ${tx.name} ADD COLUMN fiscal_year_label VARCHAR(50)`);
      }

      if (tx.details) {
        await conn.query(`
          CREATE TABLE IF NOT EXISTS ${tx.details} (
            id             INT PRIMARY KEY AUTO_INCREMENT,
            ${tx.fk}       INT NOT NULL,
            maker_id       INT NOT NULL,
            category_id    INT NOT NULL,
            power_id       INT NULL,
            lot_no         VARCHAR(100),
            sno            VARCHAR(100),
            exp_date       DATE,
            mfg_date       DATE,
            qty            DECIMAL(15,2) DEFAULT 0,
            qty_sold       DECIMAL(15,2) DEFAULT 0,
            rate           DECIMAL(15,2) DEFAULT 0,
            p_rate         VARCHAR(50) DEFAULT '',
            amount         DECIMAL(15,2) DEFAULT 0,
            INDEX (${tx.fk}),
            CONSTRAINT fk_${tx.details}_header FOREIGN KEY (${tx.fk}) REFERENCES ${tx.name}(id) ON DELETE CASCADE,
            FOREIGN KEY (maker_id) REFERENCES makers(id),
            FOREIGN KEY (category_id) REFERENCES categories(id)
          )
        `);
      }
    }

    await safeQuery(conn, 'sales_details.p_rate', 'ALTER TABLE sales_details ADD COLUMN p_rate VARCHAR(50) DEFAULT ""');
    await safeQuery(conn, 'sales_return_details.p_rate', 'ALTER TABLE sales_return_details ADD COLUMN p_rate VARCHAR(50) DEFAULT ""');
    await safeQuery(conn, 'purchase_details.p_rate', 'ALTER TABLE purchase_details ADD COLUMN p_rate VARCHAR(50) DEFAULT ""');
    await safeQuery(conn, 'purchase_return_details.p_rate', 'ALTER TABLE purchase_return_details ADD COLUMN p_rate VARCHAR(50) DEFAULT ""');

    // 12. Barcode Master
    await conn.query(`
      CREATE TABLE IF NOT EXISTS barcode_master (
        id         INT PRIMARY KEY AUTO_INCREMENT,
        barcode    VARCHAR(150) UNIQUE NOT NULL,
        lot_no     VARCHAR(100),
        sno        VARCHAR(100),
        exp_date   DATE,
        mfg_date   DATE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // 13. Sales Invoice Rates (A.Rate / P.Rate)
    await conn.query(`
      CREATE TABLE IF NOT EXISTS sales_invoice_rates (
        id         INT PRIMARY KEY AUTO_INCREMENT,
        a_rate     DECIMAL(15,2) DEFAULT 0,
        b_rate     DECIMAL(15,2) DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);

    // 14. Journal Entries (from migrate.js)
    await conn.query(`
      CREATE TABLE IF NOT EXISTS journal_entries (
        id           INT PRIMARY KEY AUTO_INCREMENT,
        entry_date   DATE NOT NULL,
        reference_no VARCHAR(50),
        description  TEXT,
        location_id  INT,
        fiscal_year_id INT,
        created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX (entry_date),
        FOREIGN KEY (location_id) REFERENCES locations(id) ON DELETE SET NULL,
        FOREIGN KEY (fiscal_year_id) REFERENCES fiscal_years(id) ON DELETE SET NULL
      )
    `);
    await safeQuery(conn, 'je.loc', 'ALTER TABLE journal_entries ADD COLUMN location_id INT NULL');
    await safeQuery(conn, 'je.fy', 'ALTER TABLE journal_entries ADD COLUMN fiscal_year_id INT NULL');

    await conn.query(`
      CREATE TABLE IF NOT EXISTS journal_entry_details (
        id         INT PRIMARY KEY AUTO_INCREMENT,
        journal_id INT,
        account_id INT,
        debit      DECIMAL(15,2) DEFAULT 0,
        credit     DECIMAL(15,2) DEFAULT 0,
        description TEXT,
        INDEX (journal_id),
        INDEX (account_id),
        CONSTRAINT fk_jed_header FOREIGN KEY (journal_id) REFERENCES journal_entries(id) ON DELETE CASCADE,
        CONSTRAINT fk_jed_account FOREIGN KEY (account_id) REFERENCES chart_of_accounts(id) ON DELETE RESTRICT
      )
    `);

    // ── Pre-seeding Logic ──

    // Seed locations
    const [[{ locCount }]] = await conn.query("SELECT COUNT(*) as locCount FROM locations");
    if (locCount === 0) {
      await conn.query(`INSERT INTO locations (code, name, is_head_office) VALUES ('HO', 'HEAD OFFICE', TRUE), ('KHI', 'KARACHI', FALSE), ('LHR', 'LAHORE', FALSE)`);
    }

    // Seed fiscal year
    const [[{ fyCount }]] = await conn.query("SELECT COUNT(*) as fyCount FROM fiscal_years");
    if (fyCount === 0) {
      await conn.query(`INSERT INTO fiscal_years (label, start_date, end_date, is_active) VALUES ('2025-2026', '2025-07-01', '2026-06-30', TRUE)`);
    }

    // Seed company info
    const [[{ coCount }]] = await conn.query("SELECT COUNT(*) as coCount FROM company_info");
    if (coCount === 0) {
      await conn.query(`INSERT INTO company_info (CompanyName, Address) VALUES ('MACCANSOFT SYSTEMS', 'Business Avenue, Karachi')`);
    }

    // Seed root accounts
    const [[{ coaCount }]] = await conn.query("SELECT COUNT(*) as coaCount FROM chart_of_accounts");
    if (coaCount === 0) {
      await conn.query(`
        INSERT INTO chart_of_accounts (account_code, account_name, account_type, level, is_main, is_active, statement_type)
        VALUES 
          ('C01', 'CAPITAL',   'CAPITAL',   1, TRUE, FALSE, 'BALANCE_SHEET'),
          ('A01', 'ASSETS',    'ASSET',     1, TRUE, FALSE, 'BALANCE_SHEET'),
          ('L01', 'LIABILITY', 'LIABILITY', 1, TRUE, FALSE, 'BALANCE_SHEET'),
          ('R01', 'REVENUE',   'REVENUE',   1, TRUE, FALSE, 'PROFIT_LOSS'),
          ('E01', 'EXPENSE',   'EXPENSE',   1, TRUE, FALSE, 'PROFIT_LOSS')
      `);
    }

    // Seed sales invoice rates
    const [[{ rateCount }]] = await conn.query("SELECT COUNT(*) as rateCount FROM sales_invoice_rates");
    if (rateCount === 0) {
      await conn.query(`INSERT INTO sales_invoice_rates (a_rate, b_rate) VALUES (100, 95), (250, 230), (500, 480), (1000, 950), (1500, 1400)`);
    }

    // Seed Super Admin
    const [[saUser]] = await conn.query("SELECT id FROM users WHERE username = 'superadmin'");
    if (!saUser) {
      const hash = await bcrypt.hash('superadmin123', 10);
      await conn.query("INSERT INTO users (username, password, full_name, role, is_active) VALUES (?, ?, 'Super Administrator', 'SUPER_ADMIN', TRUE)", [hash]);
    }

    console.log("✅ Database initialized and optimized.");
    conn.release();
  } catch (err) {
    if (conn) conn.release();
    console.error("❌ DB init error:", err.message);
  }
}

initDB();

module.exports = pool;
