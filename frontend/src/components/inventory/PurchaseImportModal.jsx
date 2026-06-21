/**
 * PurchaseImportModal.jsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Isolated "Import Data" feature for Stock Purchase module.
 * This component does NOT modify any existing Stock Purchase logic.
 *
 * Flow:
 *   1. User uploads an .xlsx / .xls file
 *   2. SheetJS parses it client-side → rows extracted
 *   3. POST /api/inventory/purchases/validate-import → server validates master data
 *   4. Preview table shown: valid rows (green) + invalid rows (red + error msg)
 *   5. User confirms → POST /api/inventory/purchases/import-excel
 *   6. Success message + parent callback
 */

import React, { useState, useRef, useCallback } from 'react';
import ReactDOM from 'react-dom';
import * as XLSX from 'xlsx';
import axios from 'axios';
import {
    Upload, FileSpreadsheet, CheckCircle, XCircle, AlertTriangle,
    Loader, X, Download, Eye, ShoppingCart, ChevronRight, Info
} from 'lucide-react';

const API = '/api/inventory';

// ── Expected Excel column headers (case-insensitive matching) ──────────────────
const COLUMN_MAP = {
    'transaction date':  'transaction_date',
    'transactiondate':   'transaction_date',
    'trans date':        'transaction_date',
    'date':              'transaction_date',
    'supplier/vendor':   'supplier_vendor',
    'supplier':          'supplier_vendor',
    'vendor':            'supplier_vendor',
    'maker':             'maker',
    'brand':             'maker',
    'category':          'category',
    'type':              'category',
    'power':             'power',
    'power rating':      'power',
    'lot no':            'lot_no',
    'lot number':        'lot_no',
    'lot':               'lot_no',
    'sno':               'sno',
    's.no':              'sno',
    'serial no':         'sno',
    'serial number':     'sno',
    'mfg date':          'mfg_date',
    'mfgdate':           'mfg_date',
    'manufacture date':  'mfg_date',
    'manufacturing date':'mfg_date',
    'exp date':          'exp_date',
    'expdate':           'exp_date',
    'expiry date':       'exp_date',
    'expiration date':   'exp_date',
};

const REQUIRED_COLUMNS = ['transaction_date', 'supplier_vendor', 'maker', 'category'];

// ── Styles ────────────────────────────────────────────────────────────────────
const overlayStyle = {
    position: 'fixed', inset: 0,
    background: 'rgba(15,23,42,0.55)',
    backdropFilter: 'blur(12px)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    zIndex: 999999, padding: 24,
    animation: 'importFadeIn 0.25s ease-out',
};

const cardStyle = {
    background: 'white',
    borderRadius: 24,
    width: '98%',
    maxWidth: 1100,
    maxHeight: '92vh',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    boxShadow: '0 60px 120px -20px rgba(0,0,0,0.3), 0 0 0 1px rgba(37,99,235,0.08)',
};

const badgePill = (bg, color, text) => (
    <span style={{
        background: bg, color, borderRadius: 20, padding: '3px 10px',
        fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.02em',
        display: 'inline-flex', alignItems: 'center', gap: 4,
        whiteSpace: 'nowrap',
    }}>{text}</span>
);

// ── Main Component ────────────────────────────────────────────────────────────
const PurchaseImportModal = ({ currentUser, onClose, onImportSuccess }) => {
    const [step, setStep]                   = useState('upload');   // 'upload' | 'preview' | 'importing' | 'done'
    const [dragOver, setDragOver]           = useState(false);
    const [fileName, setFileName]           = useState('');
    const [rawRows, setRawRows]             = useState([]);
    const [validatedRows, setValidatedRows] = useState([]);
    const [summary, setSummary]             = useState(null);       // { totalRows, validRows, invalidRows }
    const [validating, setValidating]       = useState(false);
    const [importing, setImporting]         = useState(false);
    const [result, setResult]               = useState(null);       // import result
    const [globalError, setGlobalError]     = useState('');
    const [parseError, setParseError]       = useState('');
    const [showInvalidOnly, setShowInvalidOnly] = useState(false);
    const [isClosing, setIsClosing]         = useState(false);
    const fileInputRef = useRef(null);

    // ── Close handler ──────────────────────────────────────────────────────────
    const handleClose = () => {
        setIsClosing(true);
        setTimeout(onClose, 250);
    };

    // ── Excel Parsing ──────────────────────────────────────────────────────────
    const parseExcelFile = useCallback((file) => {
        setParseError('');
        setGlobalError('');

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = new Uint8Array(e.target.result);
                const workbook = XLSX.read(data, { type: 'array', cellDates: true });
                const sheetName = workbook.SheetNames[0];
                const sheet = workbook.Sheets[sheetName];

                // Get raw rows with header row
                const jsonRows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false, dateNF: 'yyyy-mm-dd' });

                if (jsonRows.length < 2) {
                    setParseError('Excel file is empty or has no data rows. Minimum 2 rows required (header + data).');
                    return;
                }

                // Map headers
                const headers = jsonRows[0].map(h => String(h || '').trim().toLowerCase());
                const mappedHeaders = headers.map(h => COLUMN_MAP[h] || h);

                // Check required columns
                const missingRequired = REQUIRED_COLUMNS.filter(req => !mappedHeaders.includes(req));
                if (missingRequired.length > 0) {
                    setParseError(
                        `Missing required columns: ${missingRequired.map(c =>
                            Object.entries(COLUMN_MAP).find(([, v]) => v === c)?.[0] || c
                        ).join(', ')}`
                    );
                    return;
                }

                // Parse data rows
                const dataRows = jsonRows.slice(1)
                    .filter(row => row.some(cell => cell !== null && cell !== undefined && String(cell).trim() !== ''))
                    .map(row => {
                        const obj = {};
                        mappedHeaders.forEach((key, i) => {
                            if (key) obj[key] = row[i] !== undefined && row[i] !== null ? String(row[i]).trim() : '';
                        });
                        return obj;
                    });

                if (dataRows.length === 0) {
                    setParseError('No data rows found in Excel file (all rows appear empty).');
                    return;
                }

                setFileName(file.name);
                setRawRows(dataRows);
                // Auto-validate after parse
                validateRows(dataRows);
            } catch (err) {
                setParseError(`Failed to parse Excel file: ${err.message}. Ensure it is a valid .xlsx or .xls file.`);
            }
        };
        reader.onerror = () => setParseError('Failed to read the file. Please try again.');
        reader.readAsArrayBuffer(file);
    }, [currentUser]);

    // ── Server-side Validation ─────────────────────────────────────────────────
    const validateRows = async (rows) => {
        setValidating(true);
        setGlobalError('');
        try {
            const { data } = await axios.post(`${API}/purchases/validate-import`, {
                rows,
                location_id:    currentUser.location_id,
                fiscal_year_id: currentUser.fiscal_year_id,
            });
            setValidatedRows(data.rows);
            setSummary({ totalRows: data.totalRows, validRows: data.validRows, invalidRows: data.invalidRows });
            setStep('preview');
        } catch (err) {
            setGlobalError(err.response?.data?.error || 'Validation failed. Please try again.');
        } finally {
            setValidating(false);
        }
    };

    // ── File Drop / Select ─────────────────────────────────────────────────────
    const handleFileSelect = (file) => {
        if (!file) return;
        const ext = file.name.split('.').pop().toLowerCase();
        if (!['xlsx', 'xls', 'csv'].includes(ext)) {
            setParseError('Invalid file type. Please upload an Excel file (.xlsx or .xls).');
            return;
        }
        parseExcelFile(file);
    };

    const handleDrop = (e) => {
        e.preventDefault();
        setDragOver(false);
        const file = e.dataTransfer.files[0];
        if (file) handleFileSelect(file);
    };

    const handleDragOver = (e) => { e.preventDefault(); setDragOver(true); };
    const handleDragLeave = () => setDragOver(false);

    // ── Download Sample Template ───────────────────────────────────────────────
    const downloadTemplate = () => {
        const ws = XLSX.utils.aoa_to_sheet([
            ['Transaction Date', 'Supplier/Vendor', 'Maker', 'Category', 'Power', 'Lot No', 'SNO', 'MFG DATE', 'EXP DATE'],
            ['2026-06-01', 'SAMPLE SUPPLIER', 'SAMPLE MAKER', 'SAMPLE CATEGORY', '+1.00', 'LOT001', 'SN001', '2025-01-01', '2027-01-01'],
        ]);
        ws['!cols'] = [18, 20, 18, 20, 10, 12, 10, 12, 12].map(w => ({ wch: w }));
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Stock Purchase Import');
        XLSX.writeFile(wb, 'StockPurchase_Import_Template.xlsx');
    };

    // ── Confirm Import ─────────────────────────────────────────────────────────
    const handleConfirmImport = async () => {
        const validRows = validatedRows.filter(r => r._valid);
        if (validRows.length === 0) {
            setGlobalError('No valid rows to import.');
            return;
        }

        setImporting(true);
        setGlobalError('');
        setStep('importing');

        try {
            const { data } = await axios.post(`${API}/purchases/import-excel`, {
                rows:           validRows,
                location_id:    currentUser.location_id,
                fiscal_year_id: currentUser.fiscal_year_id,
                user_id:        currentUser.id,
            });

            setResult(data);
            setStep('done');
        } catch (err) {
            setGlobalError(err.response?.data?.error || 'Import failed. Please try again.');
            setStep('preview');
        } finally {
            setImporting(false);
        }
    };

    // ── Reset to upload ────────────────────────────────────────────────────────
    const handleReset = () => {
        setStep('upload');
        setFileName('');
        setRawRows([]);
        setValidatedRows([]);
        setSummary(null);
        setGlobalError('');
        setParseError('');
        setResult(null);
        setShowInvalidOnly(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    // ── Filtered display rows ──────────────────────────────────────────────────
    const displayRows = showInvalidOnly ? validatedRows.filter(r => !r._valid) : validatedRows;

    // ── Render ─────────────────────────────────────────────────────────────────
    const modal = (
        <div style={overlayStyle} className={isClosing ? 'import-closing' : ''}>
            <div style={cardStyle}>

                {/* ── MODAL HEADER ─────────────────────────────────────────── */}
                <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '22px 32px', borderBottom: '1px solid #e2e8f0',
                    background: 'linear-gradient(to right, #eff6ff60, white)', flexShrink: 0,
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                        <div style={{
                            width: 48, height: 48, borderRadius: 14,
                            background: 'linear-gradient(135deg, #2563eb, #1d4ed8)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            boxShadow: '0 8px 16px #2563eb30',
                        }}>
                            <FileSpreadsheet size={24} color="white" />
                        </div>
                        <div>
                            <div style={{ fontWeight: 800, fontSize: '1.2rem', color: '#1e293b', letterSpacing: '-0.02em' }}>
                                Import Stock Purchase Data
                            </div>
                            <div style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 500 }}>
                                Upload Excel file · Validate · Preview · Confirm
                            </div>
                        </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        {step === 'upload' && (
                            <button
                                onClick={downloadTemplate}
                                style={{
                                    display: 'flex', alignItems: 'center', gap: 6,
                                    background: '#f0fdf4', border: '1px solid #86efac',
                                    color: '#16a34a', borderRadius: 10, padding: '8px 14px',
                                    fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer',
                                    transition: 'all 0.2s',
                                }}
                                title="Download Excel template"
                            >
                                <Download size={14} /> Template
                            </button>
                        )}
                        <button
                            onClick={handleClose}
                            style={{
                                width: 36, height: 36, borderRadius: 10,
                                background: '#f1f5f9', border: '1px solid #e2e8f0',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                cursor: 'pointer', color: '#64748b', transition: 'all 0.2s',
                            }}
                        >
                            <X size={18} />
                        </button>
                    </div>
                </div>

                {/* ── STEP BREADCRUMB ───────────────────────────────────────── */}
                <div style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    padding: '12px 32px', background: '#f8fafc',
                    borderBottom: '1px solid #e2e8f0', flexShrink: 0, flexWrap: 'wrap',
                }}>
                    {[
                        { key: 'upload',    label: '① Upload File' },
                        { key: 'preview',   label: '② Preview & Validate' },
                        { key: 'importing', label: '③ Importing' },
                        { key: 'done',      label: '④ Done' },
                    ].map((s, i, arr) => (
                        <React.Fragment key={s.key}>
                            <span style={{
                                fontSize: '0.78rem', fontWeight: 600, padding: '4px 10px', borderRadius: 20,
                                background: step === s.key ? '#2563eb' : ['preview','importing','done'].includes(step) && i < arr.findIndex(x => x.key === step) ? '#dcfce7' : '#f1f5f9',
                                color: step === s.key ? 'white' : ['preview','importing','done'].includes(step) && i < arr.findIndex(x => x.key === step) ? '#16a34a' : '#94a3b8',
                                transition: 'all 0.3s',
                            }}>{s.label}</span>
                            {i < arr.length - 1 && <ChevronRight size={14} color="#cbd5e1" />}
                        </React.Fragment>
                    ))}
                    {fileName && (
                        <span style={{ marginLeft: 'auto', fontSize: '0.75rem', color: '#64748b', fontStyle: 'italic' }}>
                            📄 {fileName}
                        </span>
                    )}
                </div>

                {/* ── BODY ─────────────────────────────────────────────────── */}
                <div style={{ flex: 1, overflowY: 'auto', padding: '32px' }}>

                    {/* Global error */}
                    {globalError && (
                        <div style={{
                            background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 12,
                            padding: '14px 18px', marginBottom: 20, display: 'flex', alignItems: 'flex-start', gap: 10,
                        }}>
                            <XCircle size={18} color="#ef4444" style={{ flexShrink: 0, marginTop: 1 }} />
                            <span style={{ fontSize: '0.85rem', color: '#b91c1c', fontWeight: 500 }}>{globalError}</span>
                        </div>
                    )}

                    {/* ── STEP: UPLOAD ──────────────────────────────────────── */}
                    {step === 'upload' && (
                        <div>
                            <div style={{ marginBottom: 24 }}>
                                <div style={{
                                    background: '#eff6ff', border: '1px solid #bfdbfe',
                                    borderRadius: 12, padding: '14px 18px',
                                    display: 'flex', alignItems: 'flex-start', gap: 10,
                                }}>
                                    <Info size={16} color="#2563eb" style={{ flexShrink: 0, marginTop: 2 }} />
                                    <div style={{ fontSize: '0.82rem', color: '#1e40af', lineHeight: 1.6 }}>
                                        <strong>Required columns:</strong> Transaction Date, Supplier/Vendor, Maker, Category<br />
                                        <strong>Optional columns:</strong> Power, Lot No, SNO, MFG DATE, EXP DATE<br />
                                        All rows will be imported with <strong>Qty = 1</strong>, <strong>Rate = 0</strong>. You can edit them after import.<br />
                                        Supplier/Vendor must match your location's master data. Maker, Category &amp; Power must exist in system.
                                    </div>
                                </div>
                            </div>

                            {/* Drop Zone */}
                            <div
                                onDrop={handleDrop}
                                onDragOver={handleDragOver}
                                onDragLeave={handleDragLeave}
                                onClick={() => fileInputRef.current?.click()}
                                style={{
                                    border: `2.5px dashed ${dragOver ? '#2563eb' : '#cbd5e1'}`,
                                    borderRadius: 20,
                                    padding: '60px 40px',
                                    textAlign: 'center',
                                    cursor: 'pointer',
                                    background: dragOver ? '#eff6ff' : '#fafafa',
                                    transition: 'all 0.2s',
                                    position: 'relative',
                                }}
                            >
                                {validating ? (
                                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
                                        <Loader size={40} color="#2563eb" style={{ animation: 'importSpin 1s linear infinite' }} />
                                        <div style={{ fontSize: '1rem', fontWeight: 600, color: '#2563eb' }}>
                                            Parsing & validating...
                                        </div>
                                    </div>
                                ) : (
                                    <>
                                        <div style={{
                                            width: 72, height: 72, borderRadius: 20, margin: '0 auto 20px',
                                            background: dragOver ? '#2563eb' : '#f1f5f9',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            transition: 'all 0.2s',
                                        }}>
                                            <Upload size={32} color={dragOver ? 'white' : '#64748b'} />
                                        </div>
                                        <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#1e293b', marginBottom: 8 }}>
                                            {dragOver ? 'Drop your Excel file here' : 'Drag & drop Excel file, or click to browse'}
                                        </div>
                                        <div style={{ fontSize: '0.85rem', color: '#94a3b8', marginBottom: 16 }}>
                                            Supports .xlsx and .xls files
                                        </div>
                                        <div style={{
                                            display: 'inline-flex', alignItems: 'center', gap: 8,
                                            background: '#2563eb', color: 'white',
                                            borderRadius: 10, padding: '10px 24px',
                                            fontSize: '0.85rem', fontWeight: 600,
                                        }}>
                                            <FileSpreadsheet size={16} /> Choose File
                                        </div>
                                    </>
                                )}
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept=".xlsx,.xls"
                                    style={{ display: 'none' }}
                                    onChange={e => handleFileSelect(e.target.files[0])}
                                />
                            </div>

                            {parseError && (
                                <div style={{
                                    background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 12,
                                    padding: '14px 18px', marginTop: 16, display: 'flex', alignItems: 'flex-start', gap: 10,
                                }}>
                                    <AlertTriangle size={18} color="#ef4444" style={{ flexShrink: 0, marginTop: 1 }} />
                                    <span style={{ fontSize: '0.85rem', color: '#b91c1c', fontWeight: 500 }}>{parseError}</span>
                                </div>
                            )}
                        </div>
                    )}

                    {/* ── STEP: PREVIEW ─────────────────────────────────────── */}
                    {step === 'preview' && summary && (
                        <div>
                            {/* Summary Cards */}
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16, marginBottom: 24 }}>
                                {[
                                    { label: 'Total Rows', value: summary.totalRows, bg: '#f8fafc', border: '#e2e8f0', val_color: '#1e293b' },
                                    { label: 'Valid Rows', value: summary.validRows, bg: '#f0fdf4', border: '#86efac', val_color: '#16a34a' },
                                    { label: 'Invalid Rows', value: summary.invalidRows, bg: '#fef2f2', border: '#fca5a5', val_color: '#dc2626' },
                                ].map(card => (
                                    <div key={card.label} style={{
                                        background: card.bg, border: `1px solid ${card.border}`,
                                        borderRadius: 14, padding: '18px 22px', textAlign: 'center',
                                    }}>
                                        <div style={{ fontSize: '2rem', fontWeight: 800, color: card.val_color }}>
                                            {card.value}
                                        </div>
                                        <div style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600, marginTop: 4 }}>
                                            {card.label}
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* Filter + Info */}
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
                                <div style={{ fontSize: '0.85rem', color: '#64748b' }}>
                                    {summary.invalidRows > 0 && (
                                        <span style={{ color: '#ef4444', fontWeight: 600 }}>
                                            ⚠ {summary.invalidRows} row(s) have errors and will be skipped.
                                        </span>
                                    )}
                                    {summary.validRows > 0 && summary.invalidRows === 0 && (
                                        <span style={{ color: '#16a34a', fontWeight: 600 }}>
                                            ✓ All {summary.validRows} rows are valid and ready to import.
                                        </span>
                                    )}
                                </div>
                                <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                                    {summary.invalidRows > 0 && (
                                        <button
                                            onClick={() => setShowInvalidOnly(v => !v)}
                                            style={{
                                                display: 'flex', alignItems: 'center', gap: 6,
                                                background: showInvalidOnly ? '#fef2f2' : '#f8fafc',
                                                border: `1px solid ${showInvalidOnly ? '#fca5a5' : '#e2e8f0'}`,
                                                color: showInvalidOnly ? '#dc2626' : '#64748b',
                                                borderRadius: 8, padding: '6px 12px',
                                                fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer',
                                            }}
                                        >
                                            <Eye size={13} />
                                            {showInvalidOnly ? 'Show All Rows' : 'Show Invalid Only'}
                                        </button>
                                    )}
                                    <button
                                        onClick={handleReset}
                                        style={{
                                            display: 'flex', alignItems: 'center', gap: 6,
                                            background: '#f8fafc', border: '1px solid #e2e8f0',
                                            color: '#64748b', borderRadius: 8, padding: '6px 12px',
                                            fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer',
                                        }}
                                    >
                                        ↩ Upload Different File
                                    </button>
                                </div>
                            </div>

                            {/* Preview Table */}
                            <div style={{ overflowX: 'auto', borderRadius: 14, border: '1px solid #e2e8f0' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
                                    <thead>
                                        <tr style={{ background: '#f8fafc' }}>
                                            {['#', 'Status', 'Trans Date', 'Supplier/Vendor', 'Maker', 'Category', 'Power', 'Lot No', 'SNO', 'MFG Date', 'EXP Date', 'Errors'].map(h => (
                                                <th key={h} style={{
                                                    padding: '10px 12px', textAlign: 'left',
                                                    fontSize: '0.72rem', fontWeight: 700, color: '#64748b',
                                                    borderBottom: '1px solid #e2e8f0', whiteSpace: 'nowrap',
                                                }}>{h}</th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {displayRows.map((row, idx) => (
                                            <tr key={idx} style={{
                                                background: row._valid ? (idx % 2 === 0 ? 'white' : '#fafffe') : '#fff8f8',
                                                borderBottom: '1px solid #f1f5f9',
                                                transition: 'background 0.15s',
                                            }}>
                                                <td style={{ padding: '9px 12px', color: '#94a3b8', fontWeight: 600 }}>{row._rowIndex + 1}</td>
                                                <td style={{ padding: '9px 12px' }}>
                                                    {row._valid
                                                        ? <span style={{ color: '#16a34a', display: 'flex', alignItems: 'center', gap: 4 }}><CheckCircle size={14} /> Valid</span>
                                                        : <span style={{ color: '#dc2626', display: 'flex', alignItems: 'center', gap: 4 }}><XCircle size={14} /> Invalid</span>
                                                    }
                                                </td>
                                                <td style={{ padding: '9px 12px', color: '#374151', whiteSpace: 'nowrap' }}>{row.trans_date || '—'}</td>
                                                <td style={{ padding: '9px 12px', color: '#374151', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                                                    title={row.supplier_name}>{row.supplier_name || '—'}</td>
                                                <td style={{ padding: '9px 12px', color: '#374151', whiteSpace: 'nowrap' }}>{row.maker_name || '—'}</td>
                                                <td style={{ padding: '9px 12px', color: '#374151', whiteSpace: 'nowrap' }}>{row.category_name || '—'}</td>
                                                <td style={{ padding: '9px 12px', color: '#374151', whiteSpace: 'nowrap' }}>{row.power_label || '—'}</td>
                                                <td style={{ padding: '9px 12px', color: '#374151' }}>{row.lot_no || '—'}</td>
                                                <td style={{ padding: '9px 12px', color: '#374151' }}>{row.sno && row.sno !== '0' ? row.sno : '—'}</td>
                                                <td style={{ padding: '9px 12px', color: '#374151', whiteSpace: 'nowrap' }}>{row.mfg_date || '—'}</td>
                                                <td style={{ padding: '9px 12px', color: '#374151', whiteSpace: 'nowrap' }}>{row.exp_date || '—'}</td>
                                                <td style={{ padding: '9px 12px', minWidth: 200 }}>
                                                    {row._errors && row._errors.length > 0 ? (
                                                        <ul style={{ margin: 0, padding: '0 0 0 14px', color: '#dc2626', fontSize: '0.72rem' }}>
                                                            {row._errors.map((err, ei) => <li key={ei}>{err}</li>)}
                                                        </ul>
                                                    ) : (
                                                        <span style={{ color: '#22c55e', fontSize: '0.72rem' }}>—</span>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                                {displayRows.length === 0 && (
                                    <div style={{ padding: '30px', textAlign: 'center', color: '#94a3b8' }}>
                                        No rows to display.
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* ── STEP: IMPORTING ───────────────────────────────────── */}
                    {step === 'importing' && (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 200, gap: 20 }}>
                            <Loader size={48} color="#2563eb" style={{ animation: 'importSpin 1s linear infinite' }} />
                            <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#1e293b' }}>Creating Purchase Transactions...</div>
                            <div style={{ fontSize: '0.85rem', color: '#64748b' }}>Please wait. Do not close this window.</div>
                        </div>
                    )}

                    {/* ── STEP: DONE ────────────────────────────────────────── */}
                    {step === 'done' && result && (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 24, paddingTop: 20 }}>
                            <div style={{
                                width: 80, height: 80, borderRadius: '50%',
                                background: 'linear-gradient(135deg, #22c55e, #16a34a)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                boxShadow: '0 12px 24px #22c55e30',
                                animation: 'importBounce 0.5s ease-out',
                            }}>
                                <CheckCircle size={40} color="white" />
                            </div>
                            <div style={{ textAlign: 'center' }}>
                                <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#1e293b', marginBottom: 8 }}>
                                    Import Successful!
                                </div>
                                <div style={{ fontSize: '0.9rem', color: '#64748b' }}>
                                    {result.totalImported} rows imported into {result.transactions.length} transaction(s).
                                </div>
                            </div>

                            {/* Created Transactions */}
                            <div style={{
                                background: '#f8fafc', borderRadius: 14, padding: '20px 24px',
                                width: '100%', maxWidth: 600, border: '1px solid #e2e8f0',
                            }}>
                                <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#64748b', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                    Created Transactions
                                </div>
                                {result.transactions.map((tx, i) => (
                                    <div key={i} style={{
                                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                        padding: '10px 14px', background: 'white', borderRadius: 10,
                                        border: '1px solid #e2e8f0', marginBottom: i < result.transactions.length - 1 ? 8 : 0,
                                    }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                            <ShoppingCart size={16} color="#2563eb" />
                                            <span style={{ fontWeight: 700, color: '#2563eb', fontSize: '0.9rem' }}>{tx.trans_no}</span>
                                        </div>
                                        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                                            {badgePill('#eff6ff', '#1d4ed8', `${tx.rowCount} items`)}
                                            <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{tx.trans_date}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <div style={{ display: 'flex', gap: 12 }}>
                                <button
                                    onClick={() => { onImportSuccess?.(); handleClose(); }}
                                    style={{
                                        background: 'linear-gradient(135deg, #2563eb, #1d4ed8)',
                                        color: 'white', border: 'none', borderRadius: 12,
                                        padding: '13px 32px', fontSize: '0.9rem', fontWeight: 700,
                                        cursor: 'pointer', boxShadow: '0 8px 16px #2563eb30',
                                    }}
                                >
                                    Done &amp; Close
                                </button>
                                <button
                                    onClick={handleReset}
                                    style={{
                                        background: '#f8fafc', border: '1px solid #e2e8f0',
                                        color: '#64748b', borderRadius: 12, padding: '13px 24px',
                                        fontSize: '0.9rem', fontWeight: 600, cursor: 'pointer',
                                    }}
                                >
                                    Import Another File
                                </button>
                            </div>
                        </div>
                    )}

                </div>

                {/* ── FOOTER ─────────────────────────────────────────────────── */}
                {step === 'preview' && (
                    <div style={{
                        padding: '20px 32px', background: '#f8fafc',
                        borderTop: '1px solid #e2e8f0',
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        flexShrink: 0, gap: 12, flexWrap: 'wrap',
                    }}>
                        <div style={{ fontSize: '0.82rem', color: '#64748b' }}>
                            {summary?.validRows > 0
                                ? <><strong style={{ color: '#16a34a' }}>{summary.validRows}</strong> valid rows will be imported.</>
                                : <span style={{ color: '#dc2626' }}>No valid rows to import.</span>
                            }
                            {summary?.invalidRows > 0 && (
                                <span style={{ color: '#ea580c', marginLeft: 8 }}>
                                    {summary.invalidRows} invalid row(s) will be skipped.
                                </span>
                            )}
                        </div>
                        <div style={{ display: 'flex', gap: 12 }}>
                            <button
                                onClick={handleClose}
                                style={{
                                    background: '#f1f5f9', border: '1px solid #e2e8f0',
                                    color: '#64748b', borderRadius: 10, padding: '11px 22px',
                                    fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer',
                                }}
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleConfirmImport}
                                disabled={!summary || summary.validRows === 0 || importing}
                                style={{
                                    background: summary?.validRows > 0
                                        ? 'linear-gradient(135deg, #2563eb, #1d4ed8)'
                                        : '#e2e8f0',
                                    color: summary?.validRows > 0 ? 'white' : '#94a3b8',
                                    border: 'none', borderRadius: 10, padding: '11px 28px',
                                    fontSize: '0.85rem', fontWeight: 700, cursor: summary?.validRows > 0 ? 'pointer' : 'not-allowed',
                                    display: 'flex', alignItems: 'center', gap: 8,
                                    boxShadow: summary?.validRows > 0 ? '0 8px 16px #2563eb25' : 'none',
                                    transition: 'all 0.2s',
                                }}
                            >
                                {importing
                                    ? <><Loader size={16} style={{ animation: 'importSpin 1s linear infinite' }} /> Importing...</>
                                    : <><ShoppingCart size={16} /> Confirm Import ({summary?.validRows || 0} rows)</>
                                }
                            </button>
                        </div>
                    </div>
                )}

            </div>

            <style>{`
                @keyframes importFadeIn { from { opacity: 0; } to { opacity: 1; } }
                @keyframes importSpin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
                @keyframes importBounce {
                    0%   { transform: scale(0.7); opacity: 0; }
                    60%  { transform: scale(1.1); }
                    100% { transform: scale(1); opacity: 1; }
                }
                .import-closing { animation: importFadeIn 0.25s ease-out reverse forwards !important; }
            `}</style>
        </div>
    );

    return ReactDOM.createPortal(modal, document.body);
};

export default PurchaseImportModal;
