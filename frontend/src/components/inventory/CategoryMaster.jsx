import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Plus, Trash2, Layers, Search, RefreshCw, Edit2, X, Save } from 'lucide-react';
import SearchableSelect from '../common/SearchableSelect';
import { formatAmount } from '../../utils/numberUtils';

const API = '/api/inventory';

const CategoryMaster = () => {
    const [categories, setCategories] = useState([]);
    const [makers, setMakers] = useState([]);
    const [form, setForm] = useState({ name: '', maker_id: '', rate: '', description: '' });
    const [loading, setLoading] = useState(false);
    const [search, setSearch] = useState('');
    const [editId, setEditId] = useState(null);
    const [isModalOpen, setIsModalOpen] = useState(false);

    const fetchMakers = async () => {
        try {
            const { data } = await axios.get(`${API}/makers`);
            setMakers(data);
        } catch (e) { console.error(e); }
    };

    const fetchCategories = async () => {
        setLoading(true);
        try {
            const { data } = await axios.get(`${API}/categories`);
            setCategories(data);
        } catch (e) { console.error(e); }
        setLoading(false);
    };

    useEffect(() => {
        fetchMakers();
        fetchCategories();
    }, []);

    const resetForm = () => {
        setForm({ name: '', maker_id: '', rate: '', description: '' });
        setEditId(null);
        setIsModalOpen(false);
    };

    const handleAddNew = () => {
        resetForm();
        setIsModalOpen(true);
    };

    const handleEdit = (c) => {
        setForm({ name: c.name, maker_id: c.maker_id, rate: c.rate ? Math.floor(c.rate) : '', description: c.description || '' });
        setEditId(c.id);
        setIsModalOpen(true);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            const payload = {
                ...form,
                name: form.name.toUpperCase(),
                rate: form.rate ? Math.floor(form.rate) : 0
            };
            
            if (editId) {
                await axios.put(`${API}/categories/${editId}`, payload);
            } else {
                await axios.post(`${API}/categories`, payload);
            }
            resetForm();
            fetchCategories();
        } catch (e) { alert(e.response?.data?.error || 'Error saving category'); }
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Delete this category?')) return;
        try {
            await axios.delete(`${API}/categories/${id}`);
            fetchCategories();
        } catch (e) { alert(e.response?.data?.error || 'Error deleting category'); }
    };

    const filteredCategories = categories.filter(c =>
        (c.name || '').toLowerCase().includes(search.toLowerCase()) ||
        (c.maker_name || '').toLowerCase().includes(search.toLowerCase()) ||
        (c.description || '').toLowerCase().includes(search.toLowerCase())
    );

    return (
        <div className="animate-fade-in">
            <div className="inventory-card premium-card">
                <div className="card-header-flex">
                    <div className="header-icon-title">
                        <div className="icon-wrapper bg-green-light"><Layers size={22} /></div>
                        <div>
                            <h3>Category Master</h3>
                            <p>Define product categories and groups</p>
                        </div>
                    </div>
                    <div className="action-buttons flex gap-2">
                        <button className="btn-primary-premium flex items-center gap-2" onClick={handleAddNew} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <Plus size={18} /> Add Category
                        </button>
                        <button className="btn-refresh" onClick={fetchCategories} disabled={loading}>
                            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
                        </button>
                    </div>
                </div>

                <div className="table-search-premium">
                    <Search size={16} className="search-icon" />
                    <input
                        type="text"
                        placeholder="Search categories, makers or descriptions..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                    />
                </div>

                <div className="premium-table-container">
                    <table className="premium-table">
                        <thead>
                            <tr>
                                <th style={{ width: '80px' }}>ID</th>
                                <th>Maker</th>
                                <th>Category Name</th>
                                <th>Rate</th>
                                <th>Description</th>
                                <th style={{ width: '120px' }} className="text-center">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredCategories.length === 0 ? (
                                <tr><td colSpan="5" className="empty-state">No categories found.</td></tr>
                            ) : (
                                filteredCategories.map(c => (
                                    <tr key={c.id} className="table-row-hover">
                                        <td><span className="id-badge">{c.id}</span></td>
                                        <td className="font-medium text-secondary">{c.maker_name}</td>
                                        <td className="font-semibold">{c.name}</td>
                                        <td className="font-medium">{Math.floor(c.rate || 0)}</td>
                                        <td className="text-secondary italic" style={{ fontSize: '0.85rem' }}>{c.description || '---'}</td>
                                        <td className="text-center">
                                            <div className="action-buttons flex justify-center gap-2" style={{ display: 'flex', justifyContent: 'center', gap: '8px' }}>
                                                <button onClick={() => handleEdit(c)} className="btn-icon-edit" style={{ color: '#6366f1' }} title="Edit">
                                                    <Edit2 size={16} />
                                                </button>
                                                <button onClick={() => handleDelete(c.id)} className="btn-icon-delete" title="Delete">
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

            {/* Modal for Add/Edit Category */}
            {isModalOpen && (
                <div className="modal-backdrop">
                    <div className="modal-content animate-fade-in" style={{ maxWidth: '600px' }}>
                        <div className="modal-header">
                            <h2 style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                {editId ? <Edit2 size={24} color="#6366f1" /> : <Plus size={24} color="#22c55e" />}
                                {editId ? 'Edit Category' : 'New Category'}
                            </h2>
                            <button onClick={resetForm} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                                <X size={24} color="#64748b" />
                            </button>
                        </div>
                        <form onSubmit={handleSubmit} style={{ padding: '0' }}>
                            <div className="voucher-form">
                                <div className="form-grid" style={{ gridTemplateColumns: '1fr' }}>
                                    <div className="form-group">
                                        <label>Maker <span style={{ color: '#ef4444' }}>*</span></label>
                                        <SearchableSelect
                                            options={makers.map(m => ({ value: m.id, label: m.name }))}
                                            value={form.maker_id}
                                            onChange={val => setForm({ ...form, maker_id: val })}
                                            placeholder="— Choose Maker —"
                                        />
                                    </div>
                                    <div className="form-grid" style={{ gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                                        <div className="form-group">
                                            <label>Category Name <span style={{ color: '#ef4444' }}>*</span></label>
                                            <input
                                                type="text"
                                                value={form.name}
                                                onChange={e => setForm({ ...form, name: e.target.value })}
                                                placeholder="e.g. RAO100C"
                                                required
                                            />
                                        </div>
                                        <div className="form-group">
                                            <label>Rate <span style={{ color: '#ef4444' }}>*</span></label>
                                            <input
                                                type="number"
                                                step="1"
                                                min="0"
                                                value={form.rate}
                                                onChange={e => setForm({ ...form, rate: e.target.value ? Math.floor(e.target.value) : '' })}
                                                placeholder="0"
                                                required
                                            />
                                        </div>
                                    </div>
                                    <div className="form-group">
                                        <label>Description</label>
                                        <textarea
                                            rows={4}
                                            value={form.description}
                                            onChange={e => setForm({ ...form, description: e.target.value })}
                                            placeholder="Detailed description, specifications, or notes..."
                                            style={{ resize: 'vertical' }}
                                        />
                                    </div>
                                </div>
                            </div>
                            <div className="modal-footer">
                                <div style={{ fontSize: '0.8125rem', color: '#64748b' }}>
                                    Fields marked with <span style={{ color: '#ef4444' }}>*</span> are required
                                </div>
                                <div className="actions" style={{ display: 'flex', gap: '12px' }}>
                                    <button type="button" className="btn-secondary" onClick={resetForm}>
                                        Cancel
                                    </button>
                                    <button type="submit" className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <Save size={18} /> {editId ? 'Update Category' : 'Save Category'}
                                    </button>
                                </div>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default CategoryMaster;
