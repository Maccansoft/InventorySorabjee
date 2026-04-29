import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { Plus, Trash2, Zap, Search, RefreshCw, Edit2 } from 'lucide-react';
import { exportToCSV } from '../../utils/exportUtils';

const API = '/api/inventory';

const PowerMaster = () => {
    const [powers, setPowers] = useState([]);
    const [power, setPower] = useState('');
    const [loading, setLoading] = useState(false);
    const [search, setSearch] = useState('');

    const [editId, setEditId] = useState(null);
    const fileInputRef = useRef(null);
    const powerInputRef = useRef(null);

    const fetchPowers = async () => {
        setLoading(true);
        try {
            const { data } = await axios.get(`${API}/powers`);
            setPowers(data);
        } catch (e) { console.error(e); }
        setLoading(false);
    };

    useEffect(() => { fetchPowers(); }, []);

    const resetForm = () => {
        setPower('');
        setEditId(null);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!power.trim()) return;
        try {
            if (editId) {
                await axios.put(`${API}/powers/${editId}`, { power: power.toUpperCase() });
            } else {
                await axios.post(`${API}/powers`, { power: power.toUpperCase() });
            }
            resetForm();
            fetchPowers();
        } catch (e) { alert(e.response?.data?.error || 'Error saving power'); }
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Are you sure you want to delete this power rating?')) return;
        try {
            await axios.delete(`${API}/powers/${id}`);
            fetchPowers();
        } catch (e) { alert(e.response?.data?.error || 'Error deleting power rating'); }
    };

    const handleEdit = (p) => {
        setPower(p.power);
        setEditId(p.id);
        if (powerInputRef.current) powerInputRef.current.focus();
    };

    const handleImportClick = () => {
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
            fileInputRef.current.click();
        }
    };

    const handleImportFile = (e) => {
        const file = e.target.files && e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (evt) => {
            try {
                const text = evt.target.result;
                const lines = text.split(/\r?\n/);
                const payload = [];

                for (let i = 0; i < lines.length; i++) {
                    let line = lines[i].trim();
                    if (!line) continue;

                    // Take first column if there are commas
                    line = line.split(',')[0].trim();
                    if (!line) continue;

                    // Skip header row like "power"
                    if (i === 0 && line.toLowerCase() === 'power') continue;

                    payload.push({ power: line });
                }

                if (!payload.length) {
                    alert('No valid power values found in the CSV file.');
                    return;
                }

                const { data } = await axios.post(`${API}/powers/import`, { powers: payload });
                const msg = data && data.inserted != null
                    ? `Imported successfully. Added: ${data.inserted}, Skipped: ${data.skipped}.`
                    : 'Powers imported successfully.';
                alert(msg);
                fetchPowers();
            } catch (err) {
                alert(err.response?.data?.error || 'Error importing powers from CSV.');
            }
        };
        reader.readAsText(file);
    };

    const filteredPowers = powers.filter(p => (p.power || '').toLowerCase().includes(search.toLowerCase()));

    return (
        <div className="animate-fade-in">
            <div className="inventory-card premium-card">
                <div className="card-header-flex">
                    <div className="header-icon-title">
                        <div className="icon-wrapper bg-orange-light"><Zap size={22} /></div>
                        <div>
                            <h3>Power Master</h3>
                            <p>Manage engine power or capacity ratings</p>
                        </div>
                    </div>
                    <div className="action-group">
                        <button
                            className="btn-secondary-premium"
                            type="button"
                            onClick={() => {
                                if (!powers.length) {
                                    alert('No power records to export.');
                                    return;
                                }
                                const data = powers.map(p => ({
                                    id: p.id,
                                    power: p.power
                                }));
                                exportToCSV('Power_Master', ['ID', 'Power'], data, ['id', 'power']);
                            }}
                        >
                            Export CSV
                        </button>
                        <button className="btn-refresh" onClick={fetchPowers} disabled={loading}>
                            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
                        </button>
                    </div>
                </div>

                <form onSubmit={handleSubmit} className="inventory-premium-form">
                    <div className="form-row">
                        <div className="input-group-premium flex-1">
                            <label>Power</label>
                            <input
                                className="input-minimal"
                                type="text"
                                ref={powerInputRef}
                                value={power}
                                onChange={e => setPower(e.target.value)}
                                placeholder="e.g. 1000CC, 1300CC, 1.8L"
                                required
                            />
                        </div>
                        <div className="flex gap-2">
                            <button
                                type="button"
                                className="btn-secondary-premium h-[48px]"
                                onClick={handleImportClick}
                            >
                                Import CSV
                            </button>
                            {editId && (
                                <button type="button" className="btn-secondary-premium h-[48px]" onClick={resetForm}>Discard</button>
                            )}
                            <button type="submit" className="btn-primary-premium h-[48px]">
                                <Plus size={18} /> {editId ? 'Update Power' : 'Add Power'}
                            </button>
                        </div>
                    </div>
                </form>

                <input
                    type="file"
                    ref={fileInputRef}
                    accept=".csv"
                    style={{ display: 'none' }}
                    onChange={handleImportFile}
                />

                <div className="table-search-premium">
                    <Search size={16} className="search-icon" />
                    <input
                        type="text"
                        placeholder="Search power ratings..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                    />
                </div>

                <div className="premium-table-container">
                    <table className="premium-table">
                        <thead>
                            <tr>
                                <th style={{ width: '80px' }}>ID</th>
                                <th>Power Rating</th>
                                <th style={{ width: '120px' }} className="text-center">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredPowers.length === 0 ? (
                                <tr><td colSpan="3" className="empty-state">No power ratings found.</td></tr>
                            ) : (
                                filteredPowers.map(p => (
                                    <tr key={p.id} className="table-row-hover">
                                        <td><span className="id-badge">{p.id}</span></td>
                                        <td className="font-semibold">{p.power}</td>
                                        <td className="text-center">
                                            <div className="action-buttons flex justify-center gap-2">
                                                <button onClick={() => handleEdit(p)} className="btn-icon-edit" style={{ color: '#6366f1' }} title="Edit">
                                                    <Edit2 size={16} />
                                                </button>
                                                <button onClick={() => handleDelete(p.id)} className="btn-icon-delete" title="Delete">
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default PowerMaster;
