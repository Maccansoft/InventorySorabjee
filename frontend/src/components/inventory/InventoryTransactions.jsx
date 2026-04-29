import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { ShoppingCart, Repeat, Truck, FileText, RefreshCw, Plus, Search, MapPin, Trash2, Printer, Filter, CheckSquare, Square } from 'lucide-react';
import SearchableSelect from '../common/SearchableSelect';
import { printTable, exportToCSV } from '../../utils/exportUtils';
import { formatAmount, formatQty } from '../../utils/numberUtils';
import ExportModal from '../common/ExportModal';
import StockTransactionForm from './StockTransactionForm';
import SalesInvoicePrint from './SalesInvoicePrint';

const API = '/api/inventory';

/* ── Maps each type to its dedicated GET endpoint ── */
const TYPE_ENDPOINT = {
    PURCHASE: 'purchases',
    PURCHASE_RETURN: 'purchase-returns',
    TRANSFER: 'transfers',
    SALES_INVOICE: 'sales',
    SALES_RETURN: 'sales-returns',
    TRANSFER_REQUEST: 'transfer-requests',
    STOCK_OPENING: 'opening-balances',
};


const transactionTypes = [
    { label: 'Stock Purchase', type: 'PURCHASE', endpoint: 'purchases', icon: <ShoppingCart size={24} />, color: 'bg-blue-light' },
    { label: 'Purchase Return', type: 'PURCHASE_RETURN', endpoint: 'purchase-returns', icon: <Repeat size={24} />, color: 'bg-orange-light' },
    { label: 'Transfer Request', type: 'TRANSFER_REQUEST', endpoint: 'transfer-requests', icon: <Truck size={24} />, color: 'bg-indigo-light' },
    { label: 'Stock Transfer', type: 'TRANSFER', endpoint: 'transfers', icon: <Truck size={24} />, color: 'bg-purple-light' },
    { label: 'Sales Invoice', type: 'SALES_INVOICE', endpoint: 'sales', icon: <FileText size={24} />, color: 'bg-green-light' },
    { label: 'Sales Return', type: 'SALES_RETURN', endpoint: 'sales-returns', icon: <RefreshCw size={24} />, color: 'bg-red-light' },
    { label: 'Stock Opening', type: 'STOCK_OPENING', endpoint: 'opening-balances', icon: <FileText size={24} />, color: 'bg-slate-light' },
];


const InventoryTransactions = ({
    currentUser, initialType = 'ALL', isFYClosed = false,
    companyInfo, reportMeta, fromDate, toDate,
    isSuperAdmin = false, locations = [], viewLocationId = null,
    preloadData, onClearPreload
}) => {
    const [activeForm, setActiveForm] = useState(null);
    const [transactions, setTransactions] = useState([]);
    const [loading, setLoading] = useState(false);
    const [search, setSearch] = useState('');
    const [activeFilter, setActiveFilter] = useState(initialType);
    const [exportModal, setExportModal] = useState(false);
    const [showPrint, setShowPrint] = useState(null); // stores invoice ID
    const [filterLocationId, setFilterLocationId] = useState(viewLocationId);
    
    const isTransfer = activeFilter === 'TRANSFER';
    const isTrq = activeFilter === 'TRANSFER_REQUEST';
    const isSalesReturn = activeFilter === 'SALES_RETURN';
    
    // Selection state
    const [selectedRows, setSelectedRows] = useState([]); // Array of unique strings "TYPE-ID-DETAILID"
    const [isBulkDeleting, setIsBulkDeleting] = useState(false);

    // Sync with App-level location filter when it changes
    useEffect(() => { setFilterLocationId(viewLocationId); }, [viewLocationId]);

    const currentTypeInfo = transactionTypes.find(t => t.type === activeFilter);
    const months = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];

    const formatDate = (dateStr) => {
        if (!dateStr) return 'N/A';
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return dateStr;
        return `${String(d.getDate()).padStart(2, '0')}-${months[d.getMonth()]}-${d.getFullYear()}`;
    };

    /* ── Fetch rows from the correct table based on activeFilter ── */
    const fetchTransactions = async () => {
        setLoading(true);
        try {
            // For superadmin: no location filter means ALL locations;
            // for normal users: always filter by their assigned location
            const effectiveLoc = isSuperAdmin ? filterLocationId : currentUser.location_id;
            const params = {
                fiscal_year_id: currentUser.fiscal_year_id,
                fromDate,
                toDate,
                ...(effectiveLoc ? { location_id: effectiveLoc } : {})
            };

            if (activeFilter === 'ALL') {
                // Fetch from all tables in parallel and merge
                const results = await Promise.all(
                    transactionTypes.map(t =>
                        axios.get(`${API}/${t.endpoint}`, { params })
                            .then(({ data }) => data.map(r => ({ ...r, _type: t.type, _typeLabel: t.label })))
                            .catch(() => [])
                    )
                );
                const merged = results.flat().sort((a, b) => b.id - a.id);
                setTransactions(merged);
            } else {
                const endpoint = TYPE_ENDPOINT[activeFilter];
                const { data } = await axios.get(`${API}/${endpoint}`, { params });
                setTransactions(data.map(r => ({ ...r, _type: activeFilter, _typeLabel: currentTypeInfo?.label })));
            }
        } catch (e) { console.error(e); }
        setLoading(false);
    };

    useEffect(() => { setActiveFilter(initialType); }, [initialType]);
    useEffect(() => { fetchTransactions(); }, [filterLocationId, activeFilter, fromDate, toDate]);

    useEffect(() => {
        if (preloadData && preloadData._timestamp) {
            setActiveForm('TRANSFER');
        }
    }, [preloadData]);

    const filtered = transactions.filter(t => {
        const q = search.toLowerCase();
        return (
            (t.trans_no || '').toLowerCase().includes(q) ||
            (t.supplier_name || '').toLowerCase().includes(q) ||
            (t.customer_name || '').toLowerCase().includes(q) ||
            (t.lot_no || '').toLowerCase().includes(q) ||
            (t.maker_name || '').toLowerCase().includes(q) ||
            (t.category_name || '').toLowerCase().includes(q)
        );
    });

    const deleteTransaction = async (type, id) => {
        if (!window.confirm('Are you sure you want to delete this transaction and all its item records?')) return;
        try {
            const endpoint = TYPE_ENDPOINT[type];
            await axios.delete(`${API}/${endpoint}/${id}`);
            fetchTransactions();
            setSelectedRows([]);
        } catch (e) { alert('Error deleting transaction: ' + (e.response?.data?.error || e.message)); }
    };

    const deleteDetailRecord = async (type, detailId) => {
        if (type === 'STOCK_OPENING') return deleteTransaction(type, detailId);
        if (!window.confirm('Are you sure you want to delete this specific item record? This will automatically update the transaction total.')) return;
        try {
            const endpoint = TYPE_ENDPOINT[type];
            await axios.delete(`${API}/${endpoint}/details/${detailId}`);
            fetchTransactions();
            setSelectedRows([]);
        } catch (e) { alert('Error deleting record: ' + (e.response?.data?.error || e.message)); }
    };

    const handleBulkDelete = async () => {
        if (!selectedRows.length) return;
        if (!window.confirm(`Are you sure you want to delete ${selectedRows.length} selected transaction(s)?`)) return;

        setIsBulkDeleting(true);
        try {
            // Group selected IDs by type
            const grouped = selectedRows.reduce((acc, rowStr) => {
                const [type, id] = rowStr.split('-');
                if (!acc[type]) acc[type] = new Set();
                acc[type].add(id);
                return acc;
            }, {});

            for (const type in grouped) {
                const ids = Array.from(grouped[type]);
                const endpoint = TYPE_ENDPOINT[type];
                await axios.post(`${API}/${endpoint}/bulk-delete`, { ids });
            }

            setSelectedRows([]);
            fetchTransactions();
            alert('Bulk deletion successful');
        } catch (e) {
            alert('Bulk delete failed: ' + (e.response?.data?.error || e.message));
        } finally {
            setIsBulkDeleting(false);
        }
    };

    const toggleRowSelection = (rowId) => {
        setSelectedRows(prev => 
            prev.includes(rowId) ? prev.filter(id => id !== rowId) : [...prev, rowId]
        );
    };

    const toggleSelectAll = () => {
        if (selectedRows.length === filtered.length) {
            setSelectedRows([]);
        } else {
            // Select by transaction group ID to ensure we delete headers
            const allIds = Array.from(new Set(filtered.map(t => `${t._type}-${t.id}`)));
            setSelectedRows(allIds);
        }
    };

    return (
        <div className="animate-fade-in">
            {/* ── Launcher tiles (only on the main Stock Transactions page) ── */}
            {initialType === 'ALL' && !isFYClosed && (
                <div className="transaction-launcher-section mb-8">
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 16 }}>
                        {transactionTypes.map((t, i) => (
                            <div 
                                key={i} 
                                className={`launcher-tile ${t.type === 'TRANSFER' ? 'opacity-50 cursor-not-allowed filter grayscale' : ''}`} 
                                onClick={() => t.type !== 'TRANSFER' && setActiveForm(t.type)}
                            >
                                <div className={`tile-icon-box ${t.color}`}>{t.icon}</div>
                                <span>{t.label}</span>
                                {t.type !== 'TRANSFER' && <div className="tile-hover-btn"><Plus size={14} /> New</div>}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* ── Registry card ── */}
            <div className="inventory-card premium-card">
                <div className="card-header-flex">
                    <div className="header-icon-title">
                        <div className={`icon-wrapper ${currentTypeInfo ? currentTypeInfo.color : 'bg-blue-subtle'}`}>
                            {currentTypeInfo ? currentTypeInfo.icon : <FileText size={22} />}
                        </div>
                        <div>
                            <h3>{currentTypeInfo ? currentTypeInfo.label : 'All Transactions'} Registry</h3>
                            <p>{currentTypeInfo
                                ? `Manage and track ${currentTypeInfo.label.toLowerCase()} entries`
                                : 'All stock movements and audit trail'}</p>
                        </div>
                    </div>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                        {/* SuperAdmin: Location filter dropdown */}
                        {isSuperAdmin && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <Filter size={13} style={{ color: '#64748b' }} />
                                <SearchableSelect
                                    options={[
                                        { value: 'ALL', label: 'All Locations' },
                                        ...locations.filter(l => !l.is_head_office).map(l => ({ value: l.id, label: l.name }))
                                    ]}
                                    value={filterLocationId || 'ALL'}
                                    onChange={val => setFilterLocationId(val === 'ALL' ? null : parseInt(val))}
                                    placeholder="Filter by Location"
                                    className="premium-select-sm"
                                    style={{ width: '180px' }}
                                />
                            </div>
                        )}
                        <button className="btn-secondary" style={{ padding: '6px 12px', height: 36, display: 'flex', alignItems: 'center', gap: 6 }}
                            onClick={() => {
                                const data = filtered.map(t => ({
                                    trans_no: t.trans_no || '-',
                                    date: t.trans_date ? new Date(t.trans_date).toLocaleDateString() : '-',
                                    maker: t.maker_name || '-',
                                    category: t.category_name || '-',
                                    power: t.power || '-',
                                    lot: t.lot_no || '-',
                                    exp_date: formatDate(t.exp_date),
                                    mfg_date: formatDate(t.mfg_date),
                                    qty_sold: activeFilter === 'SALES_RETURN' ? formatQty(t.qty_sold || 0) : undefined,
                                    qty: formatQty(t.qty || 0),
                                    total: formatAmount(t.amount || t.total_amount || 0),
                                    party: t.supplier_name || t.customer_name || 'N/A'

                                }));
                                const partyHeader = (activeFilter === 'PURCHASE' || activeFilter === 'PURCHASE_RETURN') ? 'Vendor' : 'Customer';
                                const reportName = `${currentTypeInfo?.label || 'Inventory'} Report`;
                                const headers = ['Transaction', 'Date', 'Maker', 'Category', 'Power', 'Lot No', 'Exp Date', 'Mfg Date'];
                                if (activeFilter === 'SALES_RETURN') headers.push('Qty Sold');
                                headers.push('Qty', 'Total', partyHeader);
                                const fields = ['trans_no', 'date', 'maker', 'category', 'power', 'lot', 'exp_date', 'mfg_date'];
                                if (activeFilter === 'SALES_RETURN') fields.push('qty_sold');
                                fields.push('qty', 'total', 'party');
                                printTable(reportName, headers, data, fields, companyInfo, reportMeta);
                            }}>
                            <Printer size={15} /> Print
                        </button>
                        <button className="btn-secondary" style={{ padding: '6px 12px', height: 36, display: 'flex', alignItems: 'center', gap: 6 }}
                            onClick={() => setExportModal(true)}>
                            <FileText size={15} /> Export
                        </button>
                        {initialType !== 'ALL' && !isFYClosed && activeFilter !== 'TRANSFER' && (
                            <button className="btn-primary" onClick={() => setActiveForm(activeFilter)}>
                                <Plus size={16} /> New {currentTypeInfo?.label}
                            </button>
                        )}
                        {initialType === 'ALL' && (
                            <SearchableSelect
                                options={[
                                    { value: 'ALL', label: 'All Types' },
                                    ...transactionTypes.map(tt => ({ value: tt.type, label: tt.label }))
                                ]}
                                value={activeFilter}
                                onChange={val => setActiveFilter(val)}
                                placeholder="All Types"
                                className="premium-select-sm"
                                style={{ width: '160px' }}
                            />
                        )}
                        <button className="btn-refresh" onClick={fetchTransactions}>
                            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
                        </button>
                        {selectedRows.length > 0 && (
                            <button 
                                className="btn-secondary" 
                                style={{ background: '#fee2e2', color: '#dc2626', border: '1px solid #fecaca', display: 'flex', alignItems: 'center', gap: 6 }}
                                onClick={handleBulkDelete}
                                disabled={isBulkDeleting}
                            >
                                <Trash2 size={15} /> {isBulkDeleting ? 'Deleting...' : `Delete All (${selectedRows.length})`}
                            </button>
                        )}
                    </div>
                </div>

                <div className="table-search-premium mt-4 mb-4">
                    <Search size={16} className="search-icon" />
                    <input
                        type="text"
                        placeholder="Search by Trans #, Lot No, Item, Vendor, Supplier or Customer..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                    />
                </div>

                <div className="premium-table-container premium-scrollbar" style={isTransfer ? { overflow: 'auto', maxHeight: '68vh' } : {}}>
                    {(() => {
                        const isStockOpening = activeFilter === 'STOCK_OPENING';
                        
                        let colCount = 10; // Base columns
                        if (isTrq) colCount = 8;
                        else if (isTransfer) colCount = 16;
                        else if (isSalesReturn) colCount = 15;
                        else colCount = 14;

                        const showCustomer = !isTrq && !isTransfer;

                        return (
                            <table className="premium-table">
                                <thead style={isTransfer ? { position: 'sticky', top: 0, zIndex: 10, background: '#f8fafc' } : {}}>
                                    <tr>
                                        {isTransfer ? (
                                            <>
                                                <th style={{ width: 40, textAlign: 'center', fontSize: '0.75rem' }}>
                                                    <button onClick={toggleSelectAll} className="text-slate-400 hover:text-blue-500 transition-colors">
                                                        {selectedRows.length > 0 && selectedRows.length === new Set(filtered.map(t => `${t._type}-${t.id}`)).size ? <CheckSquare size={18} /> : <Square size={18} />}
                                                    </button>
                                                </th>
                                                <th style={{ fontSize: '0.75rem' }}>Transaction</th>
                                                <th style={{ width: 100, fontSize: '0.75rem' }}>Date</th>
                                                <th style={{ fontSize: '0.75rem' }}>Source Transaction #</th>
                                                <th style={{ fontSize: '0.75rem' }}>Destination</th>
                                                <th style={{ fontSize: '0.75rem' }}>Maker</th>
                                                <th style={{ fontSize: '0.75rem' }}>Category</th>
                                                <th style={{ fontSize: '0.75rem' }}>Power</th>
                                                <th className="text-center" style={{ fontSize: '0.75rem' }}>Stock Requested</th>
                                                <th className="text-center" style={{ fontSize: '0.75rem' }}>Stock In Hand</th>
                                                <th style={{ fontSize: '0.75rem' }}>Lot No</th>
                                                <th style={{ fontSize: '0.75rem' }}>SNO</th>
                                                <th style={{ fontSize: '0.75rem' }}>Exp Date</th>
                                                <th style={{ fontSize: '0.75rem' }}>Mfg Date</th>
                                                <th className="text-center" style={{ fontSize: '0.75rem' }}>Qty Issued</th>
                                                <th className="text-center" style={{ fontSize: '0.75rem' }}>Actions</th>
                                            </>
                                        ) : (
                                            <>
                                                <th style={{ width: 40, textAlign: 'center' }}>
                                                    <button onClick={toggleSelectAll} className="text-slate-400 hover:text-blue-500 transition-colors">
                                                        {selectedRows.length > 0 && selectedRows.length === new Set(filtered.map(t => `${t._type}-${t.id}`)).size ? <CheckSquare size={18} /> : <Square size={18} />}
                                                    </button>
                                                </th>
                                                <th>Transaction</th>
                                                <th>Date</th>
                                                <th>Maker</th>
                                                <th>Category</th>
                                                <th>Power</th>
                                                {activeFilter === 'TRANSFER_REQUEST' && <th className="text-center">Stock Received</th>}
                                                {activeFilter !== 'STOCK_OPENING' && activeFilter !== 'TRANSFER_REQUEST' && <th className="text-center">Stock In Hand</th>}
                                                {!isTrq && <th>Lot No</th>}
                                                {!isTrq && <th style={{ width: 80 }}>SNO</th>}
                                                {!isTrq && <th>Exp Date</th>}
                                                {!isTrq && <th>Mfg Date</th>}
                                                {isSalesReturn && <th className="text-center">Qty Sold</th>}
                                                <th className="text-center">{activeFilter === 'TRANSFER_REQUEST' ? 'Qty Request' : 'Qty'}</th>
                                                {!isTrq && <th className="text-right">Total</th>}
                                                {(isTransfer || isTrq) && <th>Destination</th>}
                                                {showCustomer && <th>{(activeFilter === 'PURCHASE' || activeFilter === 'PURCHASE_RETURN') ? 'Vendor' : 'Customer'}</th>}
                                                <th className="text-center">Actions</th>
                                            </>
                                        )}
                                    </tr>

                                </thead>
                                <tbody>
                                    {(() => {
                                        if (loading) return <tr><td colSpan={colCount} className="text-center py-8">Loading transactions...</td></tr>;
                                        if (filtered.length === 0) return <tr><td colSpan={colCount} className="empty-state">No transactions recorded yet.</td></tr>;

                                        const formatDatePrint = (dateStr) => {
                                            if (!dateStr) return 'N/A';
                                            const d = new Date(dateStr);
                                            if (isNaN(d.getTime())) return dateStr;
                                            const months = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
                                            return `${String(d.getDate()).padStart(2, '0')}-${months[d.getMonth()]}-${d.getFullYear()}`;
                                        };

                                        if (isTransfer) {
                                            const formatTransferDate = (dateStr) => {
                                                if (!dateStr) return 'N/A';
                                                const d = new Date(dateStr);
                                                if (isNaN(d.getTime())) return dateStr;
                                                return `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}/${d.getFullYear()}`;
                                            };
                                            // ── IN-MEMORY DATA TRANSFORMATION: TRANSFER GROUPING ──
                                            const groupedMap = {};
                                            filtered.forEach(t => {
                                                const trnKey = `${t._type}-${t.id}`;
                                                if (!groupedMap[trnKey]) {
                                                    groupedMap[trnKey] = {
                                                        id: t.id,
                                                        trans_no: t.trans_no,
                                                        trans_date: t.trans_date,
                                                        _type: t._type,
                                                        sources: {}
                                                    };
                                                }
                                                const srcKey = t.stock_req || 'MANUAL';
                                                if (!groupedMap[trnKey].sources[srcKey]) {
                                                    groupedMap[trnKey].sources[srcKey] = {
                                                        stock_req: t.stock_req,
                                                        to_location_name: t.to_location_name,
                                                        items: {}
                                                    };
                                                }
                                                const itemKey = `${t.maker_id}-${t.category_id}-${t.power}`;
                                                if (!groupedMap[trnKey].sources[srcKey].items[itemKey]) {
                                                    groupedMap[trnKey].sources[srcKey].items[itemKey] = {
                                                        maker_name: t.maker_name,
                                                        category_name: t.category_name,
                                                        power: t.power,
                                                        stock_required: t.stock_required, 
                                                        qty_in_hand: t.qty_in_hand,
                                                        lots: []
                                                    };
                                                }
                                                groupedMap[trnKey].sources[srcKey].items[itemKey].lots.push(t);
                                            });

                                            return Object.values(groupedMap).map((trn, trnIdx) => {
                                                const trnResult = [];
                                                // 1. Transaction Header Row
                                                trnResult.push(
                                                    <tr key={`trn-${trnIdx}`} style={{ background: '#f8fafc', borderBottom: '2px solid #cbd5e1' }}>
                                                        <td className="text-center">
                                                            <button 
                                                                onClick={(e) => { e.stopPropagation(); toggleRowSelection(`${trn._type}-${trn.id}`); }}
                                                                className={`transition-colors ${selectedRows.includes(`${trn._type}-${trn.id}`) ? 'text-blue-600' : 'text-slate-300'}`}
                                                            >
                                                                {selectedRows.includes(`${trn._type}-${trn.id}`) ? <CheckSquare size={18} /> : <Square size={18} />}
                                                            </button>
                                                        </td>
                                                        <td style={{ fontWeight: 900, color: '#1e293b', fontSize: '0.75rem' }}>{trn.trans_no}</td>
                                                        <td style={{ fontWeight: 600, color: '#475569', fontSize: '0.75rem' }}>{formatTransferDate(trn.trans_date)}</td>
                                                        <td colSpan={12}></td>
                                                        <td className="text-center">
                                                            <div className="flex justify-center gap-2">
                                                                <button onClick={() => setActiveForm({ type: trn._type, editId: trn.id, detailId: null })} className="text-blue-500 hover:text-blue-700 p-1" title="Edit Transaction"><FileText size={16} /></button>
                                                                <button onClick={() => deleteTransaction(trn._type, trn.id)} className="text-red-500 hover:text-red-700 p-1" title="Delete Transaction"><Trash2 size={16} /></button>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                );

                                                Object.values(trn.sources).forEach((src, srcIdx) => {
                                                    Object.values(src.items).forEach((item, itemIdx) => {
                                                        let itemTotalQty = 0;
                                                        let itemTotalAmount = 0;
                                                        item.lots.forEach((lot, lotIdx) => {
                                                            itemTotalQty += parseFloat(lot.qty || 0);
                                                            itemTotalAmount += parseFloat(lot.amount || 0);
                                                            trnResult.push(
                                                                <tr key={`lot-${trnIdx}-${srcIdx}-${itemIdx}-${lotIdx}`} className="table-row-hover" style={{ background: 'white' }}>
                                                                    <td></td><td></td><td></td>
                                                                    <td style={{ color: '#2563eb', fontWeight: 700, fontSize: '0.8rem' }}>{(itemIdx === 0 && lotIdx === 0) ? src.stock_req : ''}</td>
                                                                    <td style={{ color: '#475569', fontWeight: 600, fontSize: '0.8rem' }}>{lotIdx === 0 ? src.to_location_name : ''}</td>
                                                                    <td style={{ fontWeight: 700, color: '#1e293b', fontSize: '0.72rem' }}>{lotIdx === 0 ? item.maker_name : ''}</td>
                                                                    <td style={{ color: '#475569', fontSize: '0.72rem' }}>{lotIdx === 0 ? item.category_name : ''}</td>
                                                                    <td style={{ fontWeight: 600, color: '#475569', fontSize: '0.72rem' }}>{lotIdx === 0 ? (item.power || '-') : ''}</td>
                                                                    <td className="text-center font-bold" style={{ color: '#0369a1', fontSize: '0.72rem' }}>{lotIdx === 0 ? formatQty(item.stock_required || 0) : ''}</td>
                                                                    <td className="text-center font-bold text-slate-500" style={{ fontSize: '0.72rem' }}>{lotIdx === 0 ? formatQty(item.qty_in_hand || 0) : ''}</td>
                                                                    <td><code style={{ background: '#f1f5f9', padding: '2px 6px', borderRadius: 4, fontWeight: 700, color: '#475569', fontSize: '0.7rem' }}>{lot.lot_no}</code></td>
                                                                    <td style={{ fontWeight: 600, color: '#1e293b', fontSize: '0.72rem' }}>{lot.sno || '0'}</td>
                                                                    <td style={{ fontWeight: 700, fontSize: '0.75rem' }}>{formatTransferDate(lot.exp_date)}</td>
                                                                    <td style={{ fontWeight: 700, fontSize: '0.75rem' }}>{formatTransferDate(lot.mfg_date)}</td>
                                                                    <td className="text-center font-bold text-blue-600" style={{ fontSize: '0.72rem' }}>{formatQty(lot.qty)}</td>
                                                                    <td></td>
                                                                </tr>
                                                            );
                                                        });
                                                        trnResult.push(
                                                            <tr key={`item-sum-${trnIdx}-${srcIdx}-${itemIdx}`} style={{ background: '#f0f9ff', borderBottom: '2px solid #e2e8f0', borderTop: '1px solid #bfdbfe' }}>
                                                                <td colSpan={14} style={{ padding: '6px 12px' }}>
                                                                    <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#475569' }}>Total Qty and Amount for this Item :</span>
                                                                </td>
                                                                <td style={{ padding: '6px 4px', textAlign: 'center' }}>
                                                                    <strong style={{ color: '#0369a1', fontSize: '0.8rem' }}>{formatQty(itemTotalQty)}</strong>
                                                                </td>
                                                                <td></td>
                                                            </tr>
                                                        );
                                                    });
                                                });
                                                return trnResult;
                                            });
                                        }

                                        // ── DEFAULT LIST VIEW ──
                                        let lastGroupId = null;
                                        return filtered.map((t, idx) => {
                                            const currentGroupId = `${t._type}-${t.trans_no || t.id}-${t.stock_req || ''}-${t.to_location_id || ''}`;
                                            const isFirstInGroup = currentGroupId !== lastGroupId;
                                            lastGroupId = currentGroupId;

                                            return (
                                                <tr key={`${t._type}-${t.detail_id || t.id}-${idx}`}
                                                    className="table-row-hover"
                                                    style={{
                                                        borderTop: isFirstInGroup && idx !== 0 ? '2px solid #e2e8f0' : '1px solid #f1f5f9',
                                                        background: !isFirstInGroup ? '#fcfdfe' : 'white'
                                                    }}
                                                >
                                                    <td className="text-center" style={{ verticalAlign: 'top' }}>
                                                        {isFirstInGroup && (
                                                            <button 
                                                                onClick={(e) => { e.stopPropagation(); toggleRowSelection(currentGroupId); }}
                                                                className={`transition-colors ${selectedRows.includes(currentGroupId) ? 'text-blue-600' : 'text-slate-300'}`}
                                                            >
                                                                {selectedRows.includes(currentGroupId) ? <CheckSquare size={18} /> : <Square size={18} />}
                                                            </button>
                                                        )}
                                                    </td>
                                                    <td style={{ verticalAlign: 'top' }}>
                                                        {isFirstInGroup ? <span style={{ fontWeight: 800, color: '#1e293b', fontSize: '0.85rem' }}>{t.trans_no}</span> : null}
                                                    </td>
                                                    <td style={{ verticalAlign: 'top', fontWeight: 600, fontSize: '0.81rem', color: '#64748b' }}>
                                                        {isFirstInGroup ? new Date(t.trans_date).toLocaleDateString() : null}
                                                    </td>
                                                    <td style={{ fontWeight: 700, fontSize: '0.8rem', color: '#1e293b' }}>{t.maker_name}</td>
                                                    <td style={{ fontSize: '0.8rem', color: '#475569' }}>{t.category_name}</td>
                                                    <td style={{ fontSize: '0.8rem', color: '#475569', fontWeight: 600 }}>{t.power || '-'}</td>
                                                    {activeFilter === 'TRANSFER_REQUEST' && (
                                                        <td className="text-center font-bold" style={{ fontSize: '0.85rem', color: '#0369a1' }}>{formatQty(t.stock_received || 0)}</td>
                                                    )}
                                                    {activeFilter !== 'STOCK_OPENING' && activeFilter !== 'TRANSFER_REQUEST' && (
                                                        <td className="text-center font-bold text-slate-500" style={{ fontSize: '0.85rem' }}>{formatQty(t.qty_in_hand || 0)}</td>
                                                    )}
                                                    {!isTrq && <td><code style={{ background: '#f1f5f9', padding: '2px 6px', borderRadius: 4, fontWeight: 700, color: '#475569', fontSize: '0.75rem' }}>{t.lot_no}</code></td>}
                                                    {!isTrq && <td style={{ fontSize: '0.8rem', color: '#1e293b', fontWeight: 600 }}>{t.sno || '0'}</td>}
                                                    {!isTrq && <td><span style={{ fontWeight: 600, color: '#0f172a', fontSize: '0.78rem' }}>{formatDatePrint(t.exp_date)}</span></td>}
                                                    {!isTrq && <td><span style={{ fontWeight: 600, color: '#0f172a', fontSize: '0.78rem' }}>{formatDatePrint(t.mfg_date)}</span></td>}
                                                    {isSalesReturn && <td className="text-center font-bold text-slate-500" style={{ fontSize: '0.85rem' }}>{formatQty(t.qty_sold || 0)}</td>}
                                                    <td className="text-center font-bold text-blue-600" style={{ fontSize: '0.85rem' }}>{formatQty(t.qty || 0)}</td>
                                                    {!isTrq && <td className="text-right font-bold text-slate-800" style={{ fontSize: '0.85rem' }}>{formatAmount(t.amount || t.total_amount || 0)}</td>}
                                                    {(isTransfer || isTrq) && (
                                                        <td style={{ fontSize: '0.8rem', color: '#1e293b', fontWeight: 600 }}>{isFirstInGroup ? (t.to_location_name || 'N/A') : null}</td>
                                                    )}
                                                    {showCustomer && (
                                                        <td style={{ verticalAlign: 'top' }}>
                                                            {isFirstInGroup ? (
                                                                <div className="party-cell"><span className="party-name" style={{ fontSize: '0.78rem', fontWeight: 600 }}>{t.supplier_name || t.customer_name || 'N/A'}</span></div>
                                                            ) : null}
                                                        </td>
                                                    )}
                                                    <td className="text-center" style={{ verticalAlign: 'top' }}>
                                                        {isFirstInGroup ? (
                                                            <div className="flex flex-col items-center gap-1">
                                                                {isTrq && (
                                                                    t.status === 'PENDING' ? (
                                                                        <span style={{ background: '#fef3c7', color: '#92400e', padding: '2px 8px', borderRadius: 4, fontSize: '0.65rem', fontWeight: 800, marginBottom: 2 }}>PENDING</span>
                                                                    ) : (!t.status || t.status === 'TRANSFERRED' || t.status === 'TRANSFER') ? (
                                                                        <span style={{ background: '#dcfce7', color: '#166534', padding: '2px 8px', borderRadius: 4, fontSize: '0.65rem', fontWeight: 800, border: '1px solid #166534' }}>TRANSFERRED</span>
                                                                    ) : null
                                                                )}
                                                                <div className="flex justify-center gap-2">
                                                                    {t._type === 'SALES_INVOICE' && (
                                                                        <button onClick={() => setShowPrint(t.id)} className="text-emerald-600 hover:text-emerald-800 transition-colors p-1" title="Print Professional Invoice"><Printer size={16} /></button>
                                                                    )}
                                                                    <button onClick={() => setActiveForm({ type: t._type, editId: t.id, detailId: t.detail_id })} className="text-blue-500 hover:text-blue-700 transition-colors p-1" title="Edit transaction"><FileText size={16} /></button>
                                                                    <button onClick={() => deleteTransaction(t._type, t.id)} className="text-red-500 hover:text-red-700 transition-colors p-1" title="Delete entire transaction"><Trash2 size={16} /></button>
                                                                </div>
                                                            </div>
                                                        ) : null}
                                                    </td>
                                                </tr>
                                            );
                                        });
                                    })()}
                                </tbody>
                            </table>
                        );
                    })()}
                </div>
            </div>

            {
                activeForm && (
                    <StockTransactionForm
                        key={typeof activeForm === 'object' ? `${activeForm.type}-${activeForm.editId}` : activeForm}
                        type={typeof activeForm === 'object' ? activeForm.type : activeForm}
                        editId={typeof activeForm === 'object' ? activeForm.editId : null}
                        detailId={typeof activeForm === 'object' ? activeForm.detailId : null}
                        currentUser={currentUser}
                        companyInfo={companyInfo}
                        preloadData={preloadData}
                        onClose={() => { 
                            setActiveForm(null); 
                            if (onClearPreload) onClearPreload(); 
                        }}
                        onSave={(keepOpen) => {
                            if (!keepOpen) {
                                setActiveForm(null);
                                if (onClearPreload) onClearPreload();
                            }
                            fetchTransactions();
                        }}
                    />
                )
            }

            {showPrint && (
                <SalesInvoicePrint
                    invoiceId={showPrint}
                    companyInfo={companyInfo}
                    onClose={() => setShowPrint(null)}
                />
            )}

            <ExportModal
                isOpen={exportModal}
                onClose={() => setExportModal(false)}
                title={`${currentTypeInfo?.label || 'Inventory'} Registry`}
                onSelect={(format) => {
                    const data = filtered.map(t => ({
                        trans_no: t.trans_no || '-',
                        date: t.trans_date ? new Date(t.trans_date).toLocaleDateString() : '-',
                        maker: t.maker_name || '-',
                        category: t.category_name || '-',
                        power: t.power || '-',
                        lot: t.lot_no || '-',
                        exp_date: formatDate(t.exp_date),
                        mfg_date: formatDate(t.mfg_date),
                        qty_sold: activeFilter === 'SALES_RETURN' ? formatQty(t.qty_sold || 0) : undefined,
                        qty: formatQty(t.qty || 0),
                        total: formatAmount(t.amount || t.total_amount || 0),
                        party: t.supplier_name || t.customer_name || 'N/A'

                    }));
                    const partyHeader = (activeFilter === 'PURCHASE' || activeFilter === 'PURCHASE_RETURN') ? 'Vendor' : 'Customer';
                    const headers = ['Transaction', 'Date', 'Maker', 'Category', 'Power', 'Lot No', 'Exp Date', 'Mfg Date'];
                    if (activeFilter === 'SALES_RETURN') headers.push('Qty Sold');
                    headers.push('Qty', 'Total', partyHeader);
                    const fields = ['trans_no', 'date', 'maker', 'category', 'power', 'lot', 'exp_date', 'mfg_date'];
                    if (activeFilter === 'SALES_RETURN') fields.push('qty_sold');
                    fields.push('qty', 'total', 'party');

                    if (format === 'EXCEL') {
                        exportToCSV(`${currentTypeInfo?.type || 'Inventory'}_Registry`, headers, data, fields);
                    } else {
                        const reportName = `${currentTypeInfo?.label || 'Inventory'} Report`;
                        printTable(reportName, headers, data, fields, companyInfo, reportMeta);
                    }
                }}
            />
        </div >
    );
};

export default InventoryTransactions;
