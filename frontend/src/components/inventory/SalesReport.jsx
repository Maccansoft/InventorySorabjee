import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { FileText, Printer, FileDown, RefreshCw, Search, Calendar, User, CreditCard } from 'lucide-react';
import SearchableSelect from '../common/SearchableSelect';
import { printTable, exportToCSV } from '../../utils/exportUtils';
import { formatAmount, formatQty } from '../../utils/numberUtils';
import ExportModal from '../common/ExportModal';
import SalesInvoicePrint from './SalesInvoicePrint';

const API = '/api/inventory';

const SalesReport = ({ currentUser, companyInfo, reportMeta, fromDate: pFromDate, toDate: pToDate }) => {
    const [reportData, setReportData] = useState([]);
    const [customers, setCustomers] = useState([]);
    const [loading, setLoading] = useState(false);
    const [exportModal, setExportModal] = useState(false);
    const [showPreview, setShowPreview] = useState(null);
    const [filters, setFilters] = useState({
        location_id: currentUser.location_id,
        fiscal_year_id: currentUser.fiscal_year_id,
        fromDate: pFromDate,
        toDate: pToDate,
        customer_id: ''
    });

    useEffect(() => {
        setFilters(f => ({ ...f, fromDate: pFromDate, toDate: pToDate }));
    }, [pFromDate, pToDate]);

    const fetchData = async () => {
        try {
            const { data } = await axios.get(`${API}/customers`);
            setCustomers(data);
        } catch (e) { console.error(e); }
    };

    const fetchReport = async () => {
        setLoading(true);
        try {
            const { data } = await axios.get(`${API}/sales-report`, { params: filters });
            setReportData(data);
        } catch (e) { console.error(e); }
        setLoading(false);
    };

    useEffect(() => {
        fetchData();
        fetchReport();
    }, [filters.fromDate, filters.toDate, filters.customer_id, filters.location_id]);

    const totalQty = reportData.reduce((s, r) => s + parseFloat(r.total_qty || 0), 0);
    const totalAmount = reportData.reduce((s, r) => s + parseFloat(r.total_amount || 0), 0);

    return (
        <div className="animate-fade-in px-2">
            <div className="inventory-card premium-card">
                <div className="card-header-flex">
                    <div className="header-icon-title">
                        <div className="icon-wrapper bg-emerald-subtle text-emerald-600"><FileText size={22} /></div>
                        <div>
                            <h3>Sales Invoice Summary Report</h3>
                            <p>Overview of all sales transactions for the selected period</p>
                        </div>
                    </div>
                    <div style={{ display: 'flex', gap: 10 }}>
                        <button className="btn-secondary" onClick={() => {
                            const data = reportData.map(r => ({
                                trans_no: r.trans_no,
                                date: new Date(r.trans_date).toLocaleDateString(),
                                customer: r.customer_name || 'Walk-in',
                                qty: formatQty(r.total_qty || 0),
                                amount: formatAmount(r.total_amount || 0),
                            }));
                            printTable('Sales Invoice Report', ['Trans #', 'Date', 'Customer', 'Total Qty', 'Amount'], data, ['trans_no', 'date', 'customer', 'qty', 'amount'], companyInfo, reportMeta);

                        }}>
                            <Printer size={15} /> Print Report
                        </button>
                        <button className="btn-secondary" onClick={() => setExportModal(true)}>
                            <FileDown size={15} /> Export
                        </button>
                        <button className="btn-refresh" onClick={fetchReport} disabled={loading}>
                            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
                        </button>
                    </div>
                </div>

                <div className="report-filters-inline mt-6 mb-8 flex flex-wrap gap-4 p-4 bg-slate-50 rounded-xl border border-slate-100">
                    <div className="filter-group flex-1 min-w-[240px]">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block ml-1">Customer Filter</label>
                        <div className="relative">
                            <SearchableSelect
                                options={[
                                    { value: '', label: 'All Customers' },
                                    ...customers.map(c => ({ value: c.id, label: c.name }))
                                ]}
                                value={filters.customer_id}
                                onChange={val => setFilters({ ...filters, customer_id: val })}
                                placeholder="All Customers"
                            />
                        </div>
                    </div>
                    {/* Summary Stats in Filter Bar */}
                    <div className="flex gap-4 ml-auto items-end">
                        <div className="stat-pill bg-white border border-slate-200 px-4 py-2 rounded-lg flex flex-col items-center">
                            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">Total Invoices</span>
                            <span className="text-sm font-black text-slate-700">{reportData.length}</span>
                        </div>
                        <div className="stat-pill bg-white border border-slate-200 px-4 py-2 rounded-lg flex flex-col items-center">
                            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">Total Quantity</span>
                            <span className="text-sm font-black text-emerald-600">{formatQty(totalQty)}</span>
                        </div>
                        <div className="stat-pill bg-blue-600 border border-blue-700 px-6 py-2 rounded-lg flex flex-col items-center">
                            <span className="text-[9px] font-bold text-blue-100 uppercase tracking-tighter">Total Sales</span>
                            <span className="text-sm font-black text-white">{formatAmount(totalAmount)}</span>
                        </div>

                    </div>
                </div>

                <div className="premium-table-container">
                    <table className="premium-table">
                        <thead>
                            <tr>
                                <th width="150">Date</th>
                                <th width="180">Invoice #</th>
                                <th>Customer Name</th>
                                <th width="120" className="text-center">Items (Qty)</th>
                                <th width="180" className="text-right">Net Amount</th>
                                <th width="100" className="text-center">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr><td colSpan="6" className="text-center py-12">Loading report data...</td></tr>
                            ) : reportData.length === 0 ? (
                                <tr><td colSpan="6" className="empty-state py-12">No sales records found for this period.</td></tr>
                            ) : (
                                reportData.map((r, i) => (
                                    <tr key={i} className="table-row-hover">
                                        <td className="font-semibold text-slate-500">{new Date(r.trans_date).toLocaleDateString()}</td>
                                        <td>
                                            <span className="px-3 py-1 bg-slate-100 rounded-full text-xs font-bold text-slate-700 border border-slate-200">
                                                {r.trans_no}
                                            </span>
                                        </td>
                                        <td className="font-bold text-slate-700">{r.customer_name || 'N/A'}</td>
                                        <td className="text-center">
                                            <span className="font-black text-emerald-600">{formatQty(r.total_qty || 0)}</span>
                                        </td>
                                        <td className="text-right">
                                            <div className="flex flex-col items-end">
                                                <span className="font-black text-lg text-slate-800 tracking-tight">
                                                    {formatAmount(r.total_amount)}
                                                </span>
                                                <span className="text-[10px] text-slate-400 font-bold uppercase">PKR</span>

                                            </div>
                                        </td>
                                        <td className="text-center">
                                            <button
                                                onClick={() => setShowPreview(r.id)}
                                                className="p-2 text-blue-500 hover:bg-blue-50 rounded-lg transition-all"
                                                title="Professional Preview"
                                            >
                                                <Printer size={18} />
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                        {reportData.length > 0 && (
                            <tfoot>
                                <tr className="bg-slate-50 font-black">
                                    <td colSpan="3" className="p-6 text-slate-400 uppercase tracking-widest text-xs">Total Aggregated Sales</td>
                                    <td className="text-center text-xl text-emerald-600">{formatQty(totalQty)}</td>
                                    <td className="text-right p-6">
                                        <div className="flex flex-col items-end">
                                            <span className="text-3xl text-blue-700 leading-none">{formatAmount(totalAmount)}</span>
                                            <span className="text-xs text-blue-300 mt-1 uppercase">Total PKR Volume</span>
                                        </div>
                                    </td>

                                    <td></td>
                                </tr>
                            </tfoot>
                        )}
                    </table>
                </div>
            </div>

            <ExportModal
                isOpen={exportModal}
                onClose={() => setExportModal(false)}
                title="Sales Invoice Summary Report"
                onSelect={(format) => {
                    const data = reportData.map(r => ({
                        trans_no: r.trans_no,
                        date: new Date(r.trans_date).toLocaleDateString(),
                        customer: r.customer_name || 'Walk-in',
                        qty: formatQty(r.total_qty || 0),
                        amount: formatAmount(r.total_amount || 0),
                    }));
                    const headers = ['Trans #', 'Date', 'Customer', 'Total Qty', 'Amount'];

                    const fields = ['trans_no', 'date', 'customer', 'qty', 'amount'];

                    if (format === 'EXCEL') {
                        exportToCSV(`Sales_Invoice_Report_${filters.fromDate}_${filters.toDate}`, headers, data, fields);
                    } else {
                        printTable('Sales Invoice Report', headers, data, fields, companyInfo, reportMeta);
                    }
                }}
            />

            {showPreview && (
                <SalesInvoicePrint
                    invoiceId={showPreview}
                    companyInfo={companyInfo}
                    onClose={() => setShowPreview(null)}
                />
            )}
        </div>
    );
};

export default SalesReport;
