require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 5005;

app.use(cors());
app.use(express.json());

// API Routes
const accountRoutes = require('./routes/accounts');
const voucherRoutes = require('./routes/vouchers');
const ledgerRoutes = require('./routes/ledger');
const reportRoutes = require('./routes/reports');
const journalRoutes = require('./routes/journal');
const companyRoutes = require('./routes/company');
const authRoutes = require('./routes/auth');
const usersRoutes = require('./routes/users');
const locationsRoutes = require('./routes/locations');
const fiscalYearRoutes = require('./routes/fiscalYears');
const inventoryRoutes = require('./routes/inventory');

const authMiddleware = require('./middleware/auth');

app.use('/api/auth', authRoutes);

app.use('/api/accounts', authMiddleware, accountRoutes);
app.use('/api/vouchers', authMiddleware, voucherRoutes);
app.use('/api/ledger', authMiddleware, ledgerRoutes);
app.use('/api/reports', authMiddleware, reportRoutes);
app.use('/api/journal', authMiddleware, journalRoutes);
app.use('/api/company', companyRoutes);
app.use('/api/users', authMiddleware, usersRoutes);
app.use('/api/locations', authMiddleware, locationsRoutes);
app.use('/api/fiscal-years', authMiddleware, fiscalYearRoutes);
app.use('/api/inventory', authMiddleware, inventoryRoutes);

// Serve React build
app.use(express.static(path.join(__dirname, '../dist')));

app.get('/{*path}', (req, res) => {
    res.sendFile(path.join(__dirname, '../dist/index.html'));
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});