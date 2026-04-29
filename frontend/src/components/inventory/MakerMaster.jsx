import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Plus, Trash2, Box, Search, RefreshCw, Edit2 } from 'lucide-react';

const API = '/api/inventory';

const MakerMaster = () => {
    const [makers, setMakers] = useState([]);
    const [name, setName] = useState('');
    const [loading, setLoading] = useState(false);
    const [search, setSearch] = useState('');

    const [editId, setEditId] = useState(null);

    const fetchMakers = async () => {
        setLoading(true);
        try {
            const { data } = await axios.get(`${API}/makers`);
            setMakers(data);
        } catch (e) { console.error(e); }
        setLoading(false);
    };

    useEffect(() => { fetchMakers(); }, []);

    const resetForm = () => {
        setName('');
        setEditId(null);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!name.trim()) return;
        try {
            if (editId) {
                await axios.put(`${API}/makers/${editId}`, { name: name.toUpperCase() });
            } else {
                await axios.post(`${API}/makers`, { name: name.toUpperCase() });
            }
            resetForm();
            fetchMakers();
        } catch (e) { alert(e.response?.data?.error || 'Error saving maker'); }
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Are you sure you want to delete this maker?')) return;
        try {
            await axios.delete(`${API}/makers/${id}`);
            fetchMakers();
        } catch (e) { alert(e.response?.data?.error || 'Error deleting maker'); }
    };

    const handleEdit = (m) => {
        setName(m.name);
        setEditId(m.id);
    };

    const filteredMakers = makers.filter(m => (m.name || '').toLowerCase().includes(search.toLowerCase()));

    return (
        <div className="animate-fade-in">
            <div className="inventory-card premium-card">
                <div className="card-header-flex">
                    <div className="header-icon-title">
                        <div className="icon-wrapper bg-blue-light"><Box size={22} /></div>
                        <div>
                            <h3>Maker Master</h3>
                            <p>Setup vehicle or product manufacturers</p>
                        </div>
                    </div>
                    <button className="btn-refresh" onClick={fetchMakers} disabled={loading}>
                        <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="inventory-premium-form">
                    <div className="form-row">
                        <div className="input-group-premium flex-1">
                            <label>Maker Name</label>
                            <input
                                className="input-minimal"
                                type="text"
                                value={name}
                                onChange={e => setName(e.target.value)}
                                placeholder="RAYNER"
                                required
                            />
                        </div>
                        <div className="flex gap-2">
                            {editId && (
                                <button type="button" className="btn-secondary-premium h-[48px]" onClick={resetForm}>Discard</button>
                            )}
                            <button type="submit" className="btn-primary-premium h-[48px]">
                                <Plus size={18} /> {editId ? 'Update Maker' : 'Add Maker'}
                            </button>
                        </div>
                    </div>
                </form>

                <div className="table-search-premium">
                    <Search size={16} className="search-icon" />
                    <input
                        type="text"
                        placeholder="Search makers..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                    />
                </div>

                <div className="premium-table-container">
                    <table className="premium-table">
                        <thead>
                            <tr>
                                <th style={{ width: '80px' }}>ID</th>
                                <th>Maker Name</th>
                                <th style={{ width: '120px' }} className="text-center">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredMakers.length === 0 ? (
                                <tr><td colSpan="3" className="empty-state">No makers found.</td></tr>
                            ) : (
                                filteredMakers.map(m => (
                                    <tr key={m.id} className="table-row-hover">
                                        <td><span className="id-badge">{m.id}</span></td>
                                        <td className="font-semibold">{m.name}</td>
                                        <td className="text-center">
                                            <div className="action-buttons flex justify-center gap-2">
                                                <button onClick={() => handleEdit(m)} className="btn-icon-edit" style={{ color: '#6366f1' }} title="Edit">
                                                    <Edit2 size={16} />
                                                </button>
                                                <button onClick={() => handleDelete(m.id)} className="btn-icon-delete" title="Delete">
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

export default MakerMaster;
