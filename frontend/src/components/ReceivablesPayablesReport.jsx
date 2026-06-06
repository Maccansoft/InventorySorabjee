import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Printer, FileText, Search } from 'lucide-react';
import { printTable, exportToCSV } from '../utils/exportUtils';
import ExportModal from './common/ExportModal';

const ReceivablesPayablesReport = ({ type, fromDate, toDate, locationId, fiscalYearId, companyInfo, reportMeta }) => {
    const [reportData, setReportData] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [exportModal, setExportModal] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            setError('');
            try {
                const endpoint = type === 'RECEIVABLES' ? '/api/reports/receivables' : '/api/reports/payables';
                const { data } = await axios.get(endpoint, {
                    params: {
                        fromDate,
                        toDate,
                        ...(locationId ? { location_id: locationId } : { all_locations: 'true' }),
                        ...(fiscalYearId ? { fiscal_year_id: fiscalYearId } : {})
                    }
                });
                setReportData(data);
            } catch (err) {
                console.error(err);
                if (err.response?.data?.error === 'parent_not_found') {
                    setError(err.response.data.message);
                } else {
                    setError('Failed to load report data.');
                }
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [type, fromDate, toDate, locationId, fiscalYearId]);

    const title = type === 'RECEIVABLES' ? 'Receivables Report' : 'Payables Report';

    const filteredData = reportData.filter(r => {
        const query = searchQuery.toLowerCase().trim();
        if (!query) return true;
        return (
            (r.account_code || '').toLowerCase().includes(query) ||
            (r.account_name || '').toLowerCase().includes(query)
        );
    });

    const handlePrint = () => {
        const headers = ['Account Code', 'Account Name', 'Net Balance'];
        const fields = ['account_code', 'account_name', 'net_balance'];
        
        const rows = filteredData.map(r => ({
            account_code: r.account_code,
            account_name: r.account_name,
            net_balance: parseFloat(r.net_balance || 0).toFixed(0)
        }));

        const totalBalance = filteredData.reduce((s, r) => s + parseFloat(r.net_balance || 0), 0);
        rows.push({
            account_code: 'TOTAL',
            account_name: '',
            net_balance: totalBalance.toFixed(0)
        });

        printTable(title, headers, rows, fields, companyInfo, reportMeta);
    };

    const handleExport = (format) => {
        const headers = ['Account Code', 'Account Name', 'Net Balance'];
        const fields = ['account_code', 'account_name', 'net_balance'];
        
        const rows = filteredData.map(r => ({
            account_code: r.account_code,
            account_name: r.account_name,
            net_balance: parseFloat(r.net_balance || 0).toFixed(0)
        }));

        const totalBalance = filteredData.reduce((s, r) => s + parseFloat(r.net_balance || 0), 0);
        rows.push({
            account_code: 'TOTAL',
            account_name: '',
            net_balance: totalBalance.toFixed(0)
        });

        if (format === 'EXCEL') {
            const filePrefix = type === 'RECEIVABLES' ? 'Receivables' : 'Payables';
            exportToCSV(`${filePrefix}_Report_${new Date().toISOString().split('T')[0]}`, headers, rows, fields);
        } else {
            printTable(title, headers, rows, fields, companyInfo, reportMeta);
        }
    };

    const totalNetBalance = filteredData.reduce((s, r) => s + parseFloat(r.net_balance || 0), 0);

    return (
        <div className="ledger-report-card animate-fade-in" style={{ padding: 24 }}>
            <div className="report-header" style={{ marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                    <h2 style={{ fontSize: '1.5rem', fontWeight: 800, margin: 0 }}>{title}</h2>
                    <p style={{ margin: '4px 0 0', color: '#64748b', fontSize: '0.875rem' }}>
                        Period: {fromDate ? new Date(fromDate).toLocaleDateString() : 'N/A'} to {toDate ? new Date(toDate).toLocaleDateString() : 'N/A'}
                    </p>
                </div>
                <div style={{ display: 'flex', gap: 10 }}>
                    <button className="btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: 6 }} onClick={handlePrint} disabled={loading || filteredData.length === 0}>
                        <Printer size={16} /> Print
                    </button>
                    <button className="btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: 6 }} onClick={() => setExportModal(true)} disabled={loading || filteredData.length === 0}>
                        <FileText size={16} /> Export
                    </button>
                </div>
            </div>

            {loading ? (
                <div style={{ padding: 60, textAlign: 'center', color: '#94a3b8' }}>Loading report data…</div>
            ) : error ? (
                <div style={{ padding: 40, textAlign: 'center', color: '#ef4444', background: '#fef2f2', borderRadius: 8, border: '1px solid #fca5a5' }}>
                    {error}
                </div>
            ) : reportData.length === 0 ? (
                <div style={{ padding: 60, textAlign: 'center', color: '#94a3b8' }}>
                    No child accounts found under the mapped parent account.
                </div>
            ) : (
                <div>
                    {/* Premium Search Bar */}
                    <div className="table-search-premium" style={{ marginBottom: '20px' }}>
                        <Search size={18} className="search-icon" />
                        <input
                            type="text"
                            placeholder="Search by Code or Name..."
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                        />
                    </div>

                    {filteredData.length === 0 ? (
                        <div style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>
                            No matching accounts found for "{searchQuery}".
                        </div>
                    ) : (
                        <div>
                            <table className="ledger-table">
                                <thead>
                                    <tr>
                                        <th>Account Code</th>
                                        <th>Account Name</th>
                                        <th className="text-right">Net Balance</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredData.map((row, i) => {
                                        const balance = parseFloat(row.net_balance || 0);
                                        return (
                                            <tr key={i}>
                                                <td>{row.account_code}</td>
                                                <td>{row.account_name}</td>
                                                <td className="text-right" style={{ fontWeight: 700, color: balance >= 0 ? '#0369a1' : '#dc2626' }}>
                                                    {balance.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                    <tr style={{ fontWeight: 800, background: '#f8fafc' }}>
                                        <td colSpan="2">TOTAL</td>
                                        <td className="text-right" style={{ color: totalNetBalance >= 0 ? '#0369a1' : '#dc2626' }}>
                                            {totalNetBalance.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}

            <ExportModal
                isOpen={exportModal}
                onClose={() => setExportModal(false)}
                title={title}
                onSelect={handleExport}
            />
        </div>
    );
};

export default ReceivablesPayablesReport;
