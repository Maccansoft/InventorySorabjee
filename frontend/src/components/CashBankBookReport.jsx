import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Wallet, Printer, FileText, Search, Loader } from 'lucide-react';
import { printTable, exportToCSV } from '../utils/exportUtils';
import { formatAcctAmt, formatShortDate } from '../utils/numberUtils';
import ExportModal from './common/ExportModal';

const API = '/api';

// ─── Flatten Accounts Helper ───────────────────────────────────────────────────
const flattenAccounts = (list) => {
    let result = [];
    (list || []).forEach(a => {
        if (!a.is_virtual) result.push(a);
        if (a.children && a.children.length > 0) result.push(...flattenAccounts(a.children));
    });
    return result.sort((a, b) => (a.account_code || '').localeCompare(b.account_code || ''));
};

// ─── Print & Export Handlers ─────────────────────────────────────────────────
const printCashBankBook = (reportData, companyInfo, reportMeta) => {
    const win = window.open('', '_blank');
    if (!win) return;

    const sections = (reportData.accounts || []).map(acct => {
        const rows = acct.transactions || [];
        const tableRows = rows.length > 0
            ? rows.map(r => `
                <tr>
                    <td>${formatShortDate(r.date)}</td>
                    <td>${r.voucher_no}</td>
                    <td>${r.voucher_type}</td>
                    <td>${r.particulars || ''}</td>
                    <td style="text-align:right; color:#10b981">${r.dr_amount > 0 ? formatAcctAmt(r.dr_amount) : '—'}</td>
                    <td style="text-align:right; color:#ef4444">${r.cr_amount > 0 ? formatAcctAmt(r.cr_amount) : '—'}</td>
                    <td style="text-align:right; font-weight:700; color:${r.running_balance >= 0 ? '#0369a1' : '#dc2626'}">${formatAcctAmt(r.running_balance)}</td>
                </tr>`).join('')
            : `<tr><td colspan="7" style="text-align:center;padding:20px;color:#94a3b8">No transactions in selected period.</td></tr>`;

        const totalsRow = `
            <tr style="font-weight:800; background:#f8fafc;">
                <td colspan="4">Totals</td>
                <td style="text-align:right">${formatAcctAmt(acct.totalDr)}</td>
                <td style="text-align:right">${formatAcctAmt(acct.totalCr)}</td>
                <td style="text-align:right">${formatAcctAmt(acct.closingBalance)}</td>
            </tr>`;

        return `
            <div class="ledger-section">
                <div class="acct-heading">
                    <span class="acct-name">${acct.account_name}</span>
                    <span class="acct-meta">Code: <b>${acct.account_code}</b> &nbsp;|&nbsp; Opening Balance: <b>${formatAcctAmt(acct.openingBalance)}</b></span>
                </div>
                <table>
                    <thead>
                        <tr>
                            <th>Date</th><th>Voucher</th><th>Type</th><th>Particulars</th>
                            <th style="text-align:right">Debit</th>
                            <th style="text-align:right">Credit</th>
                            <th style="text-align:right">Balance</th>
                        </tr>
                    </thead>
                    <tbody>${tableRows}${totalsRow}</tbody>
                </table>
            </div>`;
    }).join('');

    const grandTotalsRow = reportData.accounts?.length > 0 ? `
        <div style="margin-top: 30px; padding: 20px; border-top: 3px double #333;">
            <h3 style="margin: 0 0 10px; font-size: 16px;">Grand Totals</h3>
            <table style="width: 50%; font-size: 14px;">
                <tr><td style="width: 150px; font-weight: 600;">Total Debit</td><td style="text-align:right; color:#10b981; font-weight: 700;">${formatAcctAmt(reportData.grandTotals.dr)}</td></tr>
                <tr><td style="font-weight: 600;">Total Credit</td><td style="text-align:right; color:#ef4444; font-weight: 700;">${formatAcctAmt(reportData.grandTotals.cr)}</td></tr>
                <tr><td style="font-weight: 600;">Closing Balance</td><td style="text-align:right; font-weight: 700; color:${reportData.grandTotals.closing >= 0 ? '#0369a1' : '#dc2626'}">${formatAcctAmt(reportData.grandTotals.closing)}</td></tr>
            </table>
        </div>
    ` : '';

    const compName = companyInfo?.CompanyName || 'FA SYSTEM';
    const compAddr = companyInfo?.Address || '';
    const periodStr = reportMeta?.fromDate ? `${reportMeta.fromDate} to ${reportMeta.toDate || 'Present'}` : '';

    win.document.write(`
        <html>
        <head>
            <title>Daily Cash / Bank Book</title>
            <style>
                body { font-family: 'Segoe UI', Arial, sans-serif; padding: 30px; color: #333; }
                .report-header { display: flex; justify-content: space-between; border-bottom: 2px solid #333; padding-bottom: 16px; margin-bottom: 24px; }
                .company-info h1 { margin: 0; color: #0284c7; font-size: 22px; }
                .company-info p  { margin: 3px 0; font-size: 12px; color: #666; }
                .report-meta     { text-align: right; }
                .report-meta h2  { margin: 0; font-size: 16px; color: #475569; text-transform: uppercase; }
                .report-meta p   { margin: 3px 0; font-size: 11px; color: #64748b; }
                .ledger-section  { margin-bottom: 40px; page-break-inside: avoid; }
                .acct-heading    { background: #ede9fe; border-left: 4px solid #7c3aed; padding: 10px 14px; margin-bottom: 8px; border-radius: 4px; }
                .acct-name       { font-size: 15px; font-weight: 800; color: #0f172a; display: block; }
                .acct-meta       { font-size: 12px; color: #64748b; }
                table            { width: 100%; border-collapse: collapse; margin-top: 4px; font-size: 12px; }
                th               { background: #f1f5f9; border: 1px solid #e2e8f0; padding: 8px 10px; text-align: left; }
                td               { border: 1px solid #e2e8f0; padding: 8px 10px; }
                tr:nth-child(even) { background: #f8fafc; }
                .footer          { margin-top: 40px; text-align: center; font-size: 10px; color: #94a3b8; border-top: 1px dashed #e2e8f0; padding-top: 16px; }
                @media print { body { padding: 0; } .ledger-section { page-break-before: auto; } }
            </style>
        </head>
        <body>
            <div class="report-header">
                <div class="company-info">
                    <h1>${compName}</h1>
                    <p>${compAddr}</p>
                </div>
                <div class="report-meta">
                    <h2>Cash / Bank Book</h2>
                    ${periodStr ? `<p>Period: ${periodStr}</p>` : ''}
                    <p>Printed on: ${new Date().toLocaleString()}</p>
                    <p>Accounts: ${(reportData.accounts || []).length}</p>
                </div>
            </div>
            ${sections}
            ${grandTotalsRow}
            <div class="footer">Generated by MACCANSOFT Business Suite</div>
            <script>window.onload = () => window.print();</script>
        </body>
        </html>
    `);
    win.document.close();
};

const exportCashBankBookCSV = (reportData) => {
    const csvRows = [];
    (reportData.accounts || []).forEach((acct, idx) => {
        if (idx > 0) csvRows.push('');
        csvRows.push(`"=== ${acct.account_code} – ${acct.account_name} ==="`);
        csvRows.push(`"Opening Balance",,,,,,${formatAcctAmt(acct.openingBalance)}`);
        csvRows.push(`"Date","Voucher No","Type","Particulars","Debit","Credit","Running Balance"`);
        
        (acct.transactions || []).forEach(r => {
            csvRows.push([
                `"${r.date}"`,
                `"${r.voucher_no}"`,
                `"${r.voucher_type}"`,
                `"${String(r.particulars || '').replace(/"/g, '""')}"`,
                formatAcctAmt(r.dr_amount),
                formatAcctAmt(r.cr_amount),
                formatAcctAmt(r.running_balance)
            ].join(','));
        });
        csvRows.push(`"TOTALS",,,,${formatAcctAmt(acct.totalDr)},${formatAcctAmt(acct.totalCr)},${formatAcctAmt(acct.closingBalance)}`);
    });

    if (reportData.accounts?.length > 0) {
        csvRows.push('');
        csvRows.push(`"=== GRAND TOTALS ==="`);
        csvRows.push(`"Total Debit","${formatAcctAmt(reportData.grandTotals.dr)}"`);
        csvRows.push(`"Total Credit","${formatAcctAmt(reportData.grandTotals.cr)}"`);
        csvRows.push(`"Grand Closing Balance","${formatAcctAmt(reportData.grandTotals.closing)}"`);
    }

    const csvString = csvRows.join('\n');
    const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    if (link.download !== undefined) {
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', `Cash_Bank_Book_${new Date().toISOString().split('T')[0]}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
};

// ─── Main Component ───────────────────────────────────────────────────────────
const CashBankBookReport = ({ accounts, fromDate: propFromDate, toDate: propToDate, locationId, fiscalYearId, companyInfo, currentUser }) => {
    const allAccounts = flattenAccounts(accounts);
    
    // Find all potential Cash/Bank accounts based on name matching
    const cashBankAccounts = allAccounts.filter(a => {
        if (a.is_main) return false;
        const name = (a.account_name || '').toLowerCase();
        // It must be a leaf account under a cash/bank parent, but simpler to just filter leaves that have cash/bank in their own name or parent's name
        return name.includes('cash') || name.includes('bank') || 
               (a.parent_name || '').toLowerCase().includes('cash') || 
               (a.parent_name || '').toLowerCase().includes('bank');
    });

    const [fromDate, setFromDate] = useState(propFromDate);
    const [toDate, setToDate] = useState(propToDate);
    const [accountType, setAccountType] = useState('ALL');
    const [accountId, setAccountId] = useState('');
    const [reportData, setReportData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [exportModal, setExportModal] = useState(false);

    // Filter dropdown options
    const filteredDropdownAccounts = cashBankAccounts.filter(a => {
        if (accountType === 'ALL') return true;
        const name = (a.account_name || '').toLowerCase() + ' ' + (a.parent_name || '').toLowerCase();
        if (accountType === 'CASH' && name.includes('cash')) return true;
        if (accountType === 'BANK' && name.includes('bank')) return true;
        return false;
    });

    const fetchReport = async () => {
        setLoading(true);
        setReportData(null);
        try {
            const params = {
                fromDate,
                toDate,
                accountType,
                ...(accountId ? { accountId } : {}),
                ...(locationId ? { location_id: locationId } : { all_locations: 'true' }),
                ...(fiscalYearId ? { fiscal_year_id: fiscalYearId } : {})
            };
            const { data } = await axios.get(`${API}/reports/cash-bank-book`, { params });
            setReportData(data);
        } catch (e) {
            console.error('Fetch error:', e);
            alert('Failed to generate report');
        }
        setLoading(false);
    };

    const handleExport = (format) => {
        if (!reportData) return;
        const reportMeta = { fromDate, toDate, location: locationId ? 'Selected Location' : 'All Locations' };
        if (format === 'EXCEL') {
            exportCashBankBookCSV(reportData);
        } else {
            printCashBankBook(reportData, companyInfo, reportMeta);
        }
    };

    return (
        <div className="ledger-container animate-fade-in">
            {/* Filter Bar */}
            <div className="ledger-report-card" style={{ marginBottom: 20, padding: '20px 24px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                    <div style={{ width: 36, height: 36, borderRadius: 10, background: 'linear-gradient(135deg, #10b981, #059669)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <Wallet size={18} color="white" />
                    </div>
                    <div>
                        <h2 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: '#0f172a' }}>Daily Cash / Bank Book</h2>
                        <p style={{ margin: 0, fontSize: '0.8rem', color: '#64748b' }}>
                            View detailed cash and bank transactions chronologically.
                        </p>
                    </div>
                </div>

                <div className="form-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', alignItems: 'end' }}>
                    <div className="form-group">
                        <label>From Date</label>
                        <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} />
                    </div>
                    <div className="form-group">
                        <label>To Date</label>
                        <input type="date" value={toDate} onChange={e => setToDate(e.target.value)} />
                    </div>
                    <div className="form-group">
                        <label>Account Type</label>
                        <select value={accountType} onChange={e => { setAccountType(e.target.value); setAccountId(''); }}>
                            <option value="ALL">All (Cash + Bank)</option>
                            <option value="CASH">Cash Only</option>
                            <option value="BANK">Bank Only</option>
                        </select>
                    </div>
                    <div className="form-group">
                        <label>Account</label>
                        <select value={accountId} onChange={e => setAccountId(e.target.value)}>
                            <option value="">-- All Selected Types --</option>
                            {filteredDropdownAccounts.map(a => (
                                <option key={a.id} value={a.id}>{a.account_code} - {a.account_name}</option>
                            ))}
                        </select>
                    </div>
                    <div className="form-group" style={{ display: 'flex', gap: 8 }}>
                        <button className="btn-primary" onClick={fetchReport} disabled={loading} style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 6 }}>
                            {loading ? <Loader size={15} style={{ animation: 'spin 1s linear infinite' }} /> : <Search size={15} />}
                            Generate
                        </button>
                    </div>
                </div>
            </div>

            {/* Actions Bar */}
            {reportData && (
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginBottom: 16 }}>
                    <button className="btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px' }} onClick={() => printCashBankBook(reportData, companyInfo, { fromDate, toDate })} title="Print Report">
                        <Printer size={15} /> Print
                    </button>
                    <button className="btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px' }} onClick={() => setExportModal(true)} title="Export Report">
                        <FileText size={15} /> Export
                    </button>
                </div>
            )}

            {/* Report Data */}
            {loading ? (
                <div className="ledger-report-card" style={{ padding: 48, textAlign: 'center', color: '#94a3b8', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
                    <Loader size={18} style={{ animation: 'spin 1s linear infinite' }} /> Generating Report…
                </div>
            ) : reportData && reportData.accounts.length === 0 ? (
                <div className="ledger-report-card" style={{ padding: 48, textAlign: 'center', color: '#94a3b8' }}>
                    <Wallet size={36} style={{ margin: '0 auto 12px', display: 'block', opacity: 0.4 }} />
                    <p style={{ margin: 0, fontSize: '0.9rem' }}>No Cash or Bank transactions found for the selected criteria.</p>
                </div>
            ) : reportData ? (
                <div>
                    {reportData.accounts.map(acct => (
                        <div key={acct.id} className="ledger-report-card animate-fade-in" style={{ marginBottom: 24, padding: 24 }}>
                            <div className="report-header" style={{ marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                <div>
                                    <h2 style={{ fontSize: '1.25rem', color: '#0f172a', fontWeight: 800, margin: 0 }}>
                                        {acct.account_name}
                                    </h2>
                                    <p style={{ margin: '4px 0 0', color: '#64748b', fontSize: '0.875rem' }}>
                                        Code: <span style={{ fontWeight: 700, color: '#334155' }}>{acct.account_code}</span>
                                    </p>
                                </div>
                                <div style={{ textAlign: 'right' }}>
                                    <p style={{ margin: 0, fontSize: '0.85rem', color: '#64748b' }}>Opening Balance</p>
                                    <p style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: acct.openingBalance >= 0 ? '#0369a1' : '#dc2626' }}>
                                        {formatAcctAmt(acct.openingBalance)}
                                    </p>
                                </div>
                            </div>

                            <table className="ledger-table">
                                <thead>
                                    <tr>
                                        <th style={{ width: '10%' }}>Date</th>
                                        <th style={{ width: '15%' }}>Voucher No</th>
                                        <th style={{ width: '10%' }}>Type</th>
                                        <th style={{ width: '35%' }}>Particulars</th>
                                        <th style={{ width: '10%', textAlign: 'right' }}>Debit</th>
                                        <th style={{ width: '10%', textAlign: 'right' }}>Credit</th>
                                        <th style={{ width: '10%', textAlign: 'right' }}>Balance</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {acct.transactions.length === 0 ? (
                                        <tr>
                                            <td colSpan="7" style={{ textAlign: 'center', padding: '24px', color: '#94a3b8' }}>No transactions in this period.</td>
                                        </tr>
                                    ) : (
                                        acct.transactions.map((t, i) => (
                                            <tr key={i}>
                                                <td>{formatShortDate(t.date)}</td>
                                                <td><span style={{ fontFamily: 'monospace', fontWeight: 600 }}>{t.voucher_no}</span></td>
                                                <td><span className="badge-type">{t.voucher_type}</span></td>
                                                <td>{t.particulars || '—'}</td>
                                                <td style={{ textAlign: 'right', color: '#10b981', fontWeight: 600 }}>
                                                    {t.dr_amount > 0 ? formatAcctAmt(t.dr_amount) : '—'}
                                                </td>
                                                <td style={{ textAlign: 'right', color: '#ef4444', fontWeight: 600 }}>
                                                    {t.cr_amount > 0 ? formatAcctAmt(t.cr_amount) : '—'}
                                                </td>
                                                <td style={{ textAlign: 'right', fontWeight: 700, color: t.running_balance >= 0 ? '#0369a1' : '#dc2626' }}>
                                                    {formatAcctAmt(t.running_balance)}
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                                <tfoot>
                                    <tr style={{ fontWeight: 800, background: '#f8fafc' }}>
                                        <td colSpan="4">Totals</td>
                                        <td style={{ textAlign: 'right', color: '#10b981' }}>{formatAcctAmt(acct.totalDr)}</td>
                                        <td style={{ textAlign: 'right', color: '#ef4444' }}>{formatAcctAmt(acct.totalCr)}</td>
                                        <td style={{ textAlign: 'right', color: acct.closingBalance >= 0 ? '#0369a1' : '#dc2626' }}>{formatAcctAmt(acct.closingBalance)}</td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    ))}

                    <div className="ledger-report-card animate-fade-in" style={{ padding: 24, background: '#f8fafc', border: '2px solid #e2e8f0' }}>
                        <h3 style={{ margin: '0 0 16px', fontSize: '1.2rem', color: '#0f172a' }}>Grand Totals</h3>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
                            <div style={{ padding: 16, background: '#fff', borderRadius: 8, border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                                <p style={{ margin: 0, fontSize: '0.85rem', color: '#64748b' }}>Total Debit</p>
                                <p style={{ margin: '4px 0 0', fontSize: '1.4rem', fontWeight: 800, color: '#10b981' }}>{formatAcctAmt(reportData.grandTotals.dr)}</p>
                            </div>
                            <div style={{ padding: 16, background: '#fff', borderRadius: 8, border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                                <p style={{ margin: 0, fontSize: '0.85rem', color: '#64748b' }}>Total Credit</p>
                                <p style={{ margin: '4px 0 0', fontSize: '1.4rem', fontWeight: 800, color: '#ef4444' }}>{formatAcctAmt(reportData.grandTotals.cr)}</p>
                            </div>
                            <div style={{ padding: 16, background: '#fff', borderRadius: 8, border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                                <p style={{ margin: 0, fontSize: '0.85rem', color: '#64748b' }}>Grand Closing Balance</p>
                                <p style={{ margin: '4px 0 0', fontSize: '1.4rem', fontWeight: 800, color: reportData.grandTotals.closing >= 0 ? '#0369a1' : '#dc2626' }}>{formatAcctAmt(reportData.grandTotals.closing)}</p>
                            </div>
                        </div>
                    </div>
                </div>
            ) : null}

            <ExportModal
                isOpen={exportModal}
                onClose={() => setExportModal(false)}
                title="Cash / Bank Book"
                onSelect={handleExport}
            />

            <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
        </div>
    );
};

export default React.memo(CashBankBookReport);
