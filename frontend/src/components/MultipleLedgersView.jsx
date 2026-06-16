import React, { useState, useCallback } from 'react';
import axios from 'axios';
import { TrendingUp, Printer, FileText, X, Loader, Layers, Search, XCircle } from 'lucide-react';
import { printTable, exportToCSV } from '../utils/exportUtils';
import { formatAcctAmt } from '../utils/numberUtils';
import ExportModal from './common/ExportModal';

const API = '/api';

// ─── helpers ─────────────────────────────────────────────────────────────────

/**
 * Flatten the account tree/flat list into a sorted array.
 * Works with both tree (has .children) and flat (no .children) structures.
 */
const flattenAccounts = (list) => {
    let result = [];
    (list || []).forEach(a => {
        if (!a.is_virtual) result.push(a);       // skip virtual location-group nodes
        if (a.children && a.children.length > 0) result.push(...flattenAccounts(a.children));
    });
    // Sort by account_code
    return result
        .filter(a => a.id && !a.is_virtual)
        .sort((a, b) => (a.account_code || '').localeCompare(b.account_code || ''));
};

/**
 * Determine which account IDs are parents (have child accounts under them).
 * Uses the flat list: any account whose id appears as parent_id of another is a parent.
 * Also treats is_main == 1 accounts as parents (top-level heads).
 */
const buildParentIdSet = (flatList) => {
    const parentIds = new Set();
    flatList.forEach(a => {
        // is_main = 1 means it's a main group head
        if (a.is_main == 1 || a.is_main === true) {
            parentIds.add(String(a.id));
        }
        // if any account points to this one as parent
        if (a.parent_id !== null && a.parent_id !== undefined) {
            parentIds.add(String(a.parent_id));
        }
    });
    return parentIds;
};

const LEDGER_HEADERS = ['Date', 'Voucher', 'Type', 'Description', 'Debit', 'Credit', 'Balance'];
const LEDGER_FIELDS  = ['date', 'vno', 'type', 'desc', 'dr', 'cr', 'bal'];

const buildLedgerExportRows = (ledger) =>
    (ledger || []).map(r => ({
        date: r.date || '',
        vno:  r.voucher_no || '',
        type: r.voucher_type || '',
        desc: r.description || '',
        dr:   parseFloat(r.dr_amount || 0),
        cr:   parseFloat(r.cr_amount || 0),
        bal:  parseFloat(r.balance || 0),
    }));

// ─── Combined Print All — opens ONE print window with all ledgers ─────────────
const printAllLedgers = (selectedIds, allAccounts, ledgerMap, companyInfo, reportMeta) => {
    const win = window.open('', '_blank');
    if (!win) return;

    const sections = selectedIds.map(id => {
        const acct = allAccounts.find(a => String(a.id) === id);
        if (!acct) return '';
        const ledger = ledgerMap[id]?.data || [];
        const rows   = buildLedgerExportRows(ledger);

        const tableRows = rows.length > 0
            ? rows.map(r => `
                <tr>
                    <td>${r.date}</td>
                    <td>${r.vno}</td>
                    <td>${r.type}</td>
                    <td>${r.desc}</td>
                    <td style="text-align:right; color:#10b981">${r.dr > 0 ? formatAcctAmt(r.dr) : '—'}</td>
                    <td style="text-align:right; color:#ef4444">${r.cr > 0 ? formatAcctAmt(r.cr) : '—'}</td>
                    <td style="text-align:right; font-weight:700; color:${r.bal >= 0 ? '#0369a1' : '#dc2626'}">${formatAcctAmt(r.bal)}</td>
                </tr>`).join('')
            : `<tr><td colspan="7" style="text-align:center;padding:20px;color:#94a3b8">No transactions in selected period.</td></tr>`;

        const totalDr  = rows.reduce((s, r) => s + r.dr, 0);
        const totalCr  = rows.reduce((s, r) => s + r.cr, 0);
        const lastBal  = rows.length > 0 ? rows[rows.length - 1].bal : 0;

        const totalsRow = rows.length > 0 ? `
            <tr style="font-weight:800; background:#f8fafc;">
                <td colspan="4">Totals</td>
                <td style="text-align:right">${formatAcctAmt(totalDr)}</td>
                <td style="text-align:right">${formatAcctAmt(totalCr)}</td>
                <td style="text-align:right">${formatAcctAmt(lastBal)}</td>
            </tr>` : '';

        return `
            <div class="ledger-section">
                <div class="acct-heading">
                    <span class="acct-name">${acct.account_name}</span>
                    <span class="acct-meta">Code: <b>${acct.account_code}</b> &nbsp;|&nbsp; Type: ${acct.account_type}</span>
                </div>
                <table>
                    <thead>
                        <tr>
                            <th>Date</th><th>Voucher</th><th>Type</th><th>Description</th>
                            <th style="text-align:right">Debit</th>
                            <th style="text-align:right">Credit</th>
                            <th style="text-align:right">Balance</th>
                        </tr>
                    </thead>
                    <tbody>${tableRows}${totalsRow}</tbody>
                </table>
            </div>`;
    }).join('');

    const compName   = companyInfo?.CompanyName || 'FA SYSTEM';
    const compAddr   = companyInfo?.Address || '';
    const periodStr  = reportMeta?.fromDate ? `${reportMeta.fromDate} to ${reportMeta.toDate || 'Present'}` : '';
    const fyStr      = reportMeta?.fiscalYear || '';
    const locStr     = reportMeta?.location   || '';

    win.document.write(`
        <html>
        <head>
            <title>Multiple Ledgers Report</title>
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
                .acct-meta       { font-size: 11px; color: #64748b; }
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
                    <h2>Multiple Ledgers Report</h2>
                    ${periodStr ? `<p>Period: ${periodStr}</p>` : ''}
                    ${fyStr     ? `<p>Fiscal Year: ${fyStr}</p>` : ''}
                    ${locStr    ? `<p>Location: ${locStr}</p>`   : ''}
                    <p>Printed on: ${new Date().toLocaleString()}</p>
                    <p>Accounts: ${selectedIds.length}</p>
                </div>
            </div>
            ${sections}
            <div class="footer">Generated by MACCANSOFT Business Suite</div>
            <script>window.onload = () => window.print();</script>
        </body>
        </html>
    `);
    win.document.close();
};

// ─── Combined CSV Export All — single CSV with sections per account ───────────
const exportAllLedgersCSV = (selectedIds, allAccounts, ledgerMap) => {
    const csvRows = [];

    selectedIds.forEach((id, idx) => {
        const acct = allAccounts.find(a => String(a.id) === id);
        if (!acct) return;
        const ledger = ledgerMap[id]?.data || [];
        const rows   = buildLedgerExportRows(ledger);

        if (idx > 0) csvRows.push(''); // blank separator row between accounts

        // Account heading row
        csvRows.push(`"=== ${acct.account_code} – ${acct.account_name} (${acct.account_type}) ==="`);
        // Column headers
        csvRows.push(LEDGER_HEADERS.map(h => `"${h}"`).join(','));

        if (rows.length === 0) {
            csvRows.push('"No transactions in selected period.",,,,,, ');
        } else {
            rows.forEach(r => {
                csvRows.push([
                    `"${r.date}"`,
                    `"${r.vno}"`,
                    `"${r.type}"`,
                    `"${String(r.desc).replace(/"/g, '""')}"`,
                    r.dr,
                    r.cr,
                    r.bal
                ].join(','));
            });
            // Totals
            const totalDr = rows.reduce((s, r) => s + r.dr, 0);
            const totalCr = rows.reduce((s, r) => s + r.cr, 0);
            const lastBal = rows[rows.length - 1]?.bal ?? 0;
            csvRows.push(`"TOTALS",,,, ${formatAcctAmt(totalDr)},${formatAcctAmt(totalCr)},${formatAcctAmt(lastBal)}`);
        }
    });

    const csvString = csvRows.join('\n');
    const blob      = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
    const link      = document.createElement('a');
    if (link.download !== undefined) {
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', `Multiple_Ledgers_${new Date().toISOString().split('T')[0]}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
};

// ─── LedgerTab — one account's ledger table ──────────────────────────────────

const LedgerTab = ({ accountInfo, ledger, loading, companyInfo, reportMeta }) => {
    const [exportModal, setExportModal] = useState(false);

    const exportRows  = buildLedgerExportRows(ledger);
    const reportTitle = `Ledger: ${accountInfo.account_name}`;

    const handlePrint = () =>
        printTable(reportTitle, LEDGER_HEADERS, exportRows, LEDGER_FIELDS, companyInfo, reportMeta);

    const handleExport = (format) => {
        if (format === 'EXCEL') {
            exportToCSV(`Ledger_${accountInfo.account_code}`, LEDGER_HEADERS, exportRows, LEDGER_FIELDS);
        } else {
            printTable(reportTitle, LEDGER_HEADERS, exportRows, LEDGER_FIELDS, companyInfo, reportMeta);
        }
    };

    return (
        <div className="ledger-report-card animate-fade-in" style={{ padding: 24 }}>
            <div className="report-header" style={{ marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                    <h2 style={{ fontSize: '1.4rem', color: '#0f172a', fontWeight: 800, margin: 0 }}>
                        {accountInfo.account_name}
                    </h2>
                    <p style={{ margin: '4px 0 0', color: '#64748b', fontSize: '0.875rem' }}>
                        Code: <span style={{ fontWeight: 700, color: '#334155' }}>{accountInfo.account_code}</span>
                        &nbsp;|&nbsp;
                        Type: <span className="badge-type">{accountInfo.account_type}</span>
                    </p>
                </div>
                <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                    <button className="btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px' }} onClick={handlePrint} title="Print this ledger">
                        <Printer size={15} /> Print
                    </button>
                    <button className="btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px' }} onClick={() => setExportModal(true)} title="Export this ledger">
                        <FileText size={15} /> Export
                    </button>
                </div>
            </div>

            {loading ? (
                <div style={{ padding: 48, textAlign: 'center', color: '#94a3b8', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
                    <Loader size={18} style={{ animation: 'spin 1s linear infinite' }} /> Loading…
                </div>
            ) : ledger.length === 0 ? (
                <div style={{ padding: 48, textAlign: 'center', color: '#94a3b8' }}>
                    No transactions found for this account in the selected date range.
                </div>
            ) : (
                <table className="ledger-table">
                    <thead>
                        <tr>
                            <th>Date</th>
                            <th>Voucher No</th>
                            <th>Type</th>
                            <th>Description</th>
                            <th className="text-right">Debit</th>
                            <th className="text-right">Credit</th>
                            <th className="text-right">Balance</th>
                        </tr>
                    </thead>
                    <tbody>
                        {ledger.map((row, i) => (
                            <tr key={i}>
                                <td>{row.date}</td>
                                <td>{row.voucher_no}</td>
                                <td><span className="badge-type">{row.voucher_type}</span></td>
                                <td>{row.description}</td>
                                <td className="text-right" style={{ color: '#10b981' }}>
                                    {parseFloat(row.dr_amount || 0) > 0 ? formatAcctAmt(row.dr_amount) : '—'}
                                </td>
                                <td className="text-right" style={{ color: '#ef4444' }}>
                                    {parseFloat(row.cr_amount || 0) > 0 ? formatAcctAmt(row.cr_amount) : '—'}
                                </td>
                                <td className="text-right" style={{ fontWeight: 700, color: parseFloat(row.balance) >= 0 ? '#0369a1' : '#dc2626' }}>
                                    {formatAcctAmt(row.balance)}
                                </td>
                            </tr>
                        ))}
                        <tr style={{ fontWeight: 800, background: '#f8fafc' }}>
                            <td colSpan="4">Totals</td>
                            <td className="text-right">{formatAcctAmt(ledger.reduce((s, r) => s + parseFloat(r.dr_amount || 0), 0))}</td>
                            <td className="text-right">{formatAcctAmt(ledger.reduce((s, r) => s + parseFloat(r.cr_amount || 0), 0))}</td>
                            <td className="text-right">{formatAcctAmt(parseFloat(ledger[ledger.length - 1]?.balance || 0))}</td>
                        </tr>
                    </tbody>
                </table>
            )}

            <ExportModal
                isOpen={exportModal}
                onClose={() => setExportModal(false)}
                title={reportTitle}
                onSelect={(format) => { handleExport(format); }}
            />

            <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
        </div>
    );
};

// ─── Main component ───────────────────────────────────────────────────────────

const MultipleLedgersView = ({ accounts, fromDate, toDate, locationId, fiscalYearId, companyInfo, reportMeta }) => {
    const allAccounts  = flattenAccounts(accounts);
    // Build set of parent account IDs (cannot be selected)
    const parentIdSet  = buildParentIdSet(allAccounts);

    // ── State ────────────────────────────────────────────────────────────────
    const [selectedIds,  setSelectedIds]  = useState([]);   // string[]
    const [ledgerMap,    setLedgerMap]    = useState({});   // { [id]: { data, loading, error } }
    const [activeTabId,  setActiveTabId]  = useState(null);
    const [accountSearch,setAccountSearch]= useState('');
    const [exportAllModal, setExportAllModal] = useState(false);

    // ── Filtered + sorted account list ───────────────────────────────────────
    const filteredAccounts = allAccounts.filter(a => {
        const q = accountSearch.toLowerCase();
        return (
            (a.account_code || '').toLowerCase().includes(q) ||
            (a.account_name || '').toLowerCase().includes(q)
        );
    });

    // ── Fetch one ledger ─────────────────────────────────────────────────────
    const fetchLedger = useCallback(async (accountId) => {
        if (!accountId) return;
        setLedgerMap(prev => ({
            ...prev,
            [accountId]: { data: prev[accountId]?.data || [], loading: true, error: false }
        }));
        try {
            const { data } = await axios.get(`${API}/ledger/${accountId}`, {
                params: {
                    fromDate,
                    toDate,
                    ...(locationId   ? { location_id: locationId }   : { all_locations: 'true' }),
                    ...(fiscalYearId ? { fiscal_year_id: fiscalYearId } : {}),
                }
            });
            setLedgerMap(prev => ({
                ...prev,
                [accountId]: { data: Array.isArray(data) ? data : [], loading: false, error: false }
            }));
        } catch (e) {
            console.error(`[MultipleLedgers] Fetch error for ${accountId}:`, e);
            setLedgerMap(prev => ({
                ...prev,
                [accountId]: { data: [], loading: false, error: true }
            }));
        }
    }, [fromDate, toDate, locationId, fiscalYearId]);

    // ── Toggle account selection (also guards against parent accounts) ────────
    const toggleAccount = (accountId) => {
        const id = String(accountId);

        // Hard guard: parent accounts cannot be selected
        if (parentIdSet.has(id)) return;

        if (selectedIds.includes(id)) {
            // ── DESELECT ──
            const remaining = selectedIds.filter(x => x !== id);
            setSelectedIds(remaining);
            setLedgerMap(prev => {
                const next = { ...prev };
                delete next[id];
                return next;
            });
            // If it was the active tab, switch to last remaining
            if (activeTabId === id) {
                setActiveTabId(remaining.length > 0 ? remaining[remaining.length - 1] : null);
            }
        } else {
            // ── SELECT ──
            setSelectedIds(prev => [...prev, id]);
            setActiveTabId(id);
            fetchLedger(id);
        }
    };

    // ── Remove via tab close button ───────────────────────────────────────────
    const removeTab = (accountId) => {
        const id       = String(accountId);
        const remaining = selectedIds.filter(x => x !== id);
        setSelectedIds(remaining);
        setLedgerMap(prev => {
            const next = { ...prev };
            delete next[id];
            return next;
        });
        if (activeTabId === id) {
            setActiveTabId(remaining.length > 0 ? remaining[remaining.length - 1] : null);
        }
    };

    // ── Clear all ─────────────────────────────────────────────────────────────
    const clearAll = () => {
        setSelectedIds([]);
        setLedgerMap({});
        setActiveTabId(null);
    };

    // ── Refresh all ───────────────────────────────────────────────────────────
    const refreshAll = () => selectedIds.forEach(id => fetchLedger(id));

    // ── Print All (single window, all sections) ───────────────────────────────
    const handlePrintAll = () =>
        printAllLedgers(selectedIds, allAccounts, ledgerMap, companyInfo, reportMeta);

    // ── Export All handler (from modal) ───────────────────────────────────────
    const handleExportAll = (format) => {
        if (format === 'EXCEL') {
            exportAllLedgersCSV(selectedIds, allAccounts, ledgerMap);
        } else {
            // PDF → print all
            printAllLedgers(selectedIds, allAccounts, ledgerMap, companyInfo, reportMeta);
        }
    };

    // ── Derived ───────────────────────────────────────────────────────────────
    const activeAccount = activeTabId ? allAccounts.find(a => String(a.id) === activeTabId) : null;
    const activeLedger  = activeTabId ? (ledgerMap[activeTabId] || { data: [], loading: false, error: false }) : null;

    return (
        <div className="ledger-container animate-fade-in">

            {/* ── Header card ── */}
            <div className="ledger-report-card" style={{ marginBottom: 20, padding: '20px 24px' }}>

                {/* Top row: title + bulk actions */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
                    <div style={{ width: 36, height: 36, borderRadius: 10, background: 'linear-gradient(135deg, #6d28d9, #7c3aed)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <Layers size={18} color="white" />
                    </div>
                    <div>
                        <h2 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: '#0f172a' }}>Multiple Ledgers</h2>
                        <p style={{ margin: 0, fontSize: '0.8rem', color: '#64748b' }}>
                            Select child accounts below — blue parent accounts cannot be selected.
                        </p>
                    </div>

                    {selectedIds.length > 0 && (
                        <div style={{ marginLeft: 'auto', display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                            <button
                                className="btn-secondary"
                                style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 11px', fontSize: '0.78rem' }}
                                onClick={refreshAll}
                                title="Reload all ledgers with current date range"
                            >
                                <TrendingUp size={13} /> Refresh All
                            </button>
                            <button
                                className="btn-secondary"
                                style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 11px', fontSize: '0.78rem' }}
                                onClick={handlePrintAll}
                                title="Print all selected ledgers in one document"
                            >
                                <Printer size={13} /> Print All
                            </button>
                            <button
                                className="btn-secondary"
                                style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 11px', fontSize: '0.78rem' }}
                                onClick={() => setExportAllModal(true)}
                                title="Export all selected ledgers"
                            >
                                <FileText size={13} /> Export All
                            </button>
                            <button
                                style={{
                                    display: 'flex', alignItems: 'center', gap: 5,
                                    padding: '6px 11px', fontSize: '0.78rem',
                                    border: '1px solid #fca5a5', borderRadius: 8,
                                    background: '#fef2f2', color: '#dc2626',
                                    cursor: 'pointer', fontWeight: 600,
                                }}
                                onClick={clearAll}
                                title="Clear all selected accounts"
                            >
                                <XCircle size={13} /> Clear All
                            </button>
                        </div>
                    )}
                </div>

                {/* ── Selected-account chips ── */}
                {selectedIds.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
                        {selectedIds.map(id => {
                            const acct = allAccounts.find(a => String(a.id) === id);
                            if (!acct) return null;
                            return (
                                <div key={id} style={{
                                    display: 'flex', alignItems: 'center', gap: 5,
                                    padding: '3px 8px 3px 10px',
                                    background: '#ede9fe', border: '1px solid #c4b5fd',
                                    borderRadius: 20, fontSize: '0.78rem', fontWeight: 600,
                                    color: '#5b21b6',
                                }}>
                                    <span>{acct.account_code} – {acct.account_name}</span>
                                    <button
                                        onClick={() => toggleAccount(id)}
                                        style={{
                                            background: 'none', border: 'none', cursor: 'pointer',
                                            color: '#7c3aed', padding: '0 2px',
                                            display: 'flex', alignItems: 'center',
                                        }}
                                        title={`Remove ${acct.account_name}`}
                                        onMouseEnter={e => e.currentTarget.style.color = '#dc2626'}
                                        onMouseLeave={e => e.currentTarget.style.color = '#7c3aed'}
                                    >
                                        <X size={11} />
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                )}

                {/* ── Account search input ── */}
                <div style={{ position: 'relative', marginBottom: 10 }}>
                    <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', pointerEvents: 'none' }} />
                    <input
                        type="text"
                        placeholder="Search accounts by code or name…"
                        value={accountSearch}
                        onChange={e => setAccountSearch(e.target.value)}
                        style={{
                            width: '100%', padding: '8px 12px 8px 32px',
                            border: '1px solid #e2e8f0', borderRadius: 8,
                            fontSize: '0.85rem', outline: 'none',
                            boxSizing: 'border-box', background: '#f8fafc',
                        }}
                    />
                </div>

                {/* ── Scrollable account list ── */}
                <div style={{ border: '1px solid #e2e8f0', borderRadius: 10, maxHeight: 230, overflowY: 'auto', background: 'white' }}>
                    {filteredAccounts.length === 0 ? (
                        <div style={{ padding: '16px 12px', color: '#94a3b8', fontSize: '0.85rem', textAlign: 'center' }}>
                            No accounts match your search.
                        </div>
                    ) : (
                        filteredAccounts.map(acct => {
                            const id         = String(acct.id);
                            const isParent   = parentIdSet.has(id);
                            const isSelected = !isParent && selectedIds.includes(id);

                            // Row styling
                            let rowBg     = isSelected ? '#ede9fe' : 'white';
                            let rowCursor = isParent ? 'default' : 'pointer';
                            let codeColor = isParent ? '#2563eb' : '#475569';
                            let nameColor = isParent ? '#1d4ed8' : '#1e293b';

                            return (
                                <div
                                    key={id}
                                    onClick={() => !isParent && toggleAccount(id)}
                                    style={{
                                        padding: '8px 12px',
                                        cursor: rowCursor,
                                        display: 'flex', alignItems: 'center', gap: 10,
                                        borderBottom: '1px solid #f1f5f9',
                                        background: rowBg,
                                        transition: 'background 0.12s',
                                        opacity: isParent ? 0.85 : 1,
                                    }}
                                    onMouseEnter={e => { if (!isParent && !isSelected) e.currentTarget.style.background = '#f5f3ff'; }}
                                    onMouseLeave={e => { if (!isParent && !isSelected) e.currentTarget.style.background = 'white'; }}
                                    title={isParent ? `${acct.account_name} — Parent account (not selectable)` : `${isSelected ? 'Unselect' : 'Select'}: ${acct.account_name}`}
                                >
                                    {/* Checkbox / lock indicator */}
                                    {isParent ? (
                                        <div style={{
                                            width: 16, height: 16, borderRadius: 4, flexShrink: 0,
                                            border: '2px solid #93c5fd', background: '#eff6ff',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        }}>
                                            {/* folder icon hint */}
                                            <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
                                                <path d="M1 2.5h6M1 2.5v4h6v-4" stroke="#3b82f6" strokeWidth="1.4" strokeLinecap="round"/>
                                            </svg>
                                        </div>
                                    ) : (
                                        <div style={{
                                            width: 16, height: 16, borderRadius: 4, flexShrink: 0,
                                            border: `2px solid ${isSelected ? '#7c3aed' : '#cbd5e1'}`,
                                            background: isSelected ? '#7c3aed' : 'white',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            transition: 'all 0.15s',
                                        }}>
                                            {isSelected && (
                                                <svg width="9" height="7" viewBox="0 0 9 7" fill="none">
                                                    <path d="M1 3.5L3.5 6L8 1" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                                                </svg>
                                            )}
                                        </div>
                                    )}

                                    {/* Account code */}
                                    <span style={{ fontWeight: 700, color: codeColor, fontSize: '0.78rem', minWidth: 70, flexShrink: 0 }}>
                                        {acct.account_code}
                                    </span>

                                    {/* Account name */}
                                    <span style={{ fontSize: '0.85rem', color: nameColor, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: isParent ? 700 : 400 }}>
                                        {acct.account_name}
                                    </span>

                                    {/* Type badge + parent label */}
                                    <span style={{
                                        fontSize: '0.68rem', fontWeight: 700, padding: '2px 6px',
                                        borderRadius: 4, flexShrink: 0,
                                        background: isParent ? '#dbeafe' : '#f1f5f9',
                                        color:      isParent ? '#1d4ed8' : '#64748b',
                                    }}>
                                        {acct.account_type}{isParent ? ' · Parent' : ''}
                                    </span>
                                </div>
                            );
                        })
                    )}
                </div>

                <p style={{ margin: '6px 0 0', fontSize: '0.75rem', color: '#94a3b8' }}>
                    {selectedIds.length === 0
                        ? 'Click child accounts (non-blue) to open their ledgers as tabs.'
                        : `${selectedIds.length} account${selectedIds.length > 1 ? 's' : ''} selected. Blue rows are parent accounts and cannot be selected.`}
                </p>
            </div>

            {/* ── Tab bar ── */}
            {selectedIds.length > 0 && (
                <div style={{ marginBottom: 0 }}>
                    <div
                        className="premium-scrollbar"
                        style={{
                            display: 'flex', gap: 4, flexWrap: 'nowrap',
                            overflowX: 'auto', borderBottom: '2px solid #e2e8f0',
                            paddingBottom: 0, paddingLeft: 4, paddingRight: 4,
                        }}
                    >
                        {selectedIds.map(id => {
                            const acct     = allAccounts.find(a => String(a.id) === id);
                            if (!acct) return null;
                            const isActive  = activeTabId === id;
                            const isLoading = ledgerMap[id]?.loading;

                            return (
                                <div
                                    key={id}
                                    onClick={() => setActiveTabId(id)}
                                    title={`${acct.account_code} – ${acct.account_name}`}
                                    style={{
                                        display: 'flex', alignItems: 'center', gap: 6,
                                        padding: '10px 16px', cursor: 'pointer',
                                        borderRadius: '8px 8px 0 0',
                                        border: `1px solid ${isActive ? '#e2e8f0' : 'transparent'}`,
                                        borderBottom: isActive ? '2px solid white' : '2px solid transparent',
                                        background: isActive ? 'white' : 'transparent',
                                        marginBottom: isActive ? '-2px' : '0',
                                        fontWeight: isActive ? 700 : 500,
                                        fontSize: '0.82rem',
                                        color: isActive ? '#6d28d9' : '#64748b',
                                        flexShrink: 0, transition: 'all 0.15s',
                                        whiteSpace: 'nowrap', userSelect: 'none',
                                    }}
                                >
                                    {isLoading && <Loader size={12} style={{ animation: 'spin 1s linear infinite', flexShrink: 0 }} />}
                                    <span style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                        {acct.account_code} – {acct.account_name}
                                    </span>
                                    <button
                                        onClick={e => { e.stopPropagation(); removeTab(id); }}
                                        style={{
                                            background: 'none', border: 'none', cursor: 'pointer',
                                            color: isActive ? '#7c3aed' : '#94a3b8',
                                            padding: '1px 2px', borderRadius: 4,
                                            display: 'flex', alignItems: 'center',
                                            transition: 'color 0.15s', flexShrink: 0,
                                        }}
                                        title="Remove this tab"
                                        onMouseEnter={e => e.currentTarget.style.color = '#ef4444'}
                                        onMouseLeave={e => e.currentTarget.style.color = isActive ? '#7c3aed' : '#94a3b8'}
                                    >
                                        <X size={12} />
                                    </button>
                                </div>
                            );
                        })}
                    </div>

                    {/* Active tab content */}
                    {activeAccount && activeLedger && (
                        <LedgerTab
                            key={activeTabId}
                            accountInfo={activeAccount}
                            ledger={activeLedger.data}
                            loading={activeLedger.loading}
                            companyInfo={companyInfo}
                            reportMeta={reportMeta}
                        />
                    )}
                </div>
            )}

            {/* Empty placeholder */}
            {selectedIds.length === 0 && (
                <div className="ledger-report-card" style={{ padding: 48, textAlign: 'center', color: '#94a3b8' }}>
                    <Layers size={36} style={{ margin: '0 auto 12px', display: 'block', opacity: 0.4 }} />
                    <p style={{ margin: 0, fontSize: '0.9rem' }}>
                        Select one or more child accounts from the list above to view their ledgers.
                    </p>
                </div>
            )}

            {/* Export All modal */}
            <ExportModal
                isOpen={exportAllModal}
                onClose={() => setExportAllModal(false)}
                title={`All Selected Ledgers (${selectedIds.length})`}
                onSelect={(format) => { handleExportAll(format); }}
            />

            <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
        </div>
    );
};

export default MultipleLedgersView;
