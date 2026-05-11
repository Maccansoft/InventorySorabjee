import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Plus, Trash2, Edit2, Save, X, Activity, Barcode, Calendar, Settings } from 'lucide-react';

const API = '/api/inventory';

const BarcodeSetup = ({ isFYClosed }) => {
    const [records, setRecords] = useState([]);
    const [makers, setMakers] = useState([]);
    const [loading, setLoading] = useState(false);
    const [editId, setEditId] = useState(null);
    const [formData, setFormData] = useState({
        format_type: '',
        maker_id: '',
        sample_barcode: '',
        lot_no: '',
        sno: '',
        exp_date: '',
        mfg_years_less: 3,
        is_active: 1
    });

    const fetchData = async () => {
        try {
            const [setupRes, makerRes] = await Promise.all([
                axios.get(`${API}/barcode-setup`),
                axios.get(`${API}/makers`)
            ]);
            setRecords(setupRes.data);
            setMakers(makerRes.data);
        } catch (e) { console.error(e); }
    };

    useEffect(() => { fetchData(); }, []);

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        setFormData(prev => ({ ...prev, [name]: type === 'checkbox' ? (checked ? 1 : 0) : value }));
    };

    const handleSave = async (e) => {
        e.preventDefault();
        if (isFYClosed) return;
        setLoading(true);
        try {
            const payload = {
                ...formData,
                format_type: (formData.format_type || '').trim(),
                sample_barcode: (formData.sample_barcode || '').trim(),
                lot_no: (formData.lot_no || '').trim(),
                sno: (formData.sno || '').trim()
            };

            if (editId) {
                await axios.put(`${API}/barcode-setup/${editId}`, payload);
            } else {
                await axios.post(`${API}/barcode-setup`, payload);
            }

            fetchData();
            resetForm();
            alert(editId ? "Updated successfully!" : "Saved successfully!");
        } catch (e) { alert(e.response?.data?.error || "Save error"); }
        finally { setLoading(false); }
    };

    const handleEdit = (r) => {
        setEditId(r.id);
        setFormData({
            format_type: r.format_type || '',
            maker_id: r.maker_id || '',
            sample_barcode: r.sample_barcode || '',
            lot_no: r.lot_no || '',
            sno: r.sno || '',
            exp_date: r.exp_date ? r.exp_date.split('T')[0] : '',
            mfg_years_less: r.mfg_years_less || 3,
            is_active: r.is_active
        });
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const resetForm = () => {
        setEditId(null);
        setFormData({ format_type: '', maker_id: '', sample_barcode: '', lot_no: '', sno: '', exp_date: '', mfg_years_less: 3, is_active: 1 });
    };

    const handleDelete = async (id) => {
        if (isFYClosed || !window.confirm("Are you sure?")) return;
        try {
            await axios.delete(`${API}/barcode-setup/${id}`);
            fetchData();
        } catch (e) { alert("Delete error"); }
    };

    const calculateMfgDate = (exp, years) => {
        if (!exp || !years) return '--';
        const d = new Date(exp);
        if (isNaN(d.getTime())) return '--';
        d.setFullYear(d.getFullYear() - parseInt(years));
        return d.toISOString().split('T')[0];
    };

    const inputStyle = { width: '100%', padding: '10px 14px', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: '14px', outline: 'none', transition: 'border 0.2s' };
    const labelStyle = { display: 'block', fontSize: '12px', fontWeight: 600, color: '#64748b', marginBottom: 6 };

    return (
        <div className="animate-fade-in" style={{ padding: 24 }}>
            <div style={{ background: 'white', borderRadius: 16, boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)', padding: 24, marginBottom: 32 }}>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 800, marginBottom: 24, display: 'flex', alignItems: 'center', gap: 10 }}>
                    <Settings color="#6366f1" /> Barcode Format Setup
                </h2>

                <form onSubmit={handleSave} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 20 }}>
                    <div>
                        <label style={labelStyle}>Format Type (Type 1, Type 2, etc.)</label>
                        <input name="format_type" value={formData.format_type} onChange={handleChange} placeholder="e.g. Type 1" style={inputStyle} required />
                    </div>
                    <div>
                        <label style={labelStyle}>Maker</label>
                        <select name="maker_id" value={formData.maker_id} onChange={handleChange} style={inputStyle} required>
                            <option value="">-- Select Maker --</option>
                            {makers.map(m => (
                                <option key={m.id} value={m.id}>{m.name}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label style={labelStyle}>Actual Barcode Scan (Sample)</label>
                        <input name="sample_barcode" value={formData.sample_barcode} onChange={handleChange} placeholder="Scan sample here" style={{ ...inputStyle, borderColor: '#6366f1', background: '#f5f3ff' }} required />
                    </div>

                    <div style={{ gridColumn: '1 / -1', borderBottom: '1px solid #f1f5f9', margin: '10px 0' }} />
                    <h4 style={{ gridColumn: '1 / -1', margin: 0, fontSize: '14px', fontWeight: 700 }}>Manual Data Definition</h4>

                    <div>
                        <label style={labelStyle}>LOT NO (Manual definition)</label>
                        <input name="lot_no" value={formData.lot_no} onChange={handleChange} placeholder="e.g. 123456" style={inputStyle} required />
                    </div>
                    <div>
                        <label style={labelStyle}>SNO (Manual definition)</label>
                        <input name="sno" value={formData.sno} onChange={handleChange} placeholder="e.g. 01" style={inputStyle} />
                    </div>
                    <div>
                        <label style={labelStyle}>EXP DATE (Manual definition)</label>
                        <input type="date" name="exp_date" value={formData.exp_date} onChange={handleChange} style={inputStyle} required />
                    </div>

                    <div style={{ gridColumn: '1 / -1', borderBottom: '1px solid #f1f5f9', margin: '10px 0' }} />
                    
                    <div>
                        <label style={labelStyle}>MFG Years Less</label>
                        <input type="number" name="mfg_years_less" value={formData.mfg_years_less} onChange={handleChange} style={inputStyle} min="0" max="10" />
                    </div>
                    <div>
                        <label style={labelStyle}>Auto Calculated MFG DATE</label>
                        <input readOnly value={calculateMfgDate(formData.exp_date, formData.mfg_years_less)} style={{ ...inputStyle, background: '#f8fafc', color: '#64748b' }} />
                    </div>
                    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10 }}>
                        <label style={{ ...labelStyle, display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', marginBottom: 12 }}>
                            <input type="checkbox" name="is_active" checked={formData.is_active === 1} onChange={handleChange} style={{ width: 16, height: 16 }} />
                            Is Active
                        </label>
                        <button type="submit" className="btn-primary" disabled={loading || isFYClosed} style={{ width: '100%', height: 42 }}>
                            <Save size={18} /> {loading ? (editId ? "Updating..." : "Saving...") : (editId ? "Update Configuration" : "Save Configuration")}
                        </button>
                        {editId && (
                            <button type="button" onClick={resetForm} style={{ ...inputStyle, background: '#f1f5f9', color: '#64748b', cursor: 'pointer', height: 42 }}>
                                <X size={18} /> Cancel
                            </button>
                        )}
                    </div>
                </form>
            </div>

            <div style={{ background: 'white', borderRadius: 16, boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)', overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                        <tr>
                            <th style={{ padding: '16px 20px', textAlign: 'left', fontSize: '13px', fontWeight: 700, color: '#475569' }}>Format / Maker</th>
                            <th style={{ padding: '16px 20px', textAlign: 'left', fontSize: '13px', fontWeight: 700, color: '#475569' }}>Sample Barcode</th>
                            <th style={{ padding: '16px 20px', textAlign: 'left', fontSize: '13px', fontWeight: 700, color: '#475569' }}>Lot / Sno</th>
                            <th style={{ padding: '16px 20px', textAlign: 'left', fontSize: '13px', fontWeight: 700, color: '#475569' }}>Exp / Mfg</th>
                            <th style={{ padding: '16px 20px', textAlign: 'center', fontSize: '13px', fontWeight: 700, color: '#475569' }}>Status</th>
                            <th style={{ padding: '16px 20px', textAlign: 'right', fontSize: '13px', fontWeight: 700, color: '#475569' }}>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {records.map((r, i) => (
                            <tr key={r.id} style={{ borderBottom: '1px solid #f1f5f9', background: i % 2 === 0 ? 'white' : '#fafafa' }}>
                                <td style={{ padding: '16px 20px' }}>
                                    <div style={{ fontWeight: 700, fontSize: '14px' }}>{r.format_type}</div>
                                    <div style={{ fontSize: '12px', color: '#64748b' }}>{r.maker_name}</div>
                                </td>
                                <td style={{ padding: '16px 20px', fontSize: '12px', color: '#64748b', maxWidth: 250, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                    {r.sample_barcode}
                                </td>
                                <td style={{ padding: '16px 20px', fontSize: '13px' }}>
                                    <div>L: {r.lot_no}</div>
                                    <div>S: {r.sno || '--'}</div>
                                </td>
                                <td style={{ padding: '16px 20px', fontSize: '13px' }}>
                                    <div style={{ color: '#ef4444' }}>E: {r.exp_date ? r.exp_date.split('T')[0] : '--'}</div>
                                    <div style={{ color: '#64748b' }}>M: {calculateMfgDate(r.exp_date, r.mfg_years_less)}</div>
                                </td>
                                <td style={{ padding: '16px 20px', textAlign: 'center' }}>
                                    <span style={{ padding: '4px 8px', borderRadius: 4, fontSize: '11px', background: r.is_active ? '#ecfdf5' : '#fef2f2', color: r.is_active ? '#059669' : '#dc2626', fontWeight: 700 }}>
                                        {r.is_active ? "ACTIVE" : "INACTIVE"}
                                    </span>
                                </td>
                                <td style={{ padding: '16px 20px', textAlign: 'right', display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                                    <button onClick={() => handleEdit(r)} disabled={isFYClosed} style={{ background: 'none', border: 'none', color: '#6366f1', cursor: 'pointer', padding: 6 }}>
                                        <Edit2 size={16} />
                                    </button>
                                    <button onClick={() => handleDelete(r.id)} disabled={isFYClosed} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: 6 }}>
                                        <Trash2 size={16} />
                                    </button>
                                </td>
                            </tr>
                        ))}
                        {records.length === 0 && (
                            <tr><td colSpan="6" style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>No configurations saved yet.</td></tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default BarcodeSetup;
