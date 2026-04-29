# MACCANSOFT Business Suite (FASYSTEM)

[![Enterprise Ready](https://img.shields.io/badge/Enterprise-Ready-blue.svg)]()
[![Tech Stack](https://img.shields.io/badge/Stack-React%20%7C%20Node%20%7C%20MySQL-orange.svg)]()
[![License](https://img.shields.io/badge/License-Proprietary-red.svg)]()

A comprehensive Full-Stack Enterprise Resource Planning (ERP) system tailored for accounting and inventory management. This system features multi-location support, hierarchical Chart of Accounts, automated inventory-to-ledger synchronization, and robust traceability through Lot and Serial Number tracking.

---

## 🚀 Key Features

### 🏦 Accounting & Finance
- **Hierarchical Chart of Accounts**: Tree-view management of Assets, Liabilities, Revenue, and Expenses.
- **Voucher Management**: Support for Payment, Receipt, and Journal vouchers with automated numbering.
- **General Ledger**: Real-time account statements with drill-down capabilities.
- **Fiscal Year Control**: Strict period management with the ability to close years to prevent retroactive changes.

### 📦 Inventory Management
- **Universal Transaction Engine**: Integrated handling of Purchases, Sales, Returns, and Inter-location Transfers.
- **Traceability**: Granular tracking using Lot Numbers and Serial Numbers (SNo).
- **Barcode Integration**: Smart structural barcode parsing for rapid data entry.
- **Auto-Sync**: Seamless bridge between inventory movements and the general ledger.

### 👥 Administration
- **Multi-Location Support**: Data isolation and role-based access for different branches.
- **RBAC**: Secure user management with roles (Super Admin, Admin, User).
- **Audit Trail**: Created-by and Updated-at tracking for all key records.

---

## 🛠 Tech Stack

### Frontend
- **Framework**: React 19 (Vite)
- **Styling**: Vanilla CSS (Custom Design System)
- **Icons**: Lucide React
- **Client**: Axios

### Backend
- **Runtime**: Node.js
- **Framework**: Express 5
- **Database**: MySQL (using `mysql2/promise`)
- **Security**: JWT, BcryptJS

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
   npm start
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
├── backend/            # Express API, Database logic, Routes
├── frontend/           # React SPA (Vite)
├── dist/               # Production build output
└── maccans4_fa_system.sql # Full DB Backup
```

---

## 🔒 Security Notes
- All API routes (except login) are protected by JWT middleware.
- Passwords are salted and hashed using Bcrypt.
- Location-based filtering is enforced at the database query level to ensure data privacy between branches.

---

## 🛠 Future Improvements
- [ ] **Dashboard Analytics**: Visual charts for sales trends and cash flow.
- [ ] **Multi-Currency Support**: Handling transactions in foreign currencies with exchange rates.
- [ ] **Mobile App**: React Native version for on-the-go inventory checks.
- [ ] **Automated Backups**: Scheduled SQL dumps to cloud storage.

---

© 2026 MACCANSOFT Systems. All rights reserved.# InventorySorabjee
