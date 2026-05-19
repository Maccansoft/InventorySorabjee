# MACCANSOFT Business Suite (FASYSTEM)

[![Enterprise Ready](https://img.shields.io/badge/Enterprise-Ready-blue.svg)]()
[![Tech Stack](https://img.shields.io/badge/Stack-React%20%7C%20Node%20%7C%20MySQL-orange.svg)]()
[![License](https://img.shields.io/badge/License-Proprietary-red.svg)]()

A comprehensive Full-Stack Enterprise Resource Planning (ERP) system tailored for accounting and inventory management. This system features multi-location support, hierarchical Chart of Accounts, automated inventory-to-ledger synchronization, and robust traceability through Lot and Serial Number tracking.

---

## 🚀 Key Features

### 🏦 Accounting & Finance
- **Hierarchical Chart of Accounts**: Tree-view management of Assets, Liabilities, Revenue, and Expenses with full **Excel Export & Import** capabilities for bulk updates.
- **Voucher Management**: Support for Payment, Receipt, and Journal vouchers with automated numbering and dynamic account ledgers.
- **General Ledger & Financial Reporting**: Real-time account statements, Trial Balances, Profit & Loss statements, and Balance Sheets with drill-down capabilities.
- **Fiscal Year Control**: Strict period management with the ability to close years to prevent retroactive changes and preserve audit trails.

### 📦 Inventory Management
- **Universal Transaction Engine**: Integrated handling of Purchases, Purchase Returns, Sales, Sales Returns, and Inter-location Stock Transfers.
- **Traceability**: Granular tracking using Lot Numbers, Serial Numbers (SNo), Expiry, and Manufacturing Dates.
- **Barcode Integration**: Smart structural barcode parsing for rapid data entry (e.g., parsing IRIS YYMMDD expiries).
- **Auto-Sync to Ledger**: Seamless, fully automated bridge between inventory movements and the general ledger (Customer/Supplier auto-mapping).
- **Bulk Printing**: Efficient Multi-Invoice and Multi-Delivery Challan (DC) bulk printing.

### 👥 Administration & Data Integrity
- **Multi-Location Support**: Strict data isolation and role-based access for different branches/head offices.
- **RBAC**: Secure user management with roles (Super Admin, Admin, User).
- **Audit Trail**: Created-by and Updated-at tracking for all key records, backed by MySQL transactions.

---

## 🏗 Database Structure Summary

The MySQL database (`maccans4_fa_system`) is highly normalized and relies on strict foreign key constraints (ON DELETE CASCADE / SET NULL) to maintain referential integrity.

- **Core/Admin**: `users`, `user_roles`, `locations`, `fiscal_years`
  - Defines the operational context and security boundaries for every transaction.
- **Finance**: `chart_of_accounts`, `vouchers`, `voucher_entries`, `journal_entries`, `journal_entry_details`, `opening_balances`
  - Forms the double-entry accounting core. `chart_of_accounts` uses a parent-child self-referencing relationship.
- **Inventory Masters**: `makers`, `categories`, `powers`, `suppliers`, `customers`, `barcode_master`, `company_info`
  - Stores all master data for products and business partners.
- **Transactions**: `purchases`, `purchase_returns`, `sales`, `sales_returns`, `transfers`, `transfer_requests`, `stock_opening_balances`
  - Each transaction module has a Header table (e.g., `sales`) and a Details table (e.g., `sales_details`). Detail tables directly link to product master data (`maker_id`, `category_id`, `power_id`).

---

## 🛠 Tech Stack

### Frontend
- **Framework**: React 19 (Vite)
- **Styling**: Vanilla CSS (Custom Design System with responsive grid layouts)
- **Icons**: Lucide React
- **Client**: Axios for RESTful API communication

### Backend
- **Runtime**: Node.js
- **Framework**: Express 5
- **Database**: MySQL (using `mysql2/promise` for native async/await and robust connection pooling)
- **Security**: JWT authentication, BcryptJS password hashing

### Infrastructure
- **Server**: Ubuntu Linux
- **Reverse Proxy**: Nginx
- **Process Manager**: PM2

---

## ⚙️ Installation Guide

### Prerequisites
- Node.js (v20+)
- MySQL (v8.0+)
- NPM or Yarn

### 1. Database Setup
```sql
-- Create Database
CREATE DATABASE maccans4_fa_system;

-- Import Schema (located in /backend/mysql_schema.sql)
mysql -u root -p maccans4_fa_system < backend/mysql_schema.sql
```

### 2. Backend Configuration
1. Navigate to `backend/`
2. Create `.env` file:
   ```env
   PORT=5005
   DB_HOST=localhost
   DB_USER=root
   DB_PASSWORD=your_password
   DB_NAME=maccans4_fa_system
   JWT_SECRET=your_super_secret_key
   ```
3. Install dependencies:
   ```bash
   npm install
   ```
4. Start the server:
   ```bash
   npm run dev    # For development
   npm start      # For production
   ```

### 3. Frontend Configuration
1. Navigate to `frontend/`
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start dev server:
   ```bash
   npm run dev
   ```

---

## 📖 Usage Instructions

1. **Authentication:** Log in using your assigned credentials. Your view will be strictly scoped to your assigned `Location` and active `Fiscal Year`.
2. **Setup Masters:** Before transacting, populate the `Chart of Accounts` (via UI or bulk Excel Import) and the `Inventory Masters` (Makers, Categories, Powers).
3. **Daily Operations:** 
   - Use **Receipts/Payments/Journals** for financial transactions.
   - Use the **Inventory Registries** (Sales Invoice, Purchase, Stock Transfer) for physical goods.
4. **Reporting:** Navigate to **Trial Balance**, **Profit & Loss**, or **Stock Reports** for real-time aggregated data. You can export these reports directly to Excel or print them as professional A4 documents.

---

## 🌐 Build & Deployment (Linux)

### 1. Build Frontend
```bash
cd frontend
npm run build
```

### 2. PM2 Deployment
```bash
cd backend
pm2 start index.js --name "fa-system-api"
```

### 3. Nginx Configuration
```nginx
server {
    listen 80;
    server_name yourdomain.com;

    location / {
        root /path/to/FASYSTEM/dist;
        try_files $uri /index.html;
    }

    location /api {
        proxy_pass http://localhost:5005;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

---

## 📁 Project Structure

```text
FASYSTEM/
├── backend/            # Express API, Database logic, Routes, Excel handling
├── frontend/           # React SPA (Vite), dynamic dashboards, print templates
├── dist/               # Production build output
└── maccans4_fa_system.sql # Full DB Backup
```

---

## 🔒 Security Notes
- All API routes (except login) are protected by JWT middleware.
- Passwords are salted and hashed using Bcrypt.
- Location-based filtering is enforced at the database query level to ensure data privacy between branches.
- Excel imports run within strict MySQL Transactions. If one row fails, the entire batch is rolled back to prevent data corruption.

---

## 🛠 Future Improvements
- [ ] **Dashboard Analytics**: Visual charts for sales trends and cash flow.
- [ ] **Multi-Currency Support**: Handling transactions in foreign currencies with exchange rates.
- [ ] **Mobile App**: React Native version for on-the-go inventory checks.
- [ ] **Automated Backups**: Scheduled SQL dumps to cloud storage.

---

© 2026 MACCANSOFT Systems. All rights reserved.
