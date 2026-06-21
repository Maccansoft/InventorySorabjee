import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import {
    Search, Barcode, Package, MapPin, Calendar, RefreshCw,
    ArrowRight, User, Truck, ShoppingCart, RotateCcw,
    BookOpen, AlertCircle, CheckCircle, XCircle, Clock,
    Tag, Layers, Zap
} from 'lucide-react';

const API = '/api/inventory';

// ── Helpers ──────────────────────────────────────────────────────────────────
const fmtDate = (d) => {
    if (!d) return '—';
    try { return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }); }
    catch { return d; }
};

const TX_META = {
    'Opening Stock':    { color: '#6366f1', bg: '#eef2ff', icon: BookOpen,      dir: 'IN'  },
    'Stock Purchase':   { color: '#0284c7', bg: '#e0f2fe', icon: ShoppingCart,  dir: 'IN'  },
    'Purchase Return':  { color: '#f59e0b', bg: '#fffbeb', icon: RotateCcw,     dir: 'OUT' },
    'Transfer Request': { color: '#8b5cf6', bg: '#f5f3ff', icon: Truck,         dir: 'OUT' },
    'Stock Transfer':   { color: '#7c3aed', bg: '#f5f3ff', icon: Truck,         dir: 'MOVE'},
    'Transfer Return':  { color: '#0891b2', bg: '#ecfeff', icon: RotateCcw,     dir: 'IN'  },
    'Sales Invoice':    { color: '#dc2626', bg: '#fef2f2', icon: ShoppingCart,  dir: 'OUT' },
    'Sales Return':     { color: '#16a34a', bg: '#f0fdf4', icon: RotateCcw,     dir: 'IN'  },
};

const STATUS_META = {
    IN_STOCK:    { label: 'In Stock',    color: '#16a34a', bg: '#f0fdf4', icon: CheckCircle  },
    SOLD:        { label: 'Sold',        color: '#dc2626', bg: '#fef2f2', icon: XCircle       },
    TRANSFERRED: { label: 'Transferred', color: '#7c3aed', bg: '#f5f3ff', icon: Truck         },
    RETURNED:    { label: 'Returned',    color: '#f59e0b', bg: '#fffbeb', icon: RotateCcw     },
    NOT_FOUND:   { label: 'Not Found',   color: '#94a3b8', bg: '#f8fafc', icon: AlertCircle   },
};

// ─────────────────────────────────────────────────────────────────────────────

const SearchItemReport = ({ currentUser }) => {
    const [barcode, setBarcode] = useState('');
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState(null);   // null = no search yet
    const [error, setError] = useState('');
    const inputRef = useRef(null);

    // Auto-focus barcode input on mount
    useEffect(() => {
        if (inputRef.current) inputRef.current.focus();
    }, []);

    const handleSearch = async (val) => {
        const bc = (val || barcode).trim();
        if (!bc) { setError('Please enter or scan a barcode.'); return; }

        setLoading(true);
        setError('');
        setResult(null);

        try {
            const params = {
                barcode: bc,
                location_id: currentUser.location_id || '',
                fiscal_year_id: currentUser.fiscal_year_id || '',
            };
            const { data } = await axios.get(`${API}/search-item`, { params });
            setResult(data);
        } catch (e) {
            setError(e.response?.data?.error || 'An error occurred while searching. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            handleSearch(barcode);
        }
    };

    const handleReset = () => {
        setBarcode('');
        setResult(null);
        setError('');
        setTimeout(() => inputRef.current?.focus(), 50);
    };

    // ── Derived values ──
    const info = result?.parsedBarcodeInfo;
    const master = result?.itemMasterInfo;
    const statusMeta = result?.currentStatus ? (STATUS_META[result.currentStatus] || STATUS_META.IN_STOCK) : null;
    const history = result?.movementHistory || [];
    const hasResults = history.length > 0;

    return (
        <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

            {/* ── Scan Card ─────────────────────────────────────────────────── */}
            <div className="inventory-card premium-card" style={{ padding: '28px 32px' }}>
                <div className="card-header-flex" style={{ marginBottom: 24 }}>
                    <div className="header-icon-title">
                        <div className="icon-wrapper" style={{ background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)', borderRadius: 14, padding: 12, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Search size={22} color="#fff" />
                        </div>
                        <div>
                            <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: '#1e293b' }}>Search Item</h3>
                            <p style={{ margin: 0, fontSize: '0.82rem', color: '#64748b' }}>Scan or type a barcode to view complete stock movement history</p>
                        </div>
                    </div>
                    {result && (
                        <button
                            className="btn-secondary"
                            onClick={handleReset}
                            style={{ display: 'flex', alignItems: 'center', gap: 6, height: 36, padding: '0 14px' }}
                        >
                            <RefreshCw size={15} /> New Search
                        </button>
                    )}
                </div>

                {/* Barcode Input */}
                <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                    <div style={{ position: 'relative', flex: 1, maxWidth: 540 }}>
                        <div style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', pointerEvents: 'none' }}>
                            <Barcode size={18} />
                        </div>
                        <input
                            ref={inputRef}
                            id="search-item-barcode-input"
                            type="text"
                            value={barcode}
                            onChange={e => setBarcode(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder="Scan barcode or type Lot No / Barcode and press Enter…"
                            autoComplete="off"
                            style={{
                                width: '100%',
                                padding: '12px 16px 12px 44px',
                                fontSize: '0.95rem',
                                fontFamily: 'monospace',
                                border: '2px solid #e2e8f0',
                                borderRadius: 12,
                                outline: 'none',
                                transition: 'border-color 0.2s',
                                boxSizing: 'border-box',
                                background: '#fff',
                                letterSpacing: '0.03em',
                            }}
                            onFocus={e => e.target.style.borderColor = '#6366f1'}
                            onBlur={e => e.target.style.borderColor = '#e2e8f0'}
                        />
                    </div>
                    <button
                        className="btn-primary"
                        onClick={() => handleSearch(barcode)}
                        disabled={loading || !barcode.trim()}
                        style={{ height: 46, padding: '0 24px', display: 'flex', alignItems: 'center', gap: 8, borderRadius: 12, fontSize: '0.9rem', fontWeight: 700 }}
                    >
                        {loading ? <RefreshCw size={16} className="animate-spin" /> : <Search size={16} />}
                        {loading ? 'Searching…' : 'Search'}
                    </button>
                </div>

                {/* Validation / Error message */}
                {error && (
                    <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10, color: '#dc2626', fontSize: '0.88rem', fontWeight: 600 }}>
                        <AlertCircle size={16} /> {error}
                    </div>
                )}

                {/* API-level message (not found, parse fail) */}
                {result?.message && (
                    <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 8, padding: '12px 16px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, color: '#475569', fontSize: '0.88rem', fontWeight: 600 }}>
                        <AlertCircle size={16} color="#94a3b8" /> {result.message}
                    </div>
                )}
            </div>

            {/* ── Summary Card ──────────────────────────────────────────────── */}
            {result && info && !result.message && (
                <div style={{
                    background: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 50%, #4c1d95 100%)',
                    borderRadius: 20,
                    padding: '28px 32px',
                    color: '#fff',
                    boxShadow: '0 8px 32px rgba(99,102,241,0.25)',
                    position: 'relative',
                    overflow: 'hidden',
                }}>
                    {/* Background decoration */}
                    <div style={{ position: 'absolute', top: -40, right: -40, width: 200, height: 200, borderRadius: '50%', background: 'rgba(255,255,255,0.04)', pointerEvents: 'none' }} />
                    <div style={{ position: 'absolute', bottom: -60, left: -20, width: 160, height: 160, borderRadius: '50%', background: 'rgba(255,255,255,0.03)', pointerEvents: 'none' }} />

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16, position: 'relative' }}>

                        {/* Left: Identity */}
                        <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                                <div style={{ background: 'rgba(255,255,255,0.15)', borderRadius: 10, padding: '6px 10px', display: 'flex', alignItems: 'center', gap: 6 }}>
                                    <Barcode size={16} color="#c7d2fe" />
                                    <span style={{ fontFamily: 'monospace', fontSize: '0.8rem', color: '#c7d2fe', letterSpacing: '0.04em' }}>BARCODE</span>
                                </div>
                            </div>
                            <h2 style={{ margin: 0, fontSize: '1.6rem', fontWeight: 900, color: '#fff', letterSpacing: '-0.01em' }}>
                                {info.lot_no || '—'}
                            </h2>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginTop: 4, flexWrap: 'wrap' }}>
                                <span style={{ fontSize: '0.88rem', color: '#a5b4fc' }}>
                                    SNO: <strong style={{ color: '#e0e7ff' }}>{info.sno || '—'}</strong>
                                </span>
                            </div>
                        </div>

                        {/* Right: Status Badge */}
                        {statusMeta && (
                            <div style={{
                                background: 'rgba(255,255,255,0.12)',
                                border: '1.5px solid rgba(255,255,255,0.2)',
                                borderRadius: 14,
                                padding: '12px 20px',
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                gap: 6,
                                backdropFilter: 'blur(8px)',
                            }}>
                                <span style={{ fontSize: '0.7rem', color: '#a5b4fc', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 700 }}>Current Status</span>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <statusMeta.icon size={20} color={
                                        result.currentStatus === 'IN_STOCK' ? '#4ade80' :
                                        result.currentStatus === 'SOLD' ? '#f87171' :
                                        result.currentStatus === 'TRANSFERRED' ? '#c4b5fd' : '#fbbf24'
                                    } />
                                    <span style={{ fontWeight: 900, fontSize: '1.1rem', color: '#fff' }}>{statusMeta.label}</span>
                                </div>
                                {result.currentLocation && (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 2 }}>
                                        <MapPin size={12} color="#a5b4fc" />
                                        <span style={{ fontSize: '0.8rem', color: '#c7d2fe', fontWeight: 600 }}>{result.currentLocation}</span>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Info grid */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginTop: 24 }}>
                        {[
                            { icon: Tag,      label: 'Maker',     value: master?.maker_name || info.maker || '—'     },
                            { icon: Layers,   label: 'Category',  value: master?.category_name || '—'                 },
                            { icon: Zap,      label: 'Power',     value: master?.power_name || '—'                    },
                            { icon: Calendar, label: 'MFG Date',  value: fmtDate(info.mfg_date)                       },
                            { icon: Calendar, label: 'EXP Date',  value: fmtDate(info.exp_date)                       },
                        ].map(({ icon: Icon, label, value }) => (
                            <div key={label} style={{ background: 'rgba(255,255,255,0.08)', borderRadius: 12, padding: '12px 16px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                                    <Icon size={13} color="#a5b4fc" />
                                    <span style={{ fontSize: '0.7rem', color: '#a5b4fc', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700 }}>{label}</span>
                                </div>
                                <div style={{ fontWeight: 700, fontSize: '0.92rem', color: '#fff' }}>{value}</div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* ── Movement History Table ─────────────────────────────────────── */}
            {hasResults && (
                <div className="inventory-card premium-card" style={{ padding: 0 }}>
                    <div style={{ padding: '20px 28px 16px', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div style={{ background: '#f1f5f9', borderRadius: 10, padding: 8, display: 'flex' }}>
                            <Clock size={18} color="#6366f1" />
                        </div>
                        <div>
                            <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: '#1e293b' }}>
                                Complete Movement History
                            </h3>
                            <p style={{ margin: 0, fontSize: '0.8rem', color: '#94a3b8' }}>
                                {history.length} movement{history.length !== 1 ? 's' : ''} found — ordered from first to latest
                            </p>
                        </div>
                    </div>

                    <div className="premium-table-container" style={{ overflowX: 'auto' }}>
                        <table className="premium-table" style={{ minWidth: 1100 }}>
                            <thead>
                                <tr>
                                    <th style={{ width: 40 }}>#</th>
                                    <th>Transaction Type</th>
                                    <th>Trans No</th>
                                    <th>Date</th>
                                    <th>From Location</th>
                                    <th style={{ textAlign: 'center', width: 30 }}></th>
                                    <th>To Location</th>
                                    <th className="text-center">Qty</th>
                                    <th>Party</th>
                                    <th>Lot No</th>
                                    <th>SNO</th>
                                    <th>EXP Date</th>
                                </tr>
                            </thead>
                            <tbody>
                                {history.map((row, idx) => {
                                    const isLast = idx === history.length - 1;
                                    const meta = TX_META[row.tx_type] || { color: '#64748b', bg: '#f8fafc', icon: Package, dir: 'IN' };
                                    const TxIcon = meta.icon;

                                    return (
                                        <tr
                                            key={idx}
                                            className="table-row-hover"
                                            style={{
                                                background: isLast ? 'linear-gradient(90deg, #fefce8 0%, #fef9c3 100%)' : undefined,
                                                borderLeft: isLast ? '4px solid #f59e0b' : '4px solid transparent',
                                            }}
                                        >
                                            {/* # */}
                                            <td style={{ color: '#94a3b8', fontWeight: 700, fontSize: '0.78rem', textAlign: 'center' }}>
                                                {isLast ? (
                                                    <span style={{ background: '#f59e0b', color: '#fff', borderRadius: 6, padding: '2px 6px', fontSize: '0.7rem', fontWeight: 800 }}>LATEST</span>
                                                ) : row.seq}
                                            </td>

                                            {/* Type */}
                                            <td>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                    <div style={{ background: meta.bg, borderRadius: 8, padding: '5px 7px', display: 'flex', flexShrink: 0 }}>
                                                        <TxIcon size={14} color={meta.color} />
                                                    </div>
                                                    <span style={{ fontWeight: 700, color: meta.color, fontSize: '0.85rem', whiteSpace: 'nowrap' }}>{row.tx_type}</span>
                                                </div>
                                            </td>

                                            {/* Trans No */}
                                            <td style={{ fontFamily: 'monospace', fontSize: '0.82rem', fontWeight: 700, color: '#334155', whiteSpace: 'nowrap' }}>
                                                {row.trans_no || '—'}
                                            </td>

                                            {/* Date */}
                                            <td style={{ fontSize: '0.85rem', color: '#475569', whiteSpace: 'nowrap' }}>
                                                {row.trans_date && row.trans_date !== '1900-01-01' ? fmtDate(row.trans_date) : <span style={{ color: '#cbd5e1' }}>Opening</span>}
                                            </td>

                                            {/* From Location */}
                                            <td>
                                                {row.from_location ? (
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                                                        <MapPin size={13} color="#94a3b8" />
                                                        <span style={{ fontSize: '0.85rem', color: '#334155', fontWeight: 600 }}>{row.from_location}</span>
                                                    </div>
                                                ) : <span style={{ color: '#cbd5e1', fontSize: '0.8rem' }}>—</span>}
                                            </td>

                                            {/* Arrow */}
                                            <td style={{ textAlign: 'center' }}>
                                                {(row.from_location && row.to_location) ? (
                                                    <ArrowRight size={14} color="#94a3b8" />
                                                ) : null}
                                            </td>

                                            {/* To Location */}
                                            <td>
                                                {row.to_location ? (
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                                                        <MapPin size={13} color="#6366f1" />
                                                        <span style={{ fontSize: '0.85rem', color: '#334155', fontWeight: 600 }}>{row.to_location}</span>
                                                    </div>
                                                ) : <span style={{ color: '#cbd5e1', fontSize: '0.8rem' }}>—</span>}
                                            </td>

                                            {/* Qty */}
                                            <td className="text-center">
                                                <span style={{
                                                    fontWeight: 800,
                                                    fontSize: '0.95rem',
                                                    color: meta.dir === 'OUT' ? '#dc2626' : '#16a34a',
                                                }}>
                                                    {meta.dir === 'OUT' ? '-' : '+'}{Math.abs(row.qty)}
                                                </span>
                                            </td>

                                            {/* Party */}
                                            <td>
                                                {row.party_name ? (
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                                        <User size={13} color="#94a3b8" />
                                                        <div>
                                                            <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#334155' }}>{row.party_name}</div>
                                                            <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>{row.party_type}</div>
                                                        </div>
                                                    </div>
                                                ) : <span style={{ color: '#cbd5e1', fontSize: '0.8rem' }}>—</span>}
                                            </td>

                                            {/* Lot No */}
                                            <td style={{ fontFamily: 'monospace', fontSize: '0.82rem', color: '#475569' }}>
                                                {row.lot_no || '—'}
                                            </td>

                                            {/* SNO */}
                                            <td style={{ fontFamily: 'monospace', fontSize: '0.82rem', color: '#475569' }}>
                                                {row.sno || '—'}
                                            </td>

                                            {/* EXP Date */}
                                            <td style={{ fontSize: '0.82rem', color: '#475569', whiteSpace: 'nowrap' }}>
                                                {fmtDate(row.exp_date)}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>

                    {/* Legend */}
                    <div style={{ padding: '12px 28px 16px', borderTop: '1px solid #f1f5f9', display: 'flex', gap: 20, flexWrap: 'wrap' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <div style={{ width: 10, height: 10, borderRadius: 2, background: '#f59e0b' }} />
                            <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>Latest / Current Movement</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span style={{ fontWeight: 800, color: '#16a34a', fontSize: '0.8rem' }}>+</span>
                            <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>Stock In</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span style={{ fontWeight: 800, color: '#dc2626', fontSize: '0.8rem' }}>−</span>
                            <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>Stock Out</span>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Empty state after search with no history ─────────────────── */}
            {result && !result.message && !hasResults && (
                <div style={{ textAlign: 'center', padding: '60px 20px', color: '#94a3b8' }}>
                    <Package size={48} style={{ marginBottom: 16, opacity: 0.3 }} />
                    <p style={{ fontSize: '1rem', fontWeight: 600 }}>No stock movement found for this barcode/item.</p>
                    <p style={{ fontSize: '0.85rem', marginTop: 4 }}>The item may not have any recorded transactions in this location.</p>
                </div>
            )}

            {/* ── Idle state (no search yet) ────────────────────────────────── */}
            {!result && !error && !loading && (
                <div style={{ textAlign: 'center', padding: '60px 20px', color: '#94a3b8' }}>
                    <Barcode size={56} style={{ marginBottom: 16, opacity: 0.2 }} />
                    <p style={{ fontSize: '1rem', fontWeight: 600, color: '#cbd5e1' }}>Scan or enter a barcode above to begin</p>
                    <p style={{ fontSize: '0.82rem', marginTop: 4, color: '#e2e8f0' }}>The complete stock movement history will appear here</p>
                </div>
            )}
        </div>
    );
};

export default SearchItemReport;
