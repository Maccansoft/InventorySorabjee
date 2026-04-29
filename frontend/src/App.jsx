import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  BarChart3, TrendingUp, TrendingDown, PieChart,
  FileText, Search, Plus, Menu, Box,
  CreditCard, Wallet, BookOpen, Scale, Activity,
  ArrowDownCircle, ArrowUpCircle, BookMarked,
  Users, Calendar, MapPin, LogOut, Settings, ChevronDown,
  Building2, ShieldCheck, Shield, Filter, Eye, ShoppingCart,
  Repeat, Truck, RefreshCw, Printer, Barcode, Bell
} from 'lucide-react';
import VoucherForm from './components/VoucherForm';
import VoucherList from './components/VoucherList';
import LedgerView from './components/LedgerView';
import AccountModal from './components/AccountModal';
import AccountTree from './components/AccountTree';
import LoginPage from './components/LoginPage';
import UserManagement from './components/UserManagement';
import FiscalYearManager from './components/FiscalYearManager';
import MakerMaster from './components/inventory/MakerMaster';
import CategoryMaster from './components/inventory/CategoryMaster';
import PowerMaster from './components/inventory/PowerMaster';
import SupplierMaster from './components/inventory/SupplierMaster';
import CustomerMaster from './components/inventory/CustomerMaster';
import InventoryTransactions from './components/inventory/InventoryTransactions';
import StockReport from './components/inventory/StockReport';
import SalesReport from './components/inventory/SalesReport';
import BarcodeSetup from './components/inventory/BarcodeSetup';
import Dashboard from './components/Dashboard';
import PendingTransfersModal from './components/inventory/PendingTransfersModal';
import { printTable, exportToCSV } from './utils/exportUtils';
import ExportModal from './components/common/ExportModal';

const API = '/api';

axios.interceptors.request.use(config => {
  const token = sessionStorage.getItem('fa_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
}, error => Promise.reject(error));

axios.interceptors.response.use(response => response, error => {
  if (error.response && error.response.status === 401) {
    sessionStorage.removeItem('fa_user');
    sessionStorage.removeItem('fa_token');
    window.location.reload();
  }
  return Promise.reject(error);
});

const App = () => {
  // ── Auth state ────────────────────────────────────────────────────────────
  const [currentUser, setCurrentUser] = useState(() => {
    try { return JSON.parse(sessionStorage.getItem('fa_user')) || null; } catch { return null; }
  });

  // ── Data state ────────────────────────────────────────────────────────────
  const [accounts, setAccounts] = useState([]);
  const [treeAccounts, setTreeAccounts] = useState([]);
  const [accountModal, setAccountModal] = useState(false);
  const [exportModal, setExportModal] = useState(false);
  const [editingAccount, setEditingAccount] = useState(null);
  const [activeTab, setActiveTab] = useState(() => sessionStorage.getItem('fa_active_tab') || 'Dashboard');

  useEffect(() => {
    sessionStorage.setItem('fa_active_tab', activeTab);
  }, [activeTab]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [summaryStats, setSummaryStats] = useState({});
  const [trialBalance, setTrialBalance] = useState([]);
  const [profitLoss, setProfitLoss] = useState({ rows: [], net_profit: 0 });
  const [balanceSheet, setBalanceSheet] = useState([]);
  const [companyInfo, setCompanyInfo] = useState(null);
  const [locations, setLocations] = useState([]);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [openGroups, setOpenGroups] = useState(() => {
    try {
      const saved = localStorage.getItem('fa_sidebar_groups');
      return saved ? JSON.parse(saved) : ['Home', 'Master', 'Inventory Masters', 'Inventory Opening', 'Stock Movements', 'Stock Reports', 'Accounts Vouchers', 'Accounts Reports', 'Administration'];
    } catch {
      return ['Home', 'Master', 'Inventory Masters', 'Inventory Opening', 'Stock Movements', 'Stock Reports', 'Accounts Vouchers', 'Accounts Reports', 'Administration'];
    }
  });

  useEffect(() => {
    localStorage.setItem('fa_sidebar_groups', JSON.stringify(openGroups));
  }, [openGroups]);

  // HEAD OFFICE filter: for SUPER_ADMIN at HO, can choose a specific location or "ALL"
  const [viewLocationId, setViewLocationId] = useState(null); // null = all (HO only)

  // Date range for reports
  const today = new Date().toISOString().split('T')[0];
  const firstOfFY = currentUser ? currentUser.fiscal_year_start?.split('T')[0] : new Date(new Date().getFullYear(), 6, 1).toISOString().split('T')[0];
  const [fromDate, setFromDate] = useState(firstOfFY || today);
  const [toDate, setToDate] = useState(today);


  // Voucher form state
  const [voucherForm, setVoucherForm] = useState(null);
  const [refreshVouchers, setRefreshVouchers] = useState(0);
  const [notifCount, setNotifCount] = useState(0);
  const [showNotifModal, setShowNotifModal] = useState(false);
  const [transferPreload, setTransferPreload] = useState(null);

  const handleTransferFromRequest = (data) => {
    // Provide a unique ID so the child component knows it's a new preload
    setTransferPreload({ ...data, _timestamp: Date.now() });
    setActiveTab('Stock Transfer');
    setShowNotifModal(false);
  };


  const fetchNotifCount = async () => {
    if (!currentUser) return;
    try {
      const { data } = await axios.get('/api/inventory/pending-transfer-requests', {
        params: { location_id: currentUser.location_id }
      });
      const uniqueIds = new Set(data.map(r => r.id)).size;
      setNotifCount(uniqueIds);
    } catch (e) { console.error('Notif fetch error:', e); }
  };

  useEffect(() => {
    if (currentUser) {
      fetchNotifCount();
      const timer = setInterval(fetchNotifCount, 30000);
      return () => clearInterval(timer);
    }
  }, [currentUser?.location_id]);
  // const [accountModal, setAccountModal] = useState(null); // This line is removed as per user instruction

  // ── Auth handlers ─────────────────────────────────────────────────────────
  const handleLogin = (data) => {
    const user = data.user || data;
    sessionStorage.setItem('fa_user', JSON.stringify(user));
    if (data.token) sessionStorage.setItem('fa_token', data.token);

    setCurrentUser(user);
    setFromDate(user.fiscal_year_start?.split('T')[0] || today);
    setViewLocationId(user.is_head_office ? null : user.location_id);
  };

  const handleLogout = () => {
    sessionStorage.removeItem('fa_user');
    sessionStorage.removeItem('fa_active_tab');
    setCurrentUser(null);
    setActiveTab('Dashboard');
  };

  // ── Nav groups based on role (Defined early to support hooks) ──────────────
  const navGroups = [
    {
      label: 'Home',
      items: [
        { icon: <Activity size={18} />, label: 'Dashboard' },
      ]
    },
    {
      label: 'Master',
      items: [
        { icon: <PieChart size={18} />, label: 'Chart of Accounts' },
      ]
    },
    {
      label: 'Inventory Masters',
      items: [
        { icon: <Box size={18} />, label: 'Maker Master' },
        { icon: <Box size={18} />, label: 'Category Master' },
        { icon: <Box size={18} />, label: 'Power Master' },
        { icon: <Users size={18} />, label: 'Supplier Master' },
        { icon: <Users size={18} />, label: 'Customer Master' },
        { icon: <Barcode size={18} />, label: 'Barcode Setup' },
      ]
    },
    {
      label: 'Inventory Opening',
      items: [
        { icon: <BookOpen size={18} />, label: 'Stock Opening' },
      ]
    },
    {
      label: 'Stock Movements',
      items: [
        { icon: <ShoppingCart size={18} />, label: 'Stock Purchase' },
        { icon: <Repeat size={18} />, label: 'Purchase Return' },
        { icon: <Truck size={18} />, label: 'Transfer Request' },
        { icon: <Truck size={18} />, label: 'Stock Transfer' },
        { icon: <FileText size={18} />, label: 'Sales Invoice' },
        { icon: <RefreshCw size={18} />, label: 'Sales Return' },
      ]
    },
    {
      label: 'Stock Reports',
      items: [
        { icon: <FileText size={18} />, label: 'Stock Report' },
      ]
    },
    {
      label: 'Accounts Vouchers',
      items: [
        { icon: <ArrowDownCircle size={18} />, label: 'Receipts' },
        { icon: <ArrowUpCircle size={18} />, label: 'Payments' },
        { icon: <BookMarked size={18} />, label: 'Journal Vouchers' },
      ]
    },
    {
      label: 'Accounts Reports',
      items: [
        { icon: <TrendingUp size={18} />, label: 'Ledgers' },
        { icon: <BarChart3 size={18} />, label: 'Trial Balance' },
        { icon: <Activity size={18} />, label: 'Profit & Loss' },
        { icon: <Scale size={18} />, label: 'Balance Sheet' },
      ]
    },
    ...(currentUser?.role === 'SUPER_ADMIN' || currentUser?.role === 'ADMIN' ? [{
      label: 'Administration',
      items: [
        { icon: <Users size={18} />, label: 'User Management' },
        ...(currentUser?.role === 'SUPER_ADMIN' ? [{ icon: <Calendar size={18} />, label: 'Fiscal Years' }] : []),
        ...(currentUser?.role === 'SUPER_ADMIN' ? [{ icon: <Building2 size={18} />, label: 'Locations' }] : []),
      ]
    }] : [])
  ];

  const toggleGroup = (label) => {
    setOpenGroups(prev =>
      prev.includes(label) ? prev.filter(l => l !== label) : [...prev, label]
    );
  };

  // Auto-expand group containing active tab
  useEffect(() => {
    if (!currentUser) return;
    const parentGroup = navGroups.find(g => g.items.some(i => i.label === activeTab));
    if (parentGroup && !openGroups.includes(parentGroup.label)) {
      setOpenGroups(prev => [...prev, parentGroup.label]);
    }
  }, [activeTab, currentUser]);

  // ── Effective location for API calls ─────────────────────────────────────
  const effectiveLocationId = currentUser?.is_head_office
    ? viewLocationId  // null means ALL locations
    : currentUser?.location_id;

  // ── Fetchers ─────────────────────────────────────────────────────────────
  const fetchAccounts = async () => {
    if (!currentUser) return;
    setLoading(true);
    try {
      const params = {
        role: currentUser.role,
        location_id: currentUser.location_id,
        is_head_office: currentUser.is_head_office ? 'true' : 'false'
      };

      const [{ data: flat }, { data: tree }] = await Promise.all([
        axios.get(`${API}/accounts`, { params }),
        axios.get(`${API}/accounts?tree=1`, { params: { ...params, tree: 1 } })
      ]);
      setAccounts(flat);
      setTreeAccounts(tree);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
    setLoading(false);
  };

  const fetchReports = async () => {
    if (!currentUser) return;
    try {
      const params = {
        fromDate,
        toDate,
        fiscal_year_id: currentUser.fiscal_year_id,
        ...(effectiveLocationId ? { location_id: effectiveLocationId } : { all_locations: 'true' })
      };
      const [tb, pl, bs, sm] = await Promise.all([
        axios.get(`${API}/reports/trial-balance`, { params }),
        axios.get(`${API}/reports/profit-loss`, { params }),
        axios.get(`${API}/reports/balance-sheet`, { params }),
        axios.get(`${API}/reports/summary`, { params }),
      ]);
      setTrialBalance(tb.data);
      setProfitLoss(pl.data);
      setBalanceSheet(bs.data);
      setSummaryStats(sm.data || {});
    } catch (e) { console.error(e); }
  };

  const fetchCompanyInfo = async () => {
    try {
      const { data } = await axios.get(`${API}/company`);
      setCompanyInfo(data);
    } catch (e) { console.error('Error fetching company info:', e); }
  };

  const fetchLocations = async () => {
    try {
      const { data } = await axios.get(`${API}/locations`);
      setLocations(data);
    } catch (e) { console.error(e); }
  };

  useEffect(() => {
    if (currentUser) {
      fetchAccounts();
      fetchReports();
      fetchCompanyInfo();
      fetchLocations();
    }
  }, [currentUser]);

  const getReportMeta = () => {
    const loc = locations.find(l => l.id === effectiveLocationId);
    return {
      fromDate,
      toDate,
      fiscalYear: currentUser?.fiscal_year_label,
      location: effectiveLocationId ? (loc?.location_name || currentUser?.location_name) : 'All Locations'
    };
  };

  useEffect(() => {
    if (currentUser && ['Dashboard', 'Trial Balance', 'Profit & Loss', 'Balance Sheet'].includes(activeTab)) {
      fetchReports();
    }
  }, [activeTab, fromDate, toDate, viewLocationId]);

  const refetchAll = () => {
    fetchAccounts();
    fetchReports();
    setRefreshVouchers(prev => prev + 1);
  };

  const handleDeleteAccount = async (account) => {
    if (window.confirm(`Are you sure you want to delete account "${account.account_name}"?`)) {
      try {
        await axios.delete(`${API}/accounts/${account.id}`);
        refetchAll();
      } catch (e) {
        alert(e.response?.data?.error || 'Error deleting account');
      }
    }
  };

  // ── If not logged in, show login page ─────────────────────────────────────
  if (!currentUser) {
    return <LoginPage onLogin={handleLogin} />;
  }

  const isFYClosed = currentUser.fiscal_year_closed;

  // ── Sidebar summary ───────────────────────────────────────────────────────
  const getBalance = (type) => {
    const s = summaryStats.find(s => s.account_type === type);
    return s ? parseFloat(s.balance) : 0;
  };
  const fmt = n => `PKR ${Math.abs(n).toLocaleString('en-PK', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;

  const summaryCards = [
    { label: 'Capital', type: 'CAPITAL', color: '#0284c7', icon: <Wallet size={17} /> },
    { label: 'Assets', type: 'ASSET', color: '#10b981', icon: <Box size={17} /> },
    { label: 'Liabilities', type: 'LIABILITY', color: '#f59e0b', icon: <CreditCard size={17} /> },
    { label: 'Revenue', type: 'REVENUE', color: '#6366f1', icon: <TrendingUp size={17} /> },
    { label: 'Expenses', type: 'EXPENSE', color: '#ef4444', icon: <TrendingDown size={17} /> },
  ];


  const tabToVoucherType = {
    'Receipts': 'RECEIPT',
    'Payments': 'PAYMENT',
    'Journal Vouchers': 'JOURNAL',
  };


  const roleIcon = {
    SUPER_ADMIN: <ShieldCheck size={14} style={{ color: '#6366f1' }} />,
    ADMIN: <Shield size={14} style={{ color: '#0284c7' }} />,
    USER: <Users size={14} style={{ color: '#10b981' }} />,
  };

  return (
    <div className={`app-container ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`}>

      {/* ──────── Sidebar ──────── */}
      <aside className="sidebar">
        <div className="sidebar-header">
          <div className="logo-container"><TrendingUp color="#6d28d9" size={24} /></div>
          {!sidebarCollapsed && <div className="logo-text" style={{ fontSize: '1rem' }}>MACCANSOFT<br />Business Suite</div>}
        </div>

        <nav className="sidebar-nav">
          {navGroups.map((group, gi) => {
            const isOpen = openGroups.includes(group.label);
            return (
              <div key={gi} className="nav-group">
                <div className="nav-group-header" onClick={() => toggleGroup(group.label)}>
                  <div className="nav-label">
                    <div style={{ width: 4, height: 4, borderRadius: '50%', background: isOpen ? 'var(--primary)' : '#475569' }} />
                    {!sidebarCollapsed && <span>{group.label}</span>}
                  </div>
                  {!sidebarCollapsed && <ChevronDown size={14} className={`nav-group-chevron ${isOpen ? 'open' : ''}`} />}
                </div>

                <div className={`nav-group-items ${isOpen || sidebarCollapsed ? 'open' : ''}`}>
                  {group.items.map((item, i) => (
                    <button key={i} onClick={() => setActiveTab(item.label)}
                      className={`nav-item ${activeTab === item.label ? 'active' : ''}`}
                      title={sidebarCollapsed ? item.label : ''}>
                      <div className="nav-item-content">{item.icon}{!sidebarCollapsed && <span>{item.label}</span>}</div>
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </nav>

      </aside>

      {/* ──────── Main content ──────── */}
      <main className="main-content">
        <header className="top-navbar">
          <button className="nav-icon-btn" onClick={() => setSidebarCollapsed(!sidebarCollapsed)}>
            <Menu size={20} />
          </button>
          <div className="search-bar-container">
            <Search className="search-icon" size={18} />
            <input type="text" placeholder="Search accounts…" className="search-input"
              value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
          </div>

          {/* Session info bar */}
          <div className="session-info-bar">
            {/* Location filter (HEAD OFFICE SUPER_ADMIN only) */}
            {!!currentUser.is_head_office && (
              <div className="session-filter">
                <Filter size={13} />
                <select
                  value={viewLocationId || 'ALL'}
                  onChange={e => setViewLocationId(e.target.value === 'ALL' ? null : parseInt(e.target.value))}
                  className="session-select"
                >
                  <option value="ALL">All Locations</option>
                  {locations.filter(l => !l.is_head_office).map(l => (
                    <option key={l.id} value={l.id}>{l.name}</option>
                  ))}
                </select>
              </div>
            )}

            <div className="session-badge location-badge">
              <MapPin size={13} />
              <span>{currentUser.location_name}</span>
            </div>

            <div className={`session-badge fy-badge ${isFYClosed ? 'closed' : ''}`}>
              <Calendar size={13} />
              <span>{currentUser.fiscal_year_label}{isFYClosed ? ' 🔒' : ''}</span>
            </div>

            {notifCount > 0 && (
                <div className="notif-pulse" onClick={() => setShowNotifModal(true)} style={{ scale: '0.8', height: '28px', padding: '0 12px', fontSize: '0.75rem', transformOrigin: 'right' }}>
                    <Bell size={14} />
                    <span>{notifCount} New Request{notifCount > 1 ? 's' : ''}</span>
                </div>
            )}

            {/* User menu */}
            <div className="user-menu-wrapper" onClick={() => setShowUserMenu(!showUserMenu)}>
              <div className="user-avatar">{currentUser.username[0].toUpperCase()}</div>
              <div className="user-info-mini">
                <span className="user-name">{currentUser.full_name || currentUser.username}</span>
                <span className="user-role">{roleIcon[currentUser.role]} {currentUser.role.replace('_', ' ')}</span>
              </div>
              <ChevronDown size={14} style={{ color: '#64748b' }} />

              {showUserMenu && (
                <div className="user-dropdown" onClick={e => e.stopPropagation()}>
                  <div className="user-dropdown-header">
                    <div className="user-dropdown-avatar">{currentUser.username[0].toUpperCase()}</div>
                    <div>
                      <div style={{ fontWeight: 700 }}>{currentUser.full_name || currentUser.username}</div>
                      <div style={{ color: '#64748b', fontSize: '0.78rem' }}>{currentUser.username}</div>
                    </div>
                  </div>
                  <div className="user-dropdown-divider" />
                  <div className="user-dropdown-info">
                    <div><MapPin size={12} /> {currentUser.location_name}</div>
                    <div><Calendar size={12} /> FY: {currentUser.fiscal_year_label}</div>
                  </div>
                  <div className="user-dropdown-divider" />
                  <button className="user-dropdown-logout" onClick={handleLogout}>
                    <LogOut size={14} /> Sign Out
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Closed FY Banner */}
        {!!isFYClosed && (
          <div className="fy-closed-banner">
            🔒 <b>Fiscal Year {currentUser.fiscal_year_label} is CLOSED.</b> You can view data but cannot add, edit, or delete any transactions.
          </div>
        )}

        <div className="page-container">
          <div className="page-header">
            <div className="header-title-section">
              <div className="header-icon">
                {activeTab === 'Dashboard' && <Activity size={24} />}
                {activeTab === 'Chart of Accounts' && <PieChart size={24} />}
                {activeTab === 'Receipts' && <ArrowDownCircle size={24} />}
                {activeTab === 'Payments' && <ArrowUpCircle size={24} />}
                {activeTab === 'Journal Vouchers' && <BookMarked size={24} />}
                {activeTab === 'Ledgers' && <TrendingUp size={24} />}
                {activeTab === 'Trial Balance' && <BarChart3 size={24} />}
                {activeTab === 'Profit & Loss' && <Activity size={24} />}
                {activeTab === 'Balance Sheet' && <Scale size={24} />}
                {activeTab === 'User Management' && <Users size={24} />}
                {activeTab === 'Fiscal Years' && <Calendar size={24} />}
                {activeTab === 'Locations' && <Building2 size={24} />}
                {activeTab === 'Maker Master' && <Box size={24} />}
                {activeTab === 'Category Master' && <Box size={24} />}
                {activeTab === 'Power Master' && <Box size={24} />}
                {activeTab === 'Supplier Master' && <Users size={24} />}
                {activeTab === 'Customer Master' && <Users size={24} />}
                {activeTab === 'Stock Opening' && <BookOpen size={24} />}
                {activeTab === 'Stock Transactions' && <ShoppingCart size={24} />}
                {activeTab === 'Transfer Request' && <Truck size={24} />}
                {activeTab === 'Stock Report' && <FileText size={24} />}
                {activeTab === 'Barcode Setup' && <Barcode size={24} />}
              </div>
              <div className="header-text">
                <h1>{activeTab}</h1>
                <p>
                  {activeTab === 'Dashboard' ? 'Real-time Financial Overview' :
                    activeTab === 'Chart of Accounts' ? 'Hierarchical Account Structure' :
                      activeTab === 'Receipts' ? 'All Money Received — Cash, Cheque, Online' :
                        activeTab === 'Payments' ? 'All Money Paid Out — Cash, Cheque, Online' :
                          activeTab === 'Journal Vouchers' ? 'General Journal Entries' :
                            activeTab === 'Profit & Loss' ? 'Revenue vs Expense Analysis' :
                              activeTab === 'Balance Sheet' ? 'Assets = Liabilities + Capital' :
                                activeTab === 'User Management' ? 'Manage Users & Permissions' :
                                  activeTab === 'Fiscal Years' ? 'Fiscal Year Control & Year-End Closing' :
                                    activeTab === 'Locations' ? 'Branch & Office Locations' :
                                      activeTab === 'Transfer Request' ? 'Request stock transfers between locations' :
                                        'Financial Reports'}
                </p>
              </div>
            </div>

            {activeTab === 'Chart of Accounts' && (
              <div className="header-actions">
                <button className="btn-secondary" onClick={() => {
                  const data = accounts.map(a => ({
                    code: a.account_code,
                    name: a.account_name,
                    type: a.account_type,
                    status: a.is_active ? 'Active' : 'Inactive'
                  }));
                  printTable('Chart of Accounts Report', ['Code', 'Account Name', 'Type', 'Status'], data, ['code', 'name', 'type', 'status'], companyInfo, {
                    location: effectiveLocationId ? (locations.find(l => l.id === effectiveLocationId)?.location_name || currentUser?.location_name) : 'All Locations',
                    fiscalYear: currentUser?.fiscal_year_label
                  });
                }}>
                  <Printer size={16} /> Print
                </button>
                <button className="btn-secondary" onClick={() => setExportModal(true)}>
                  <FileText size={16} /> Export
                </button>
                {!isFYClosed && (
                  <button className="btn-primary" onClick={() => setAccountModal(true)}>
                    <Plus size={17} /> Add Account
                  </button>
                )}
              </div>
            )}

            {['Receipts', 'Payments', 'Journal Vouchers', 'Ledgers', 'Trial Balance', 'Profit & Loss', 'Balance Sheet', 'Stock Purchase', 'Purchase Return', 'Transfer Request', 'Stock Transfer', 'Sales Invoice', 'Sales Return'].includes(activeTab) && (
              <div className="report-date-filter animate-fade-in">
                <div className="filter-group">
                  <label>From Date</label>
                  <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} />
                </div>
                <div className="filter-group">
                  <label>To Date</label>
                  <input type="date" value={toDate} onChange={e => setToDate(e.target.value)} />
                </div>
                <button className="btn-secondary" onClick={refetchAll} title="Refresh">
                  <Activity size={16} />
                </button>
              </div>
            )}
          </div>

          {/* ── Barcode Setup ── */}
          {activeTab === 'Barcode Setup' && (
            <BarcodeSetup isFYClosed={isFYClosed} />
          )}

          {/* ── Dashboard ── */}
          {activeTab === 'Dashboard' && (
            <Dashboard
              summaryStats={summaryStats}
              currentUser={currentUser}
              onNavigate={setActiveTab}
              notifCount={notifCount}
              onShowNotifs={() => setShowNotifModal(true)}
            />
          )}

          {/* ── Chart of Accounts ── */}
          {activeTab === 'Chart of Accounts' && (
            <div className="animate-fade-in">
              <div className="stats-container" style={{ marginBottom: 20 }}>
                <div className="stat-card">
                  <div className="stat-icon" style={{ background: '#ebf5ff', color: '#0284c7' }}><PieChart size={20} /></div>
                  <div className="stat-info"><span>Total Accounts</span><h3>{accounts.length}</h3></div>
                </div>
              </div>
              {loading
                ? <div style={{ padding: 60, textAlign: 'center', color: '#94a3b8' }}>Loading…</div>
                : <AccountTree
                  accounts={searchQuery
                    ? accounts.filter(a =>
                      a.account_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                      a.account_code.toLowerCase().includes(searchQuery.toLowerCase()))
                    : treeAccounts
                  }
                  onEdit={(acc) => {
                    if (!isFYClosed) {
                      setEditingAccount(acc);
                      setAccountModal(true);
                    }
                  }}
                  onDelete={isFYClosed ? null : handleDeleteAccount}
                  onAdd={(parent) => {
                    if (!isFYClosed) {
                      setEditingAccount({ _parent: parent });
                      setAccountModal(true);
                    }
                  }}
                />
              }
            </div>
          )}

          {/* ── Receipts / Payments / Journal Vouchers ── */}
          {(activeTab === 'Receipts' || activeTab === 'Payments' || activeTab === 'Journal Vouchers') && (
            <VoucherList
              key={`${activeTab}-${refreshVouchers}-${viewLocationId || 'ALL'}`}
              voucherType={tabToVoucherType[activeTab]}
              companyInfo={companyInfo}
              fromDate={fromDate}
              toDate={toDate}
              locationId={effectiveLocationId}
              fiscalYearId={currentUser.fiscal_year_id}
              isHeadOffice={currentUser.is_head_office}
              isFYClosed={isFYClosed}
              onNewVoucher={() => !isFYClosed && setVoucherForm({ type: tabToVoucherType[activeTab] })}
              onEditVoucher={(v) => !isFYClosed && setVoucherForm({ type: tabToVoucherType[activeTab], editData: v })}
              reportMeta={getReportMeta()}
            />
          )}

          {/* ── Ledgers ── */}
          {activeTab === 'Ledgers' && (
            <LedgerView
              accounts={accounts}
              fromDate={fromDate}
              toDate={toDate}
              locationId={effectiveLocationId}
              fiscalYearId={currentUser.fiscal_year_id}
              companyInfo={companyInfo}
              reportMeta={getReportMeta()}
            />
          )}

          {/* ── Trial Balance ── */}
          {activeTab === 'Trial Balance' && (
            <div className="ledger-report-card animate-fade-in">
              <div className="report-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h2 style={{ fontSize: '1.5rem', fontWeight: 800 }}>Trial Balance</h2>
                  <p>Period: {new Date(fromDate).toLocaleDateString()} to {new Date(toDate).toLocaleDateString()}</p>
                </div>
                <div style={{ display: 'flex', gap: 10 }}>
                  <button className="btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: 6 }}
                    onClick={() => {
                      const data = trialBalance.map(r => ({
                        code: r.account_code,
                        name: r.account_name,
                        type: r.account_type,
                        dr: r.total_debit || 0,
                        cr: r.total_credit || 0
                      }));
                      printTable('Trial Balance Report', ['Code', 'Account Name', 'Type', 'Debit', 'Credit'], data, ['code', 'name', 'type', 'dr', 'cr'], companyInfo, getReportMeta());
                    }}>
                    <Printer size={16} /> Print
                  </button>
                  <button className="btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: 6 }}
                    onClick={() => setExportModal(true)}>
                    <FileText size={16} /> Export
                  </button>
                </div>
              </div>
              <table className="ledger-table">
                <thead>
                  <tr>
                    <th>Account Code</th><th>Account Name</th><th>Type</th>
                    <th className="text-right">Debit</th><th className="text-right">Credit</th>
                  </tr>
                </thead>
                <tbody>
                  {trialBalance.length === 0
                    ? <tr><td colSpan="5" style={{ textAlign: 'center', padding: 40, color: '#94a3b8' }}>No transactions yet.</td></tr>
                    : trialBalance.map((r, i) => (
                      <tr key={i}>
                        <td>{r.account_code}</td>
                        <td>{r.account_name}</td>
                        <td><span className="badge-type">{r.account_type}</span></td>
                        <td className="text-right">{parseFloat(r.total_debit || 0).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}</td>
                        <td className="text-right">{parseFloat(r.total_credit || 0).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}</td>
                      </tr>
                    ))
                  }
                  {trialBalance.length > 0 && (
                    <tr style={{ fontWeight: 800, background: '#f8fafc' }}>
                      <td colSpan="3">TOTAL</td>
                      <td className="text-right">{trialBalance.reduce((s, r) => s + parseFloat(r.total_debit || 0), 0).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}</td>
                      <td className="text-right">{trialBalance.reduce((s, r) => s + parseFloat(r.total_credit || 0), 0).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* ── Profit & Loss ── */}
          {activeTab === 'Profit & Loss' && (
            <div className="ledger-report-card animate-fade-in">
              <div className="report-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h2 style={{ fontSize: '1.5rem', fontWeight: 800 }}>Profit &amp; Loss Statement</h2>
                  <p>Period: {new Date(fromDate).toLocaleDateString()} to {new Date(toDate).toLocaleDateString()}</p>
                </div>
                <div style={{ display: 'flex', gap: 10 }}>
                  <button className="btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: 6 }}
                    onClick={() => {
                      const data = (profitLoss.rows || []).map(r => ({
                        code: r.account_code,
                        name: r.account_name,
                        type: r.account_type,
                        bal: r.balance
                      }));
                      printTable('Profit & Loss Statement Report', ['Code', 'Account Name', 'Type', 'Balance'], data, ['code', 'name', 'type', 'bal'], companyInfo, getReportMeta());
                    }}>
                    <Printer size={16} /> Print
                  </button>
                  <button className="btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: 6 }}
                    onClick={() => setExportModal(true)}>
                    <FileText size={16} /> Export
                  </button>
                </div>
              </div>
              <table className="ledger-table">
                <thead>
                  <tr><th>Code</th><th>Account Name</th><th>Type</th><th className="text-right">Balance</th></tr>
                </thead>
                <tbody>
                  {profitLoss.rows?.length === 0
                    ? <tr><td colSpan="4" style={{ textAlign: 'center', padding: 40, color: '#94a3b8' }}>No P&amp;L entries yet.</td></tr>
                    : profitLoss.rows?.map((r, i) => (
                      <tr key={i}>
                        <td>{r.account_code}</td>
                        <td>{r.account_name}</td>
                        <td><span className="badge-type">{r.account_type}</span></td>
                        <td className="text-right" style={{ color: parseFloat(r.balance) >= 0 ? '#10b981' : '#ef4444', fontWeight: 700 }}>
                          {parseFloat(r.balance).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                        </td>
                      </tr>
                    ))
                  }
                </tbody>
                {profitLoss.rows?.length > 0 && (
                  <tfoot>
                    <tr style={{ fontWeight: 800, fontSize: '1rem' }}>
                      <td colSpan="3">NET PROFIT / (LOSS)</td>
                      <td className="text-right" style={{ color: parseFloat(profitLoss.net_profit) >= 0 ? '#10b981' : '#ef4444', fontSize: '1.1rem' }}>
                        {parseFloat(profitLoss.net_profit || 0).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                      </td>

                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          )}

          {/* ── Balance Sheet ── */}
          {activeTab === 'Balance Sheet' && (
            <div className="ledger-report-card animate-fade-in">
              <div className="report-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h2 style={{ fontSize: '1.5rem', fontWeight: 800 }}>Balance Sheet</h2>
                  <p>As of {new Date(toDate).toLocaleDateString()}</p>
                </div>
                <div style={{ display: 'flex', gap: 10 }}>
                  <button className="btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: 6 }}
                    onClick={() => {
                      const data = (balanceSheet || []).map(r => ({
                        code: r.account_code,
                        name: r.account_name,
                        type: r.account_type,
                        bal: r.balance
                      }));
                      printTable('Balance Sheet Report', ['Code', 'Account Name', 'Type', 'Balance'], data, ['code', 'name', 'type', 'bal'], companyInfo, { ...getReportMeta(), fromDate: null });
                    }}>
                    <Printer size={16} /> Print
                  </button>
                  <button className="btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: 6 }}
                    onClick={() => setExportModal(true)}>
                    <FileText size={16} /> Export
                  </button>
                </div>
              </div>
              <table className="ledger-table">
                <thead>
                  <tr><th>Code</th><th>Account Name</th><th>Type</th><th className="text-right">Balance</th></tr>
                </thead>
                <tbody>
                  {balanceSheet.length === 0
                    ? <tr><td colSpan="4" style={{ textAlign: 'center', padding: 40, color: '#94a3b8' }}>No entries yet.</td></tr>
                    : ['ASSET', 'LIABILITY', 'CAPITAL'].map(type => {
                      const section = balanceSheet.filter(r => r.account_type === type);
                      if (!section.length) return null;
                      return (
                        <React.Fragment key={type}>
                          <tr style={{ background: '#f1f5f9' }}>
                            <td colSpan="4" style={{ fontWeight: 700, color: '#475569', padding: '10px 16px' }}>
                              {type === 'ASSET' ? 'ASSETS' : type === 'LIABILITY' ? 'LIABILITIES' : 'CAPITAL'}
                            </td>
                          </tr>
                          {section.map((r, i) => (
                            <tr key={i}>
                              <td style={{ paddingLeft: 32 }}>{r.account_code}</td>
                              <td>{r.account_name}</td>
                              <td><span className="badge-type">{r.account_type}</span></td>
                              <td className="text-right" style={{ fontWeight: 600 }}>{parseFloat(r.balance).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}</td>
                            </tr>
                          ))}
                          <tr style={{ fontWeight: 700, background: '#f8fafc' }}>
                            <td colSpan="3">Total {type === 'ASSET' ? 'Assets' : type === 'LIABILITY' ? 'Liabilities' : 'Capital'}</td>
                            <td className="text-right">{section.reduce((s, r) => s + parseFloat(r.balance || 0), 0).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}</td>

                          </tr>
                        </React.Fragment>
                      );
                    })
                  }
                </tbody>
              </table>
            </div>
          )}

          {/* ── User Management ── */}
          {activeTab === 'User Management' && (currentUser.role === 'SUPER_ADMIN' || currentUser.role === 'ADMIN') && (
            <UserManagement currentUser={currentUser} locations={locations} />
          )}

          {/* ── Fiscal Years ── */}
          {activeTab === 'Fiscal Years' && currentUser.role === 'SUPER_ADMIN' && (
            <FiscalYearManager currentUser={currentUser} onFiscalYearClosed={() => {
              // Update session with closed status
              const updated = { ...currentUser, fiscal_year_closed: true };
              sessionStorage.setItem('fa_user', JSON.stringify(updated));
              setCurrentUser(updated);
            }} />
          )}

          {/* ── Locations ── */}
          {activeTab === 'Locations' && currentUser.role === 'SUPER_ADMIN' && (
            <LocationsManager locations={locations} onRefresh={fetchLocations} />
          )}

          {/* ── Inventory Masters ── */}
          {activeTab === 'Maker Master' && <MakerMaster />}
          {activeTab === 'Category Master' && <CategoryMaster />}
          {activeTab === 'Power Master' && <PowerMaster />}
          {activeTab === 'Supplier Master' && (
            <SupplierMaster
              currentUser={currentUser}
              locations={locations}
              companyInfo={companyInfo}
              reportMeta={getReportMeta()}
            />
          )}
          {activeTab === 'Customer Master' && (
            <CustomerMaster
              currentUser={currentUser}
              locations={locations}
              companyInfo={companyInfo}
              reportMeta={getReportMeta()}
            />
          )}

          {/* ── Inventory Ops ── */}
          {activeTab === 'Stock Opening' && <InventoryTransactions initialType="STOCK_OPENING" currentUser={currentUser} isFYClosed={isFYClosed} companyInfo={companyInfo} reportMeta={getReportMeta()} />}
          {activeTab === 'Stock Purchase' && <InventoryTransactions initialType="PURCHASE" currentUser={currentUser} isFYClosed={isFYClosed} companyInfo={companyInfo} reportMeta={getReportMeta()} fromDate={fromDate} toDate={toDate} isSuperAdmin={currentUser.role === 'SUPER_ADMIN'} locations={locations} viewLocationId={viewLocationId} />}
          {activeTab === 'Purchase Return' && <InventoryTransactions initialType="PURCHASE_RETURN" currentUser={currentUser} isFYClosed={isFYClosed} companyInfo={companyInfo} reportMeta={getReportMeta()} fromDate={fromDate} toDate={toDate} isSuperAdmin={currentUser.role === 'SUPER_ADMIN'} locations={locations} viewLocationId={viewLocationId} />}
          {activeTab === 'Transfer Request' && <InventoryTransactions initialType="TRANSFER_REQUEST" currentUser={currentUser} isFYClosed={isFYClosed} companyInfo={companyInfo} reportMeta={getReportMeta()} fromDate={fromDate} toDate={toDate} isSuperAdmin={currentUser.role === 'SUPER_ADMIN'} locations={locations} viewLocationId={viewLocationId} />}
          {activeTab === 'Stock Transfer' && <InventoryTransactions initialType="TRANSFER" currentUser={currentUser} isFYClosed={isFYClosed} companyInfo={companyInfo} reportMeta={getReportMeta()} fromDate={fromDate} toDate={toDate} isSuperAdmin={currentUser.role === 'SUPER_ADMIN'} locations={locations} viewLocationId={viewLocationId} preloadData={transferPreload} onClearPreload={() => setTransferPreload(null)} />}
          {activeTab === 'Sales Invoice' && <InventoryTransactions initialType="SALES_INVOICE" currentUser={currentUser} isFYClosed={isFYClosed} companyInfo={companyInfo} reportMeta={getReportMeta()} fromDate={fromDate} toDate={toDate} isSuperAdmin={currentUser.role === 'SUPER_ADMIN'} locations={locations} viewLocationId={viewLocationId} />}
          {activeTab === 'Sales Return' && <InventoryTransactions initialType="SALES_RETURN" currentUser={currentUser} isFYClosed={isFYClosed} companyInfo={companyInfo} reportMeta={getReportMeta()} fromDate={fromDate} toDate={toDate} isSuperAdmin={currentUser.role === 'SUPER_ADMIN'} locations={locations} viewLocationId={viewLocationId} />}
          {activeTab === 'Stock Transactions' && <InventoryTransactions initialType="ALL" currentUser={currentUser} isFYClosed={isFYClosed} companyInfo={companyInfo} reportMeta={getReportMeta()} fromDate={fromDate} toDate={toDate} isSuperAdmin={currentUser.role === 'SUPER_ADMIN'} locations={locations} viewLocationId={viewLocationId} />}
          {activeTab === 'Stock Report' && <StockReport currentUser={currentUser} companyInfo={companyInfo} reportMeta={getReportMeta()} />}
        </div>
      </main>

      {/* ── Voucher Form modal ── */}
      {voucherForm && !isFYClosed && (
        <VoucherForm
          type={voucherForm.type}
          editData={voucherForm.editData || null}
          accounts={accounts}
          locationId={currentUser.location_id}
          fiscalYearId={currentUser.fiscal_year_id}
          onClose={() => setVoucherForm(null)}
          onSave={() => { refetchAll(); setVoucherForm(null); }}
        />
      )}

      {/* ── Account Modal ── */}
      {accountModal && (
        <AccountModal
          account={editingAccount}
          onClose={() => setAccountModal(false)}
          onSuccess={() => { setAccountModal(false); fetchAccounts(); }}
          currentUser={currentUser}
          accounts={accounts}
        />
      )}

      <PendingTransfersModal 
          isOpen={showNotifModal} 
          onClose={() => setShowNotifModal(false)}
          currentUser={currentUser}
          onAcknowledge={fetchNotifCount}
          onTransferClick={handleTransferFromRequest}
      />

      <ExportModal
        isOpen={exportModal}
        onClose={() => setExportModal(false)}
        title="Chart of Accounts"
        onSelect={(format) => {
          let data = [];
          let headers = [];
          let fields = [];
          let filename = 'Report';
          let title = activeTab;

          if (activeTab === 'Chart of Accounts') {
            data = accounts.map(a => ({ code: a.account_code, name: a.account_name, type: a.account_type, status: a.is_active ? 'Active' : 'Inactive' }));
            headers = ['Code', 'Account Name', 'Type', 'Status'];
            fields = ['code', 'name', 'type', 'status'];
            filename = 'Chart_of_Accounts';
            title = 'Chart of Accounts Report';
          } else if (activeTab === 'Trial Balance') {
            data = trialBalance.map(r => ({ code: r.account_code, name: r.account_name, type: r.account_type, dr: r.total_debit || 0, cr: r.total_credit || 0 }));
            headers = ['Code', 'Account Name', 'Type', 'Debit', 'Credit'];
            fields = ['code', 'name', 'type', 'dr', 'cr'];
            filename = 'Trial_Balance';
            title = 'Trial Balance Report';
          } else if (activeTab === 'Profit & Loss') {
            data = (profitLoss.rows || []).map(r => ({ code: r.account_code, name: r.account_name, type: r.account_type, bal: r.balance }));
            headers = ['Code', 'Account Name', 'Type', 'Balance'];
            fields = ['code', 'name', 'type', 'bal'];
            filename = 'Profit_and_Loss';
            title = 'Profit & Loss Statement Report';
          } else if (activeTab === 'Balance Sheet') {
            data = (balanceSheet || []).map(r => ({ code: r.account_code, name: r.account_name, type: r.account_type, bal: r.balance }));
            headers = ['Code', 'Account Name', 'Type', 'Balance'];
            fields = ['code', 'name', 'type', 'bal'];
            filename = 'Balance_Sheet';
            title = 'Balance Sheet Report';
          }

          if (format === 'EXCEL') {
            exportToCSV(filename, headers, data, fields);
          } else {
            const meta = activeTab === 'Chart of Accounts' ? {
              location: effectiveLocationId ? (locations.find(l => l.id === effectiveLocationId)?.location_name || currentUser?.location_name) : 'All Locations',
              fiscalYear: currentUser?.fiscal_year_label
            } : (activeTab === 'Balance Sheet' ? { ...getReportMeta(), fromDate: null } : getReportMeta());
            printTable(title, headers, data, fields, companyInfo, meta);
          }
          setExportModal(false);
        }}
      />
    </div>
  );
};

// ── Inline Locations Manager ───────────────────────────────────────────────
const LocationsManager = ({ locations, onRefresh }) => {
  const [showForm, setShowForm] = useState(false);
  const [editingLoc, setEditingLoc] = useState(null);
  const [form, setForm] = useState({ code: '', name: '', is_active: true });
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');

  const handleNameChange = (e) => {
    const name = e.target.value.toUpperCase();
    let code = form.code;
    // Auto-generate code ONLY when adding a new location and code hasn't been manually touched or is empty
    if (!editingLoc) {
      code = name.trim().substring(0, 3).toUpperCase();
    }
    setForm({ ...form, name, code });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErr(''); setMsg('');
    try {
      if (editingLoc) {
        await axios.put(`${API}/locations/${editingLoc.id}`, form);
        setMsg('Location updated successfully');
      } else {
        await axios.post(`${API}/locations`, form);
        setMsg('Location added successfully');
      }
      setShowForm(false);
      setEditingLoc(null);
      setForm({ code: '', name: '', is_active: true });
      onRefresh();
    } catch (ex) {
      setErr(ex.response?.data?.error || 'Error saving location');
    }
  };

  const handleEdit = (loc) => {
    setEditingLoc(loc);
    setForm({ code: loc.code, name: loc.name, is_active: !!loc.is_active });
    setShowForm(true);
  };

  const handleDelete = async (loc) => {
    if (!window.confirm(`Delete location "${loc.name}"?`)) return;
    try {
      await axios.delete(`${API}/locations/${loc.id}`);
      onRefresh();
    } catch (ex) {
      alert(ex.response?.data?.error || 'Error');
    }
  };

  return (
    <div className="um-container animate-fade-in">
      <div className="um-header">
        <div className="um-header-left">
          <Building2 size={22} />
          <div><h2>Locations / Branches</h2><p>{locations.length} location(s) configured</p></div>
        </div>
        <button className="btn-primary" onClick={() => { setEditingLoc(null); setForm({ code: '', name: '', is_active: true }); setShowForm(true); }}><Plus size={16} /> Add Location</button>
      </div>
      {msg && <div className="um-success-msg">✅ {msg}</div>}
      <div className="um-table-card">
        <table className="ledger-table">
          <thead><tr><th>Code</th><th>Name</th><th>Type</th><th>Status</th><th>Actions</th></tr></thead>
          <tbody>
            {locations.map(loc => (
              <tr key={loc.id}>
                <td><code style={{ background: '#f1f5f9', padding: '2px 8px', borderRadius: 6 }}>{loc.code}</code></td>
                <td style={{ fontWeight: 600 }}>{loc.name}</td>
                <td>{loc.is_head_office ? <span style={{ color: '#6366f1', fontWeight: 700 }}>🏢 Head Office</span> : 'Branch'}</td>
                <td><span style={{ color: loc.is_active ? '#10b981' : '#ef4444' }}>● {loc.is_active ? 'Active' : 'Inactive'}</span></td>
                <td>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button className="btn-icon-sm" onClick={() => handleEdit(loc)} title="Edit Location">
                      <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                        <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
                      </svg>
                    </button>
                    {!loc.is_head_office && (
                      <button className="btn-icon-sm delete" onClick={() => handleDelete(loc)} title="Delete Location"><Trash2Icon size={14} /></button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {showForm && (
        <div className="modal-backdrop" onClick={() => { setShowForm(false); setEditingLoc(null); }}>
          <div className="modal-box" style={{ maxWidth: 420 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{editingLoc ? 'Edit Location' : 'Add Location'}</h3>
              <button className="modal-close" onClick={() => { setShowForm(false); setEditingLoc(null); }}>✕</button>
            </div>
            {err && <div className="um-error-msg">⚠️ {err}</div>}
            <form onSubmit={handleSubmit} style={{ padding: '16px 24px' }}>
              <div className="form-field" style={{ marginBottom: 16 }}>
                <label>Location Name</label>
                <input value={form.name} onChange={handleNameChange} placeholder="e.g. MULTAN" required />
              </div>
              <div className="form-field" style={{ marginBottom: 16 }}>
                <label>Location Code {editingLoc ? '' : '(Auto-generated)'}</label>
                <input
                  value={form.code}
                  onChange={e => setForm({ ...form, code: e.target.value.toUpperCase() })}
                  placeholder="e.g. MUL"
                  required
                  maxLength={10}
                  readOnly={!editingLoc}
                  style={!editingLoc ? { background: '#f8fafc', cursor: 'not-allowed' } : {}}
                />
              </div>
              {editingLoc && (
                <div className="form-field" style={{ marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <input
                    type="checkbox"
                    id="is_active"
                    checked={form.is_active}
                    onChange={e => setForm({ ...form, is_active: e.target.checked })}
                    style={{ width: 'auto', margin: 0 }}
                  />
                  <label htmlFor="is_active" style={{ marginBottom: 0 }}>Active</label>
                </div>
              )}
              <div className="modal-footer">
                <button type="button" className="btn-secondary" onClick={() => { setShowForm(false); setEditingLoc(null); }}>Cancel</button>
                <button type="submit" className="btn-primary">
                  {editingLoc ? (
                    <><Activity size={15} /> Update</>
                  ) : (
                    <><Plus size={15} /> Add</>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

// Avoid import error
const Trash2Icon = ({ size }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
  </svg>
);

export default App;
