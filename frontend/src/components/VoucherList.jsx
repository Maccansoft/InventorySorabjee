import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
    Edit2, Trash2, Eye, Plus, RefreshCw, Filter,
    CreditCard, Banknote, Wifi, AlignJustify, Printer, FileText
} from 'lucide-react';
import { printTable, exportToCSV } from '../utils/exportUtils';
import ExportModal from './common/ExportModal';

const API = '/api';

const numberToWords = (amount) => {
    if (amount === 0) return "Zero Only";

    const units = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
    const tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];
    const scales = ["", "Thousand", "Million", "Billion", "Trillion"];

    const convertChunk = (num) => {
        let str = "";
        if (num >= 100) {
            str += units[Math.floor(num / 100)] + " Hundred ";
            num %= 100;
        }
        if (num >= 20) {
            str += tens[Math.floor(num / 10)] + " ";
            num %= 10;
        }
        if (num > 0) {
            str += units[num] + " ";
        }
        return str.trim();
    };

    let [integerPart, decimalPart] = amount.toString().split(".");
    let num = parseInt(integerPart);
    let words = "";
    let scaleIndex = 0;

    while (num > 0) {
        let chunk = num % 1000;
        if (chunk > 0) {
            words = convertChunk(chunk) + " " + scales[scaleIndex] + " " + words;
        }
        num = Math.floor(num / 1000);
        scaleIndex++;
    }

    words = words.trim() + " Rupees";

    if (decimalPart) {
        let paisa = parseInt(decimalPart.substring(0, 2).padEnd(2, '0'));
        if (paisa > 0) {
            words += " and " + convertChunk(paisa) + " Paisa";
        }
    }

    return words + " Only";
};

// ── Voucher detail modal with Print action ──────────────────────────────────
const VoucherDetailModal = ({ voucher, companyInfo, onPrint, onClose }) => {
    if (!voucher) return null;
    const totalDr = (voucher.entries || []).reduce((s, e) => s + parseFloat(e.dr_amount || 0), 0);
    const totalCr = (voucher.entries || []).reduce((s, e) => s + parseFloat(e.cr_amount || 0), 0);

    return (
        <div className="modal-backdrop" onClick={onClose}>
            <div className="modal-content animate-fade-in"
                style={{ maxWidth: 680 }}
                onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <div>
                        <div style={{ fontSize: '1.2rem', color: '#0284c7', fontWeight: 800, marginBottom: 4 }}>
                            {companyInfo?.CompanyName || 'FA SYSTEM'}
                        </div>
                        <div style={{ fontSize: '0.85rem', color: '#475569', lineHeight: 1.5 }}>
                            <div>{companyInfo?.Address}</div>
                            <div>
                                {companyInfo?.Contact && <span style={{ marginRight: 12 }}>Contact: {companyInfo.Contact}</span>}
                                {companyInfo?.FaxNo && <span>Fax: {companyInfo.FaxNo}</span>}
                            </div>
                            {companyInfo?.Email && <div>{companyInfo.Email}</div>}
                        </div>
                        <h2>{voucher.voucher_no}</h2>
                        <p style={{ color: '#64748b', fontSize: '0.85rem', marginTop: 2 }}>
                            {voucher.voucher_type} &nbsp;|&nbsp; {voucher.date}
                            {voucher.paid_by && <> &nbsp;|&nbsp; <strong>{voucher.paid_by}</strong></>}
                        </p>
                    </div>
                    <div style={{ display: 'flex', gap: 10 }}>
                        <button onClick={() => onPrint(voucher)} className="btn-secondary"
                            style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.85rem' }}>
                            <Printer size={15} /> Print
                        </button>
                        <button onClick={onClose} style={{ fontSize: '1.5rem', color: '#94a3b8' }}>✕</button>
                    </div>
                </div>
                <div style={{ padding: '20px 32px 32px' }}>
                    {voucher.description && (
                        <p style={{ color: '#64748b', marginBottom: 16, fontSize: '0.875rem' }}>
                            {voucher.description}
                        </p>
                    )}
                    <table className="ledger-table">
                        <thead>
                            <tr>
                                <th>Account Code</th>
                                <th>Account Name</th>
                                {voucher.voucher_type === 'JOURNAL' ? (
                                    <>
                                        <th style={{ textAlign: 'right' }}>Debit</th>
                                        <th style={{ textAlign: 'right' }}>Credit</th>
                                    </>
                                ) : (
                                    <th style={{ textAlign: 'right' }}>Amount</th>
                                )}
                            </tr>
                        </thead>
                        <tbody>
                            {(voucher.entries || [])
                                .filter(e => {
                                    if (voucher.voucher_type === 'RECEIPT') return parseFloat(e.cr_amount || 0) > 0;
                                    if (voucher.voucher_type === 'PAYMENT') return parseFloat(e.dr_amount || 0) > 0;
                                    return true;
                                })
                                .map((e, i) => (
                                    <tr key={i}>
                                        <td>{e.account_code || '—'}</td>
                                        <td>{e.account_name}</td>
                                        {voucher.voucher_type === 'JOURNAL' ? (
                                            <>
                                                <td style={{ textAlign: 'right', color: '#10b981', fontWeight: 600 }}>
                                                    {parseFloat(e.dr_amount || 0) > 0 ? parseFloat(e.dr_amount).toFixed(0) : '—'}
                                                </td>
                                                <td style={{ textAlign: 'right', color: '#ef4444', fontWeight: 600 }}>
                                                    {parseFloat(e.cr_amount || 0) > 0 ? parseFloat(e.cr_amount).toFixed(0) : '—'}
                                                </td>
                                            </>
                                        ) : (
                                            <td style={{ textAlign: 'right', fontWeight: 600 }}>
                                                {voucher.voucher_type === 'RECEIPT'
                                                    ? parseFloat(e.cr_amount || 0).toFixed(0)
                                                    : parseFloat(e.dr_amount || 0).toFixed(0)
                                                }
                                            </td>

                                        )}
                                    </tr>
                                ))}
                        </tbody>
                        <tfoot>
                            <tr style={{ fontWeight: 800, background: '#f8fafc' }}>
                                <td colSpan="2">TOTAL</td>
                                {voucher.voucher_type === 'JOURNAL' ? (
                                    <>
                                        <td style={{ textAlign: 'right', color: '#10b981' }}>{totalDr.toFixed(0)}</td>
                                        <td style={{ textAlign: 'right', color: '#ef4444' }}>{totalCr.toFixed(0)}</td>
                                    </>
                                ) : (
                                    <td style={{ textAlign: 'right' }}>
                                        {voucher.voucher_type === 'RECEIPT' ? totalCr.toFixed(0) : totalDr.toFixed(0)}
                                    </td>

                                )}
                            </tr>
                        </tfoot>
                    </table>

                    {voucher.voucher_type !== 'JOURNAL' && (
                        <div style={{ marginTop: 16, fontSize: '0.85rem', color: '#64748b', fontWeight: 600 }}>
                            <span style={{ color: '#94a3b8', fontWeight: 400 }}>Rupees:</span> {numberToWords(voucher.voucher_type === 'RECEIPT' ? totalCr : totalDr)}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

// ── Delete confirmation modal ──────────────────────────────────────────────
const DeleteModal = ({ voucher, onConfirm, onClose }) => (
    <div className="modal-backdrop" onClick={onClose}>
        <div className="modal-content animate-fade-in"
            style={{ maxWidth: 420, padding: 0 }}
            onClick={e => e.stopPropagation()}>
            <div style={{ padding: '36px 36px 28px', textAlign: 'center' }}>
                <div style={{ fontSize: '3rem', marginBottom: 12 }}>🗑️</div>
                <h3 style={{ marginBottom: 8 }}>Delete Voucher?</h3>
                <p style={{ color: '#64748b', fontSize: '0.875rem', marginBottom: 28 }}>
                    <strong>{voucher.voucher_no}</strong> will be permanently deleted along with all
                    its accounting entries. This cannot be undone.
                </p>
                <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
                    <button className="btn-secondary" onClick={onClose}>Cancel</button>
                    <button
                        style={{ background: '#ef4444', color: '#fff', border: 'none', borderRadius: 12, padding: '10px 24px', fontWeight: 700, cursor: 'pointer' }}
                        onClick={onConfirm}>
                        Yes, Delete
                    </button>
                </div>
            </div>
        </div>
    </div>
);

// ─────────────────────────────────────────────────────────────────────────────
//  Main VoucherList
// ─────────────────────────────────────────────────────────────────────────────
const VoucherList = ({
    voucherType, fromDate, toDate, locationId, fiscalYearId,
    onNewVoucher, onEditVoucher, companyInfo, isHeadOffice, isFYClosed, reportMeta
}) => {
    const [vouchers, setVouchers] = useState([]);
    const [loading, setLoading] = useState(false);
    const [exportModal, setExportModal] = useState(false);
    const [modeFilter, setModeFilter] = useState('ALL');
    const [viewVoucher, setViewVoucher] = useState(null);   // detail modal
    const [deleteTarget, setDeleteTarget] = useState(null); // delete modal

    const modeFilters =
        voucherType === 'JOURNAL'
            ? [{ key: 'ALL', label: 'All Journals', icon: <AlignJustify size={15} /> }]
            : [
                { key: 'ALL', label: 'All', icon: <AlignJustify size={15} /> },
                { key: 'CASH', label: 'Cash', icon: <Banknote size={15} /> },
                { key: 'CHEQUE', label: 'Cheque', icon: <CreditCard size={15} /> },
                { key: 'ONLINE', label: 'Online', icon: <Wifi size={15} /> },
            ];

    const fetchVouchers = async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams({ type: voucherType });
            if (modeFilter !== 'ALL') params.append('mode', modeFilter);
            if (fromDate && toDate) {
                params.append('fromDate', fromDate);
                params.append('toDate', toDate);
            }
            if (isHeadOffice) {
                // HO can see all locations or filter
                if (locationId) params.append('location_id', locationId);
                else params.append('all_locations', 'true');
            } else if (locationId) {
                params.append('location_id', locationId);
            }
            if (fiscalYearId) params.append('fiscal_year_id', fiscalYearId);
            const { data } = await axios.get(`${API}/vouchers?${params.toString()}`);
            setVouchers(data);
        } catch (e) { console.error(e); }
        setLoading(false);
    };

    useEffect(() => { fetchVouchers(); }, [voucherType, modeFilter, fromDate, toDate]);

    const handlePrint = (v) => {
        const type = v.voucher_type;
        const mode = (v.paid_by || '').toUpperCase();

        let title = "VOUCHER";
        if (type === 'RECEIPT') {
            title = mode === 'CASH' ? "CASH RECEIPT VOUCHER" : "BANK RECEIPT VOUCHER";
        } else if (type === 'PAYMENT') {
            title = mode === 'CASH' ? "CASH PAYMENT VOUCHER" : "BANK PAYMENT VOUCHER";
        } else if (type === 'JOURNAL') {
            title = "JOURNAL VOUCHER";
        }

        const win = window.open('', '_blank');

        const isJournal = type === 'JOURNAL';
        const isReceipt = type === 'RECEIPT';
        const isPayment = type === 'PAYMENT';

        const filteredEntries = (v.entries || []).filter(e => {
            if (isReceipt) return parseFloat(e.cr_amount || 0) > 0;
            if (isPayment) return parseFloat(e.dr_amount || 0) > 0;
            return true;
        });

        const entriesHtml = filteredEntries.map(e => `
            <tr>
                <td>${e.account_code || ''}</td>
                <td>
                    <div style="font-weight:600">${e.account_name}</div>
                    <div style="font-size:0.75rem; color:#666">${e.description || v.description || ''}</div>
                </td>
                ${isJournal ? `
                    <td style="text-align:right">${parseFloat(e.dr_amount || 0) > 0 ? parseFloat(e.dr_amount).toFixed(0) : ''}</td>
                    <td style="text-align:right">${parseFloat(e.cr_amount || 0) > 0 ? parseFloat(e.cr_amount).toFixed(0) : ''}</td>
                ` : `
                    <td style="text-align:right; font-weight:600">${isReceipt ? parseFloat(e.cr_amount).toFixed(0) : parseFloat(e.dr_amount).toFixed(0)}</td>
                `}

            </tr>
        `).join('');

        const totalDr = (v.entries || []).reduce((s, e) => s + parseFloat(e.dr_amount || 0), 0);
        const totalCr = (v.entries || []).reduce((s, e) => s + parseFloat(e.cr_amount || 0), 0);
        const displayTotal = isReceipt ? totalCr : totalDr;

        win.document.write(`
            <html>
                <head>
                    <title>Print Voucher - ${v.voucher_no}</title>
                    <style>
                        body { font-family: 'Segoe UI', Arial, sans-serif; padding: 40px; color: #333; }
                        .header { display: flex; justify-content: space-between; border-bottom: 2px solid #333; padding-bottom: 20px; margin-bottom: 30px; }
                        .company-info h1 { margin: 0; color: #0284c7; font-size: 24px; }
                        .company-info p { margin: 4px 0; font-size: 13px; color: #666; }
                        .voucher-title { text-align: center; font-size: 20px; font-weight: 800; text-decoration: underline; margin-bottom: 30px; letter-spacing: 1px; }
                        .meta-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 30px; background: #f8fafc; padding: 20px; border-radius: 8px; border: 1px solid #e2e8f0; }
                        .meta-item { display: flex; gap: 10px; font-size: 14px; }
                        .meta-label { font-weight: bold; color: #64748b; width: 100px; }
                        table { width: 100%; border-collapse: collapse; margin-bottom: 50px; }
                        th { background: #f1f5f9; border: 1px solid #e2e8f0; padding: 12px; font-size: 13px; text-transform: uppercase; }
                        td { border: 1px solid #e2e8f0; padding: 12px; font-size: 14px; }
                        .footer-sigs { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 40px; margin-top: 60px; }
                        .sig-box { border-top: 1px solid #333; text-align: center; padding-top: 10px; font-size: 13px; font-weight: bold; color: #475569; }
                        @media print {
                            body { padding: 0; }
                            .meta-grid { background: none !important; }
                        }
                    </style>
                </head>
                <body>
                    <div class="header">
                        <div class="company-info">
                            <h1>${companyInfo?.CompanyName || 'FA SYSTEM'}</h1>
                            <p>${companyInfo?.Address || ''}</p>
                            <p>
                                ${companyInfo?.Contact ? `Contact: ${companyInfo.Contact}` : ''}
                                ${companyInfo?.FaxNo ? ` | Fax: ${companyInfo.FaxNo}` : ''}
                            </p>
                            <p>${companyInfo?.Email || ''}</p>
                            <p style="font-size: 11px; margin-top: 5px; color: #475569;">
                                ${[
                companyInfo?.NTNo ? `NTN: ${companyInfo.NTNo}` : '',
                companyInfo?.GSTNo ? `GST: ${companyInfo.GSTNo}` : '',
                companyInfo?.GovtNo ? `Govt No: ${companyInfo.GovtNo}` : '',
                companyInfo?.IATACode ? `IATA: ${companyInfo.IATACode}` : ''
            ].filter(Boolean).join(' | ')}
                            </p>
                        </div>
                        <div style="text-align: right">
                            <h2 style="margin:0; color:#475569">${v.voucher_no}</h2>
                            <p style="margin:5px 0; color:#64748b">Date: ${v.date}</p>
                        </div>
                    </div>
                    
                    <div class="voucher-title">${title}</div>
                    
                    <div class="meta-grid">
                        <div class="meta-item"><span class="meta-label">Voucher No:</span> ${v.voucher_no}</div>
                        <div class="meta-item"><span class="meta-label">Date:</span> ${v.date}</div>
                        <div class="meta-item"><span class="meta-label">Mode:</span> ${v.paid_by || 'N/A'}</div>
                        <div class="meta-item"><span class="meta-label">Ref/Cheque:</span> ${[v.bank_name, v.cheque_no].filter(Boolean).join(' / ') || 'N/A'}</div>
                    </div>

                    <table>
                        <thead>
                            <tr>
                                <th style="width: 15%">Code</th>
                                <th style="width: 55%; text-align: left">Account & Description</th>
                                ${isJournal ? `
                                    <th style="width: 15%; text-align: right">Debit</th>
                                    <th style="width: 15%; text-align: right">Credit</th>
                                ` : `
                                    <th style="width: 30%; text-align: right">Amount</th>
                                `}
                            </tr>
                        </thead>
                        <tbody>
                            ${entriesHtml}
                        </tbody>
                        <tfoot style="font-weight: 800; background: #f8fafc">
                            <tr>
                                <td colspan="2" style="text-align: center">TOTAL</td>
                                ${isJournal ? `
                                    <td style="text-align: right">${totalDr.toFixed(0)}</td>
                                    <td style="text-align: right">${totalCr.toFixed(0)}</td>
                                ` : `
                                    <td style="text-align: right">${displayTotal.toFixed(0)}</td>
                                `}

                            </tr>
                        </tfoot>
                    </table>

                    <div style="margin-bottom: 40px; font-size: 14px">
                        <strong>Rupees:</strong> <span style="text-transform: capitalize; border-bottom: 1px dashed #333; padding-bottom: 2px;">${numberToWords(displayTotal)}</span>
                    </div>

                    <div class="footer-sigs">
                        <div class="sig-box">Prepared By</div>
                        <div class="sig-box">Checked By</div>
                        <div class="sig-box">Receiver's Signature</div>
                    </div>

                    <script>
                        window.onload = () => {
                            window.print();
                            // window.close();
                        }
                    </script>
                </body>
            </html>
        `);
        win.document.close();
    };

    const handleView = async (id) => {
        try {
            const { data } = await axios.get(`${API}/vouchers/${id}`);
            setViewVoucher(data);
        } catch (e) { alert('Could not load voucher details'); }
    };

    const handleEdit = async (v) => {
        try {
            const { data } = await axios.get(`${API}/vouchers/${v.id}`);
            onEditVoucher(data);
        } catch (e) { alert('Could not load voucher details for editing'); }
    };

    const handleDelete = async () => {

        try {
            await axios.delete(`${API}/vouchers/${deleteTarget.id}`);
            setDeleteTarget(null);
            fetchVouchers();
        } catch (e) { alert('Delete failed'); }
    };

    const typeBadgeColor = {
        RECEIPT: { bg: '#dcfce7', color: '#166534' },
        PAYMENT: { bg: '#fee2e2', color: '#991b1b' },
        JOURNAL: { bg: '#ede9fe', color: '#6d28d9' },
    };

    const modeBadge = (mode) => {
        const map = {
            CASH: { bg: '#fef9c3', color: '#713f12' },
            CHEQUE: { bg: '#dbeafe', color: '#1e40af' },
            ONLINE: { bg: '#f3e8ff', color: '#6b21a8' },
        };
        const style = map[mode] || { bg: '#f1f5f9', color: '#475569' };
        return (
            <span style={{ ...style, fontSize: '0.7rem', fontWeight: 700, padding: '2px 9px', borderRadius: 20, display: 'inline-block' }}>
                {mode || '—'}
            </span>
        );
    };

    return (
        <div className="animate-fade-in">
            {/* ── Toolbar ── */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>

                {/* Mode filter pills */}
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {modeFilters.map(f => (
                        <button key={f.key}
                            onClick={() => setModeFilter(f.key)}
                            style={{
                                display: 'flex', alignItems: 'center', gap: 6,
                                padding: '7px 16px', borderRadius: 20, border: '1.5px solid',
                                fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer',
                                transition: 'all 0.15s',
                                background: modeFilter === f.key ? '#0284c7' : '#fff',
                                borderColor: modeFilter === f.key ? '#0284c7' : '#e2e8f0',
                                color: modeFilter === f.key ? '#fff' : '#475569',
                            }}>
                            {f.icon} {f.label}
                        </button>
                    ))}
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', gap: 8 }}>
                    <button className="btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: 5 }}
                        onClick={() => {
                            const data = vouchers.map(v => ({
                                no: v.voucher_no,
                                date: v.date,
                                desc: v.description,
                                amount: v.total_amount
                            }));
                            const reportName = `${voucherType.charAt(0) + voucherType.slice(1).toLowerCase()} Voucher Report`;
                            printTable(reportName, ['Voucher No', 'Date', 'Description', 'Amount'], data, ['no', 'date', 'desc', 'amount'], companyInfo, reportMeta);
                        }}>
                        <Printer size={14} /> Print List
                    </button>
                    <button className="btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: 5 }}
                        onClick={() => setExportModal(true)}>
                        <FileText size={14} /> Export List
                    </button>
                    <button className="btn-secondary" onClick={fetchVouchers} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                        <RefreshCw size={14} /> Refresh
                    </button>
                    {!isFYClosed && (
                        <button className="btn-primary" onClick={onNewVoucher} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                            <Plus size={15} /> New {voucherType === 'RECEIPT' ? 'Receipt' : voucherType === 'PAYMENT' ? 'Payment' : 'Journal'}
                        </button>
                    )}
                </div>
            </div>

            {/* ── Table ── */}
            <div className="ledger-report-card" style={{ overflow: 'hidden' }}>
                {loading ? (
                    <div style={{ padding: 60, textAlign: 'center', color: '#94a3b8' }}>Loading…</div>
                ) : vouchers.length === 0 ? (
                    <div style={{ padding: 60, textAlign: 'center', color: '#94a3b8' }}>
                        <div style={{ fontSize: '2.5rem', marginBottom: 12 }}>📄</div>
                        <h3 style={{ marginBottom: 6 }}>No Vouchers Found</h3>
                        <p>Create your first voucher using the button above.</p>
                    </div>
                ) : (
                    <table className="ledger-table" style={{ fontSize: '0.875rem' }}>
                        <thead>
                            <tr>
                                <th>Voucher No</th>
                                <th>Date</th>
                                {voucherType !== 'JOURNAL' && <th>Mode</th>}
                                <th>Description</th>
                                {voucherType !== 'JOURNAL' && <th>Bank / Cheque</th>}
                                <th style={{ textAlign: 'right' }}>Amount</th>
                                <th style={{ textAlign: 'center' }}>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {vouchers.map((v) => (
                                <tr key={v.id}>
                                    <td>
                                        <span style={{
                                            fontWeight: 700, fontFamily: 'monospace',
                                            color: typeBadgeColor[v.voucher_type]?.color
                                        }}>
                                            {v.voucher_no}
                                        </span>
                                    </td>
                                    <td>{v.date}</td>
                                    {voucherType !== 'JOURNAL' && <td>{modeBadge(v.paid_by)}</td>}
                                    <td style={{ color: '#64748b', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                        {v.description || '—'}
                                    </td>
                                    {voucherType !== 'JOURNAL' && (
                                        <td style={{ color: '#64748b', fontSize: '0.8rem' }}>
                                            {[v.bank_name, v.cheque_no].filter(Boolean).join(' / ') || '—'}
                                        </td>
                                    )}
                                    <td style={{ textAlign: 'right', fontWeight: 700, color: '#0f172a' }}>
                                        {parseFloat(v.total_amount || 0).toLocaleString()}
                                    </td>

                                    <td>
                                        <div style={{ display: 'flex', justifyContent: 'center', gap: 4 }}>
                                            {/* View */}
                                            <button title="View Detail"
                                                onClick={() => handleView(v.id)}
                                                style={{ background: '#f1f5f9', border: 'none', borderRadius: 8, padding: '5px 8px', cursor: 'pointer', color: '#0284c7' }}>
                                                <Eye size={15} />
                                            </button>
                                            {/* Edit */}
                                            {!isFYClosed && (
                                                <button title="Edit Voucher"
                                                    onClick={() => handleEdit(v)}
                                                    style={{ background: '#f1f5f9', border: 'none', borderRadius: 8, padding: '5px 8px', cursor: 'pointer', color: '#6366f1' }}>
                                                    <Edit2 size={15} />
                                                </button>
                                            )}

                                            {/* Print */}
                                            <button title="Print Voucher"
                                                onClick={() => handlePrint(v)}
                                                style={{ background: '#f1f5f9', border: 'none', borderRadius: 8, padding: '5px 8px', cursor: 'pointer', color: '#475569' }}>
                                                <Printer size={15} />
                                            </button>

                                            {/* Delete */}
                                            {!isFYClosed && (
                                                <button title="Delete Voucher"
                                                    onClick={() => setDeleteTarget(v)}
                                                    style={{ background: '#fee2e2', border: 'none', borderRadius: 8, padding: '5px 8px', cursor: 'pointer', color: '#dc2626' }}>
                                                    <Trash2 size={15} />
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                        <tfoot>
                            <tr style={{ fontWeight: 800, background: '#f8fafc' }}>
                                <td colSpan={voucherType !== 'JOURNAL' ? 5 : 3}>
                                    Total ({vouchers.length} vouchers)
                                </td>
                                <td style={{ textAlign: 'right' }}>
                                    {vouchers.reduce((s, v) => s + parseFloat(v.total_amount || 0), 0)
                                        .toLocaleString()}
                                </td>

                                <td></td>
                            </tr>
                        </tfoot>
                    </table>
                )}
            </div>

            {/* ── Modals ── */}
            {viewVoucher && <VoucherDetailModal voucher={viewVoucher} companyInfo={companyInfo} onPrint={handlePrint} onClose={() => setViewVoucher(null)} />}
            {deleteTarget && <DeleteModal voucher={deleteTarget} onConfirm={handleDelete} onClose={() => setDeleteTarget(null)} />}

            {/* Format Selection Modal */}
            <ExportModal
                isOpen={exportModal}
                onClose={() => setExportModal(false)}
                title={`${voucherType} Vouchers`}
                onSelect={(format) => {
                    const data = vouchers.map(v => ({
                        no: v.voucher_no,
                        date: v.date,
                        desc: v.description,
                        amount: v.total_amount
                    }));
                    const headers = ['Voucher No', 'Date', 'Description', 'Amount'];
                    const fields = ['no', 'date', 'desc', 'amount'];

                    if (format === 'EXCEL') {
                        exportToCSV(`${voucherType}_Vouchers`, headers, data, fields);
                    } else {
                        const reportName = `${voucherType.charAt(0) + voucherType.slice(1).toLowerCase()} Voucher Report`;
                        printTable(reportName, headers, data, fields, companyInfo, reportMeta);
                    }
                }}
            />
        </div>
    );
};

export default VoucherList;
