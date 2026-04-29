import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Filter, RefreshCw, Download, Archive, Printer, FileText } from 'lucide-react';
import SearchableSelect from '../common/SearchableSelect';
import { printTable, exportToCSV } from '../../utils/exportUtils';
import { formatAmount, formatQty } from '../../utils/numberUtils';
import ExportModal from '../common/ExportModal';

const API = '/api/inventory';

const StockReport = ({ currentUser, companyInfo, reportMeta }) => {
    const [reportData, setReportData] = useState([]);
    const [makers, setMakers] = useState([]);
    const [categories, setCategories] = useState([]);
    const [powers, setPowers] = useState([]);
    const [locations, setLocations] = useState([]);
    const [loading, setLoading] = useState(false);
    const [exportModal, setExportModal] = useState(false);

    const [filters, setFilters] = useState({
        location_id: currentUser.location_id,
        maker_id: '',
        category_id: '',
        power_id: '',
        fiscal_year_id: currentUser.fiscal_year_id
    });

    const fetchData = async () => {
        try {
            const [mks, pwr, locs] = await Promise.all([
                axios.get(`${API}/makers`),
                axios.get(`${API}/powers`),
                axios.get('/api/locations')
            ]);
            setMakers(mks.data);
            setPowers(pwr.data);
            setLocations(locs.data);
        } catch (e) { console.error(e); }
    };

    const fetchReport = async () => {
        setLoading(true);
        try {
            const { data } = await axios.get(`${API}/stock-report`, { params: filters });
            setReportData(data);
        } catch (e) { console.error(e); }
        setLoading(false);
    };

    useEffect(() => {
        fetchData();
        fetchReport();
    }, [filters.location_id, filters.maker_id, filters.category_id, filters.power_id]);

    const handleMakerChange = async (mid) => {
        setFilters({ ...filters, maker_id: mid, category_id: '' });
        if (!mid) { setCategories([]); return; }
        try {
            const { data } = await axios.get(`${API}/categories`, { params: { maker_id: mid } });
            setCategories(data);
        } catch (e) { console.error(e); }
    };

    return (
        <div className="animate-fade-in">
            <div className="inventory-card premium-card">
                <div className="card-header-flex">
                    <div className="header-icon-title">
                        <div className="icon-wrapper bg-blue-subtle"><Archive size={22} /></div>
                        <div>
                            <h3>Stock Inventory Report</h3>
                            <p>Real-time closing balance across all categories</p>
                        </div>
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                        <button className="btn-secondary" style={{ padding: '6px 12px', height: 36, display: 'flex', alignItems: 'center', gap: 6 }}
                            onClick={() => {
                                const data = reportData.map(r => ({
                                    maker: r.maker_name || '-',
                                    category: r.category_name || '-',
                                    power: r.power || 'Global',
                                    opening: formatQty(r.opening_qty || 0),
                                    purchase: formatQty(r.purchase_qty || 0),
                                    purchase_return: formatQty(r.purchase_return_qty || 0),
                                    transfer: formatQty(r.transfer_qty || 0),
                                    sales: formatQty(r.sales_qty || 0),
                                    sales_return: formatQty(r.sales_return_qty || 0),
                                    balance: formatQty(r.balance_qty || 0),
                                }));
                                const headers = ['Maker', 'Category', 'Power', 'Opening', 'Purchase', 'Pur Return', 'Transfer', 'Sales', 'Sales Return', 'In-Hand'];
                                const fields = ['maker', 'category', 'power', 'opening', 'purchase', 'purchase_return', 'transfer', 'sales', 'sales_return', 'balance'];
                                printTable('Stock Inventory Report', headers, data, fields, companyInfo, { ...reportMeta, fromDate: null });
                            }}>
                            <Printer size={15} /> Print
                        </button>
                        <button className="btn-secondary" style={{ padding: '6px 12px', height: 36, display: 'flex', alignItems: 'center', gap: 6 }}
                            onClick={() => setExportModal(true)}>
                            <FileText size={15} /> Export
                        </button>
                        <button className="btn-refresh" onClick={fetchReport} disabled={loading}>
                            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
                        </button>
                    </div>
                </div>

                <div className="report-filters-inline mb-8 flex flex-wrap gap-6 p-6 bg-slate-50 rounded-2xl border border-slate-100">
                    <div className="filter-group flex-1 min-w-[200px]">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Location</label>
                        <SearchableSelect
                            options={[
                                { value: '', label: 'Global Stock' },
                                ...locations.map(l => ({ value: l.id, label: l.name }))
                            ]}
                            value={filters.location_id}
                            onChange={val => setFilters({ ...filters, location_id: val })}
                            placeholder="Global Stock"
                            disabled={currentUser.role !== 'SUPER_ADMIN'}
                        />
                    </div>
                    <div className="filter-group flex-1 min-w-[200px]">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Maker</label>
                        <SearchableSelect
                            options={[
                                { value: '', label: 'All Makers' },
                                ...makers.map(m => ({ value: m.id, label: m.name }))
                            ]}
                            value={filters.maker_id}
                            onChange={val => handleMakerChange(val)}
                            placeholder="All Makers"
                        />
                    </div>
                    <div className="filter-group flex-1 min-w-[200px]">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Category</label>
                        <SearchableSelect
                            options={[
                                { value: '', label: 'All Categories' },
                                ...categories.map(c => ({ value: c.id, label: c.name }))
                            ]}
                            value={filters.category_id}
                            onChange={val => setFilters({ ...filters, category_id: val })}
                            placeholder="All Categories"
                        />
                    </div>
                    <div className="filter-group flex-1 min-w-[200px]">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Power</label>
                        <SearchableSelect
                            options={[
                                { value: '', label: 'All Powers' },
                                ...powers.map(p => ({ value: p.id, label: p.power }))
                            ]}
                            value={filters.power_id}
                            onChange={val => setFilters({ ...filters, power_id: val })}
                            placeholder="All Powers"
                        />
                    </div>
                </div>

                <div className="premium-table-container">
                    <table className="premium-table" style={{ minWidth: 1200 }}>
                        <thead>
                            <tr>
                                <th>Maker</th>
                                <th>Category</th>
                                <th>Power</th>
                                <th className="text-center">Stock Opening</th>
                                <th className="text-center">Stock Purchase</th>
                                <th className="text-center">Purchase Return</th>
                                <th className="text-center">Stock Transfer</th>
                                <th className="text-center">Stock Sales</th>
                                <th className="text-center">Sales Return</th>
                                <th className="text-center bg-blue-50/50 border-x border-blue-100 text-blue-700 font-black">Stock In Hand</th>
                            </tr>
                        </thead>
                         <tbody>
                            {reportData.length === 0 ? (
                                <tr><td colSpan="11" className="empty-state">No inventory data available for selected filters.</td></tr>
                            ) : reportData.map((r, i) => (
                                <tr key={i} className="table-row-hover">
                                    <td className="font-bold text-slate-800">{r.maker_name}</td>
                                    <td className="text-slate-600">{r.category_name}</td>
                                    <td className="text-slate-500 text-sm">{r.power || 'Global'}</td>
                                    <td style={{ textAlign: 'center', fontWeight: 700, color: '#2563eb' }}>{formatQty(r.opening_qty || 0)}</td>
                                    <td className="text-center font-bold text-blue-600">{formatQty(r.purchase_qty || 0)}</td>
                                    <td className="text-center font-bold text-orange-600">{formatQty(r.purchase_return_qty || 0)}</td>
                                    <td className="text-center font-bold text-purple-600">{formatQty(r.transfer_qty || 0)}</td>
                                    <td className="text-center font-bold text-red-600">{formatQty(r.sales_qty || 0)}</td>
                                    <td className="text-center font-bold text-green-600">{formatQty(r.sales_return_qty || 0)}</td>
                                    <td className="text-center bg-blue-50/30 border-x border-blue-100/50">
                                        <span style={{
                                            fontWeight: 900,
                                            fontSize: '1.15rem',
                                            color: parseFloat(r.balance_qty) > 0 ? '#16a34a' : '#dc2626'
                                        }}>
                                            {formatQty(r.balance_qty || 0)}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                        {reportData.length > 0 && (
                            <tfoot>
                                <tr className="bg-slate-50 font-black border-t-2 border-slate-200">
                                    <td colSpan="3" className="p-6 text-slate-500 uppercase tracking-widest text-xs border-r border-slate-100">Total Quantities</td>
                                     <td className="text-center p-4 bg-slate-50/50">{formatQty(reportData.reduce((s, r) => s + parseFloat(r.opening_qty || 0), 0))}</td>
                                    <td className="text-center p-4 bg-slate-50/50">{formatQty(reportData.reduce((s, r) => s + parseFloat(r.purchase_qty || 0), 0))}</td>
                                    <td className="text-center p-4 bg-slate-50/50">{formatQty(reportData.reduce((s, r) => s + parseFloat(r.purchase_return_qty || 0), 0))}</td>
                                    <td className="text-center p-4 bg-slate-50/50">{formatQty(reportData.reduce((s, r) => s + parseFloat(r.transfer_qty || 0), 0))}</td>
                                    <td className="text-center p-4 bg-slate-50/50">{formatQty(reportData.reduce((s, r) => s + parseFloat(r.sales_qty || 0), 0))}</td>
                                    <td className="text-center p-4 bg-slate-50/50">{formatQty(reportData.reduce((s, r) => s + parseFloat(r.sales_return_qty || 0), 0))}</td>
                                    <td className="text-center p-6 text-3xl font-black text-blue-700 bg-blue-50/50 border-x border-blue-100">
                                        {formatQty(reportData.reduce((s, r) => s + parseFloat(r.balance_qty || 0), 0))}
                                    </td>

                                </tr>
                            </tfoot>
                        )}
                    </table>
                </div>
            </div>
            <ExportModal
                isOpen={exportModal}
                onClose={() => setExportModal(false)}
                title="Stock Inventory Report"
                onSelect={(format) => {
                    const data = reportData.map(r => ({
                        maker: r.maker_name || '-',
                        category: r.category_name || '-',
                        power: r.power || 'Global',
                        opening: formatQty(r.opening_qty || 0),
                        purchase: formatQty(r.purchase_qty || 0),
                        purchase_return: formatQty(r.purchase_return_qty || 0),
                        transfer: formatQty(r.transfer_qty || 0),
                        sales: formatQty(r.sales_qty || 0),
                        sales_return: formatQty(r.sales_return_qty || 0),
                        balance: formatQty(r.balance_qty || 0),
                    }));
                    const headers = ['Maker', 'Category', 'Power', 'Opening', 'Purchase', 'Pur Return', 'Transfer', 'Sales', 'Sales Return', 'In-Hand'];
                    const fields = ['maker', 'category', 'power', 'opening', 'purchase', 'purchase_return', 'transfer', 'sales', 'sales_return', 'balance'];

                    if (format === 'EXCEL') {
                        exportToCSV('Stock_Report', headers, data, fields);
                    } else {
                        printTable('Stock Inventory Report', headers, data, fields, companyInfo, { ...reportMeta, fromDate: null });
                    }
                }}
            />
        </div>
    );
};

export default StockReport;
