import React, { useState, useEffect } from 'react';
import { X, Upload, FileText, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import * as XLSX from 'xlsx';
import axios from 'axios';

const ImportModal = ({ isOpen, onClose, title, endpoint, fiscal_year_id, location_id, onComplete }) => {
    const [file, setFile] = useState(null);
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState(null);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (isOpen) {
            setFile(null);
            setResult(null);
            setError(null);
            setLoading(false);
        }
    }, [isOpen]);

    if (!isOpen) return null;

    const handleFileChange = (e) => {
        const selectedFile = e.target.files[0];
        if (selectedFile) {
            if (selectedFile.name.toLowerCase().endsWith('.csv')) {
                setFile(selectedFile);
                setError(null);
                setResult(null);
            } else {
                setError("Please select a .csv file.");
                setFile(null);
            }
        }
    };

    const handleImport = async () => {
        if (!file) return;

        setLoading(true);
        setError(null);

        try {
            const reader = new FileReader();
            reader.onload = async (e) => {
                try {
                    const data = new Uint8Array(e.target.result);
                    const workbook = XLSX.read(data, { type: 'array' });
                    const sheetName = workbook.SheetNames[0];
                    const worksheet = workbook.Sheets[sheetName];
                    const json = XLSX.utils.sheet_to_json(worksheet);

                    if (json.length === 0) {
                        setError("The file is empty.");
                        setLoading(false);
                        return;
                    }

                    // Basic header validation (Maker, Category, Qty are minimum required)
                    const headers = Object.keys(json[0]);
                    const required = ['Maker', 'Category', 'Qty'];
                    const missing = required.filter(h => !headers.includes(h) && !headers.includes(h.toLowerCase()));
                    
                    if (missing.length > 0) {
                        setError(`Invalid file format. Missing headers: ${missing.join(', ')}`);
                        setLoading(false);
                        return;
                    }

                    const response = await axios.post(endpoint, {
                        rows: json,
                        fiscal_year_id,
                        location_id
                    });

                    setResult(response.data);
                    if (onComplete && response.data.imported > 0) onComplete();
                } catch (err) {
                    setError(err.response?.data?.error || err.message);
                } finally {
                    setLoading(false);
                }
            };
            reader.readAsArrayBuffer(file);
        } catch (err) {
            setError(err.message);
            setLoading(false);
        }
    };

    return (
        <div className="modal-backdrop" style={{ zIndex: 1100 }}>
            <div className="modal-content premium-card animate-scale-in" style={{ maxWidth: 500, width: '90%' }}>
                <div className="modal-header">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div className="icon-wrapper bg-blue-subtle" style={{ width: 40, height: 40, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#eff6ff' }}>
                            <Upload size={20} className="text-blue-600" style={{ color: '#2563eb' }} />
                        </div>
                        <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 700 }}>Import {title}</h3>
                    </div>
                    <button className="btn-close" onClick={onClose} style={{ color: '#64748b' }}><X size={20} /></button>
                </div>

                <div className="modal-body" style={{ padding: '24px' }}>
                    {!result ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                            <p style={{ color: '#64748b', fontSize: '0.875rem', margin: 0 }}>
                                Select a .csv file to import data. The format must match the exported template exactly.
                            </p>
                            
                            <div className={`upload-zone ${file ? 'active' : ''}`} style={{
                                border: '2px dashed #e2e8f0',
                                borderRadius: 12,
                                padding: '40px 20px',
                                textAlign: 'center',
                                transition: 'all 0.3s',
                                background: file ? '#f0f9ff' : '#f8fafc',
                                borderColor: file ? '#3b82f6' : '#e2e8f0'
                            }}>
                                <input 
                                    type="file" 
                                    accept=".csv" 
                                    onChange={handleFileChange} 
                                    id="csv-upload"
                                    style={{ display: 'none' }}
                                />
                                <label htmlFor="csv-upload" style={{ cursor: 'pointer', display: 'block' }}>
                                    <div style={{ margin: '0 auto 12px', width: 48, height: 48, borderRadius: '50%', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}>
                                        <FileText className={file ? 'text-blue-600' : 'text-slate-400'} size={24} style={{ margin: 'auto' }} />
                                    </div>
                                    <span style={{ fontWeight: 600, color: file ? '#1e293b' : '#64748b', fontSize: '0.9rem' }}>
                                        {file ? file.name : 'Click to browse CSV file'}
                                    </span>
                                </label>
                            </div>

                            {error && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: 12, background: '#fef2f2', borderRadius: 8, color: '#b91c1c', fontSize: '0.85rem' }}>
                                    <AlertCircle size={16} />
                                    <span>{error}</span>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="animate-fade-in">
                            <div style={{ textAlign: 'center', marginBottom: 24 }}>
                                <div style={{ margin: '0 auto 16px', width: 64, height: 64, borderRadius: '50%', background: '#dcfce7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <CheckCircle className="text-green-600" size={32} style={{ margin: 'auto', color: '#16a34a' }} />
                                </div>
                                <h4 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#1e293b', margin: 0 }}>Import Complete</h4>
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 16px', background: '#f8fafc', borderRadius: 8 }}>
                                    <span style={{ color: '#64748b' }}>Total Records</span>
                                    <span style={{ fontWeight: 700 }}>{result.total}</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 16px', background: '#f0fdf4', borderRadius: 8, color: '#166534' }}>
                                    <span style={{ fontWeight: 600 }}>Successfully Imported</span>
                                    <span style={{ fontWeight: 700 }}>{result.imported}</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 16px', background: result.failed > 0 ? '#fef2f2' : '#f8fafc', borderRadius: 8, color: result.failed > 0 ? '#991b1b' : '#64748b' }}>
                                    <span>Failed Rows</span>
                                    <span style={{ fontWeight: 700 }}>{result.failed}</span>
                                </div>
                            </div>

                            {result.errors && result.errors.length > 0 && (
                                <div style={{ marginTop: 16 }}>
                                    <p style={{ fontSize: '0.7rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>Error Details</p>
                                    <div className="premium-scrollbar" style={{ maxHeight: 150, overflow: 'auto', background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, padding: 12 }}>
                                        {result.errors.slice(0, 50).map((err, i) => (
                                            <div key={i} style={{ fontSize: '0.75rem', padding: '6px 0', borderBottom: i < result.errors.length - 1 ? '1px solid #f1f5f9' : 'none', color: '#b91c1c' }}>
                                                <strong>Row {err.row}:</strong> {err.error}
                                            </div>
                                        ))}
                                        {result.errors.length > 50 && <p style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: 8 }}>... and {result.errors.length - 50} more errors.</p>}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                <div className="modal-footer" style={{ borderTop: '1px solid #f1f5f9', padding: '20px 24px', display: 'flex', justifyContent: 'flex-end' }}>
                    {!result ? (
                        <div style={{ display: 'flex', gap: 12, width: '100%' }}>
                            <button className="btn-secondary" style={{ flex: 1, height: 44 }} onClick={onClose} disabled={loading}>Cancel</button>
                            <button 
                                className="btn-primary" 
                                style={{ flex: 1, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, background: '#4f6339' }} 
                                onClick={handleImport}
                                disabled={!file || loading}
                            >
                                {loading ? <><Loader2 className="animate-spin" size={18} /> Processing...</> : <><Upload size={18} /> Start Import</>}
                            </button>
                        </div>
                    ) : (
                        <button className="btn-primary" style={{ width: '100%', height: 44, background: '#4f6339' }} onClick={onClose}>Done</button>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ImportModal;
