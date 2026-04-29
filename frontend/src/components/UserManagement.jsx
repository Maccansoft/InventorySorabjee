import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Plus, Edit2, Trash2, X, Save, Users, Shield, ShieldCheck, MapPin, Eye, EyeOff, Check } from 'lucide-react';

const API = '/api';

const ALL_PERMISSIONS = [
    { key: 'VIEW_ACCOUNTS', label: 'View Accounts' },
    { key: 'CREATE_ACCOUNTS', label: 'Create Accounts' },
    { key: 'EDIT_ACCOUNTS', label: 'Edit Accounts' },
    { key: 'DELETE_ACCOUNTS', label: 'Delete Accounts' },
    { key: 'VIEW_VOUCHERS', label: 'View Vouchers' },
    { key: 'CREATE_VOUCHERS', label: 'Create Vouchers' },
    { key: 'EDIT_VOUCHERS', label: 'Edit Vouchers' },
    { key: 'DELETE_VOUCHERS', label: 'Delete Vouchers' },
    { key: 'VIEW_REPORTS', label: 'View Reports' },
    { key: 'VIEW_LEDGER', label: 'View Ledger' },
    { key: 'MANAGE_USERS', label: 'Manage Users' },
];

const ROLE_ICON = {
    SUPER_ADMIN: <ShieldCheck size={15} style={{ color: '#6366f1' }} />,
    ADMIN: <Shield size={15} style={{ color: '#0284c7' }} />,
    USER: <Users size={15} style={{ color: '#10b981' }} />,
};
const ROLE_BADGE = {
    SUPER_ADMIN: { bg: '#ede9fe', color: '#6d28d9', label: 'Super Admin' },
    ADMIN: { bg: '#dbeafe', color: '#1d4ed8', label: 'Admin' },
    USER: { bg: '#d1fae5', color: '#065f46', label: 'User' },
};

const emptyForm = {
    username: '', password: '', full_name: '', role: 'USER',
    location_id: '', is_active: true, permissions: []
};

const UserManagement = ({ currentUser, locations }) => {
    const [users, setUsers] = useState([]);
    const [showForm, setShowForm] = useState(false);
    const [editUser, setEditUser] = useState(null);
    const [form, setForm] = useState(emptyForm);
    const [showPwd, setShowPwd] = useState(false);
    const [loading, setLoading] = useState(false);
    const [msg, setMsg] = useState('');
    const [err, setErr] = useState('');

    const canCreateAdmin = currentUser.role === 'SUPER_ADMIN';
    const canCreateUser = currentUser.role === 'SUPER_ADMIN' || currentUser.role === 'ADMIN';

    const fetchUsers = async () => {
        try {
            const params = currentUser.role === 'ADMIN'
                ? { role: 'ADMIN', location_id: currentUser.location_id }
                : {};
            const { data } = await axios.get(`${API}/users`, { params });
            // ADMIN can't see SUPER_ADMIN
            const filtered = currentUser.role === 'ADMIN'
                ? data.filter(u => u.role !== 'SUPER_ADMIN')
                : data;
            setUsers(filtered);
        } catch (e) { console.error(e); }
    };

    useEffect(() => { fetchUsers(); }, []);

    const openCreate = () => {
        setEditUser(null);
        setForm({
            ...emptyForm,
            // ADMIN creates users for their own location only
            location_id: currentUser.role === 'ADMIN' ? currentUser.location_id : ''
        });
        setShowForm(true);
        setErr('');
    };

    const openEdit = (user) => {
        setEditUser(user);
        setForm({
            username: user.username,
            password: '',
            full_name: user.full_name || '',
            role: user.role,
            location_id: user.location_id || '',
            is_active: user.is_active,
            permissions: user.permissions || []
        });
        setShowForm(true);
        setErr('');
    };

    const handleFormChange = (e) => {
        const { name, value, type, checked } = e.target;
        setForm(f => ({ ...f, [name]: type === 'checkbox' ? checked : value }));
    };

    const togglePermission = (key) => {
        setForm(f => ({
            ...f,
            permissions: f.permissions.includes(key)
                ? f.permissions.filter(p => p !== key)
                : [...f.permissions, key]
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true); setErr(''); setMsg('');
        try {
            const payload = {
                ...form,
                location_id: form.location_id || null,
                created_by: currentUser.id,
                // ADMIN can only create for their own location
                ...(currentUser.role === 'ADMIN' ? { location_id: currentUser.location_id } : {})
            };

            if (editUser) {
                await axios.put(`${API}/users/${editUser.id}`, payload);
                setMsg('User updated successfully');
            } else {
                await axios.post(`${API}/users`, payload);
                setMsg('User created successfully');
            }
            setShowForm(false);
            fetchUsers();
        } catch (e) {
            setErr(e.response?.data?.error || 'Error saving user');
        }
        setLoading(false);
    };

    const handleDelete = async (user) => {
        if (!window.confirm(`Delete user "${user.username}"?`)) return;
        try {
            await axios.delete(`${API}/users/${user.id}`);
            fetchUsers();
        } catch (e) {
            alert(e.response?.data?.error || 'Error deleting user');
        }
    };

    // Roles available to create based on current user role
    const availableRoles = canCreateAdmin
        ? [{ value: 'ADMIN', label: 'Admin' }, { value: 'USER', label: 'User' }]
        : [{ value: 'USER', label: 'User' }];

    // Locations available for assignment
    const availableLocations = currentUser.role === 'SUPER_ADMIN'
        ? locations.filter(l => !l.is_head_office)
        : locations.filter(l => l.id === currentUser.location_id);

    return (
        <div className="um-container animate-fade-in">
            {/* Header */}
            <div className="um-header">
                <div className="um-header-left">
                    <Users size={22} />
                    <div>
                        <h2>User Management</h2>
                        <p>{users.length} user{users.length !== 1 ? 's' : ''} registered</p>
                    </div>
                </div>
                {canCreateUser && (
                    <button className="btn-primary" onClick={openCreate}>
                        <Plus size={16} /> Add User
                    </button>
                )}
            </div>

            {msg && <div className="um-success-msg">✅ {msg}</div>}

            {/* Users Table */}
            <div className="um-table-card">
                <table className="ledger-table">
                    <thead>
                        <tr>
                            <th>#</th>
                            <th>User</th>
                            <th>Username</th>
                            <th>Role</th>
                            <th>Location</th>
                            <th>Status</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {users.length === 0 ? (
                            <tr><td colSpan="7" style={{ textAlign: 'center', padding: 40, color: '#94a3b8' }}>No users found.</td></tr>
                        ) : users.map((u, i) => (
                            <tr key={u.id}>
                                <td style={{ color: '#94a3b8', fontSize: '0.8rem' }}>{i + 1}</td>
                                <td>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                        <div className="um-avatar">{(u.full_name || u.username)[0].toUpperCase()}</div>
                                        <span style={{ fontWeight: 600 }}>{u.full_name || '—'}</span>
                                    </div>
                                </td>
                                <td><code style={{ background: '#f1f5f9', padding: '2px 8px', borderRadius: 6, fontSize: '0.85rem' }}>{u.username}</code></td>
                                <td>
                                    <span className="um-role-badge" style={{ background: ROLE_BADGE[u.role]?.bg, color: ROLE_BADGE[u.role]?.color }}>
                                        {ROLE_ICON[u.role]} {ROLE_BADGE[u.role]?.label}
                                    </span>
                                </td>
                                <td>
                                    {u.location_name
                                        ? <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><MapPin size={13} />{u.location_name}</span>
                                        : <span style={{ color: '#94a3b8' }}>All Locations</span>}
                                </td>
                                <td>
                                    <span style={{ color: u.is_active ? '#10b981' : '#ef4444', fontWeight: 600, fontSize: '0.8rem' }}>
                                        ● {u.is_active ? 'Active' : 'Inactive'}
                                    </span>
                                </td>
                                <td>
                                    <div style={{ display: 'flex', gap: 6 }}>
                                        {u.role !== 'SUPER_ADMIN' && canCreateUser && (
                                            <>
                                                <button className="btn-icon-sm edit" onClick={() => openEdit(u)} title="Edit"><Edit2 size={14} /></button>
                                                <button className="btn-icon-sm delete" onClick={() => handleDelete(u)} title="Delete"><Trash2 size={14} /></button>
                                            </>
                                        )}
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Create/Edit Form Modal */}
            {showForm && (
                <div className="modal-backdrop" onClick={() => setShowForm(false)}>
                    <div className="modal-box um-modal" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3>{editUser ? 'Edit User' : 'Create New User'}</h3>
                            <button className="modal-close" onClick={() => setShowForm(false)}><X size={18} /></button>
                        </div>

                        {err && <div className="um-error-msg">⚠️ {err}</div>}

                        <form onSubmit={handleSubmit} className="um-form">
                            <div className="um-form-row">
                                <div className="form-field">
                                    <label>Full Name</label>
                                    <input name="full_name" value={form.full_name} onChange={handleFormChange} placeholder="Full Name" required />
                                </div>
                                <div className="form-field">
                                    <label>Username</label>
                                    <input name="username" value={form.username} onChange={handleFormChange} placeholder="Username" required disabled={!!editUser} />
                                </div>
                            </div>

                            <div className="um-form-row">
                                <div className="form-field">
                                    <label>Password {editUser && '(leave blank to keep)'}</label>
                                    <div className="login-input-wrap" style={{ borderRadius: 8 }}>
                                        <input
                                            name="password" type={showPwd ? 'text' : 'password'}
                                            value={form.password} onChange={handleFormChange}
                                            placeholder={editUser ? 'Leave blank to keep current' : 'Password'}
                                            required={!editUser}
                                            style={{ paddingLeft: 12 }}
                                        />
                                        <button type="button" className="login-eye-btn" onClick={() => setShowPwd(!showPwd)} tabIndex={-1}>
                                            {showPwd ? <EyeOff size={15} /> : <Eye size={15} />}
                                        </button>
                                    </div>
                                </div>
                                <div className="form-field">
                                    <label>Role</label>
                                    <select name="role" value={form.role} onChange={handleFormChange} required>
                                        {availableRoles.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                                    </select>
                                </div>
                            </div>

                            <div className="um-form-row">
                                <div className="form-field">
                                    <label>Location</label>
                                    <select
                                        name="location_id"
                                        value={form.location_id}
                                        onChange={handleFormChange}
                                        disabled={currentUser.role === 'ADMIN'}
                                        required
                                    >
                                        <option value="">— Select Location —</option>
                                        {availableLocations.map(l => (
                                            <option key={l.id} value={l.id}>{l.name}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="form-field" style={{ justifyContent: 'center' }}>
                                    <label htmlFor="um-is-active" style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                                        <input type="checkbox" id="um-is-active" name="is_active" checked={form.is_active} onChange={handleFormChange} />
                                        Active User
                                    </label>
                                </div>
                            </div>

                            {/* Permissions */}
                            {form.role === 'USER' && (
                                <div className="form-field">
                                    <label>Assign Permissions</label>
                                    <div className="um-permissions-grid">
                                        {ALL_PERMISSIONS.map(p => (
                                            <label key={p.key} className={`um-perm-chip ${form.permissions.includes(p.key) ? 'selected' : ''}`}
                                                onClick={() => togglePermission(p.key)}>
                                                <span className="um-perm-check">{form.permissions.includes(p.key) ? <Check size={11} /> : ''}</span>
                                                {p.label}
                                            </label>
                                        ))}
                                    </div>
                                </div>
                            )}

                            <div className="modal-footer">
                                <button type="button" className="btn-secondary" onClick={() => setShowForm(false)}>Cancel</button>
                                <button type="submit" className="btn-primary" disabled={loading}>
                                    <Save size={15} /> {editUser ? 'Update' : 'Create'} User
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default UserManagement;
