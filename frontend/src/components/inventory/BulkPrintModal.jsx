import React, { useState } from 'react';
import { X, Printer, List, Hash } from 'lucide-react';

const BulkPrintModal = ({ isOpen, onClose, onConfirm }) => {
    const [mode, setMode] = useState('RANGE'); // 'RANGE' or 'SPECIFIC'
    const [fromNo, setFromNo] = useState('');
    const [toNo, setToNo] = useState('');
    const [specificNos, setSpecificNos] = useState('');

    if (!isOpen) return null;

    const handleConfirm = () => {
        if (mode === 'RANGE') {
            if (!fromNo || !toNo) return alert('Please provide both From and To Invoice numbers.');
            onConfirm({ mode, fromNo, toNo });
        } else {
            if (!specificNos) return alert('Please provide at least one invoice number.');
            onConfirm({ mode, specificNos });
        }
    };

    return (
        <div className="modal-backdrop">
            <div className="modal-content" style={{ maxWidth: '500px' }}>
                <div className="modal-header">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <Printer size={22} color="#2563eb" />
                        <h2 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0 }}>Print Multiple Invoices</h2>
                    </div>
                    <button onClick={onClose} style={{ color: '#94a3b8' }}><X size={24} /></button>
                </div>

                <div style={{ padding: '24px' }}>
                    <div style={{ display: 'flex', padding: '4px', background: '#f1f5f9', borderRadius: '12px', marginBottom: '24px' }}>
                        <button
                            style={{
                                flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                                padding: '10px', borderRadius: '8px', fontSize: '0.875rem', fontWeight: 700,
                                background: mode === 'RANGE' ? 'white' : 'transparent',
                                color: mode === 'RANGE' ? '#2563eb' : '#64748b',
                                boxShadow: mode === 'RANGE' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'
                            }}
                            onClick={() => setMode('RANGE')}
                        >
                            <Hash size={16} /> Range Based
                        </button>
                        <button
                            style={{
                                flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                                padding: '10px', borderRadius: '8px', fontSize: '0.875rem', fontWeight: 700,
                                background: mode === 'SPECIFIC' ? 'white' : 'transparent',
                                color: mode === 'SPECIFIC' ? '#2563eb' : '#64748b',
                                boxShadow: mode === 'SPECIFIC' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'
                            }}
                            onClick={() => setMode('SPECIFIC')}
                        >
                            <List size={16} /> Specific Invoices
                        </button>
                    </div>

                    {mode === 'RANGE' ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            <div className="form-group">
                                <label>From Invoice No</label>
                                <input
                                    type="text"
                                    placeholder="e.g. SLE/KHI/2025-2026/0001"
                                    value={fromNo}
                                    onChange={e => setFromNo(e.target.value)}
                                />
                            </div>
                            <div className="form-group">
                                <label>To Invoice No</label>
                                <input
                                    type="text"
                                    placeholder="e.g. SLE/KHI/2025-2026/0010"
                                    value={toNo}
                                    onChange={e => setToNo(e.target.value)}
                                />
                            </div>
                            <p style={{ fontSize: '11px', color: '#94a3b8', fontStyle: 'italic', margin: '4px 0 0' }}>
                                Note: Invoices will be printed in sequential order.
                            </p>
                        </div>
                    ) : (
                        <div className="form-group">
                            <label>Invoice Numbers (Comma Separated)</label>
                            <textarea
                                style={{
                                    width: '100%', height: '120px', padding: '12px', border: '1px solid #d8d4c0',
                                    borderRadius: '8px', resize: 'none', fontSize: '0.9rem'
                                }}
                                placeholder="SLE/KHI/2025-2026/0001, SLE/KHI/2025-2026/0005"
                                value={specificNos}
                                onChange={e => setSpecificNos(e.target.value)}
                            />
                        </div>
                    )}
                </div>

                <div style={{ padding: '16px 24px', background: '#f8fafc', borderTop: '1px solid #e2e8f0', display: 'flex', gap: '12px' }}>
                    <button
                        onClick={onClose}
                        className="btn-secondary"
                        style={{ flex: 1, height: '42px' }}
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleConfirm}
                        className="btn-primary"
                        style={{ flex: 2, height: '42px', justifyContent: 'center', background: '#2563eb' }}
                    >
                        <Printer size={18} /> Fetch & Print
                    </button>
                </div>
            </div>
        </div>
    );
};

export default BulkPrintModal;
