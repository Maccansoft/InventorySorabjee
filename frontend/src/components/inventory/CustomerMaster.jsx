import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import {
    Plus, Trash2, Users, Search, RefreshCw, Mail, Phone,
    MapPin, UserCheck, Edit2, FileUp, Printer, FileText
} from 'lucide-react';
import SearchableSelect from '../common/SearchableSelect';
import * as XLSX from 'xlsx';
import { exportToCSV, printTable } from '../../utils/exportUtils';

const API = '/api/inventory';

const CustomerMaster = ({ currentUser, locations, companyInfo, reportMeta }) => {
    const [customers, setCustomers] = useState([]);
    const [showForm, setShowForm] = useState(false);
    const [loading, setLoading] = useState(false);
    const [search, setSearch] = useState('');
    const [editId, setEditId] = useState(null);
    const [filterLocationId, setFilterLocationId] = useState(currentUser?.is_head_office ? 'ALL' : currentUser?.location_id);
    const fileInputRef = useRef(null);

    const [form, setForm] = useState({
        name: '', contact_person: '', mobile: '', phone: '', fax: '', email: '', address: '', ntn: '', gst: '',
        location_id: currentUser?.location_id || ''
    });

    const fetchCustomers = async () => {
        setLoading(true);
        try {
            const params = {};
            if (filterLocationId !== 'ALL') params.location_id = filterLocationId;
            const { data } = await axios.get(`${API}/customers`, { params });
            setCustomers(data);
        } catch (e) { console.error(e); }
        setLoading(false);
    };

    const handleImportExcel = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        setLoading(true);
        const reader = new FileReader();
        reader.onload = async (evt) => {
            try {
                const bstr = evt.target.result;
                const wb = XLSX.read(bstr, { type: 'binary' });
                const wsname = wb.SheetNames[0];
                const ws = wb.Sheets[wsname];
                const data = XLSX.utils.sheet_to_json(ws);

                if (data.length === 0) {
                    alert('Excel file is empty.');
                    setLoading(false);
                    return;
                }

                // Map Excel columns to our DB schema
                // Try to find Name, Contact, Mobile etc in header
                const mappedCustomers = data.map(row => {
                    // Normalize keys to lowercase for matching
                    const r = {};
                    Object.keys(row).forEach(k => r[k.toLowerCase().replace(/\s/g, '_')] = row[k]);

                    return {
                        name: r.name || r.customer_name || r.company || r.enterprise || '',
                        contact_person: r.contact_person || r.contact || r.representative || '',
                        mobile: r.mobile || r.mobile_no || r.phone_no || r.phone || '',
                        phone: r.phone || r.phone_no || r.landline || '',
                        email: r.email || r.email_id || '',
                        address: r.address || r.mailing_address || r.location || '',
                        ntn: r.ntn || r.ntn_no || '',
                        gst: r.gst || r.gst_no || '',
                        location_id: currentUser?.location_id || filterLocationId !== 'ALL' ? filterLocationId : locations[0]?.id
                    };
                }).filter(c => c.name); // Skip rows without a name

                if (mappedCustomers.length === 0) {
                    alert('No valid customer names found in the file.');
                    setLoading(false);
                    return;
                }

                if (window.confirm(`Found ${mappedCustomers.length} customers. Proceed with import?`)) {
                    await axios.post(`${API}/customers/import`, { customers: mappedCustomers });
                    alert('Import Successful!');
                    fetchCustomers();
                }
            } catch (err) {
                console.error('Import error:', err);
                alert('Failed to parse Excel file. Please ensure it is a valid format.');
            } finally {
                setLoading(false);
                e.target.value = null; // Reset input
            }
        };
        reader.readAsBinaryString(file);
    };

    const handleExportCSV = () => {
        const headers = ['Name', 'Location', 'Contact Person', 'Mobile', 'Phone', 'Email', 'Address', 'NTN', 'GST'];
        const fields = ['name', 'location_name', 'contact_person', 'mobile', 'phone', 'email', 'address', 'ntn', 'gst'];

        const data = filteredCustomers.map(c => ({
            ...c,
            location_name: locations.find(l => l.id === c.location_id)?.name || 'N/A'
        }));

        exportToCSV('Customer_List', headers, data, fields);
    };

    const handlePrint = () => {
        const headers = ['Name', 'Location', 'Contact', 'Mobile', 'Email'];
        const fields = ['name', 'location_name', 'contact_person', 'mobile', 'email'];

        const data = filteredCustomers.map(c => ({
            ...c,
            location_name: locations.find(l => l.id === c.location_id)?.name || 'N/A'
        }));

        const meta = {
            ...reportMeta,
            location: filterLocationId === 'ALL' ? 'All Locations' : (locations.find(l => l.id === parseInt(filterLocationId))?.name || 'Selected Location')
        };

        printTable('Customer Master Registry', headers, data, fields, companyInfo, meta);
    };

    useEffect(() => { fetchCustomers(); }, [filterLocationId]);

    const resetForm = () => {
        setForm({
            name: '', contact_person: '', mobile: '', phone: '', fax: '', email: '', address: '', ntn: '', gst: '',
            location_id: currentUser?.location_id || ''
        });
        setEditId(null);
        setShowForm(false);
    }

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            if (editId) {
                await axios.put(`${API}/customers/${editId}`, {
                    ...form,
                    name: form.name.toUpperCase(),
                    contact_person: (form.contact_person || '').toUpperCase()
                });
            } else {
                await axios.post(`${API}/customers`, {
                    ...form,
                    name: form.name.toUpperCase(),
                    contact_person: (form.contact_person || '').toUpperCase()
                });
            }
            resetForm();
            fetchCustomers();
        } catch (e) { alert(e.response?.data?.error || 'Error saving customer'); }
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Delete this customer?')) return;
        try {
            await axios.delete(`${API}/customers/${id}`);
            fetchCustomers();
        } catch (e) { alert(e.response?.data?.error || 'Error deleting'); }
    };

    const handleEdit = (c) => {
        setForm({
            name: c.name,
            contact_person: c.contact_person || '',
            mobile: c.mobile || '',
            phone: c.phone || '',
            fax: c.fax || '',
            email: c.email || '',
            address: c.address || '',
            ntn: c.ntn || '',
            gst: c.gst || '',
            location_id: c.location_id || ''
        });
        setEditId(c.id);
        setShowForm(true);
    };

    const filteredCustomers = customers.filter(c =>
        (c.name || '').toLowerCase().includes(search.toLowerCase()) ||
        (c.contact_person || '').toLowerCase().includes(search.toLowerCase())
    );

    return (
        <div className="animate-fade-in">
            <div className="inventory-card premium-card">
                <div className="card-header-flex">
                    <div className="header-icon-title">
                        <div className="icon-wrapper bg-blue-light"><Users size={22} /></div>
                        <div>
                            <h3>Customer Master</h3>
                            <p>Manage your client database and purchase history</p>
                        </div>
                    </div>
                    <div className="action-group">
                        {currentUser?.role === 'SUPER_ADMIN' && (
                            <div className="table-search-premium" style={{ margin: 0, padding: '0 10px', minWidth: 200 }}>
                                <MapPin size={16} className="search-icon" />
                                <SearchableSelect
                                    options={[
                                        { value: 'ALL', label: 'All Locations' },
                                        ...locations.map(loc => ({ value: loc.id, label: loc.name }))
                                    ]}
                                    value={filterLocationId}
                                    onChange={val => setFilterLocationId(val)}
                                    placeholder="Filter Location"
                                    style={{ width: '100%', border: 'none' }}
                                />
                            </div>
                        )}
                        <button className="btn-refresh" onClick={fetchCustomers} disabled={loading}>
                            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
                        </button>
                        <button className="btn-secondary-premium" onClick={handlePrint} title="Print / PDF">
                            <Printer size={16} /> Print
                        </button>
                        <button className="btn-secondary-premium" onClick={handleExportCSV} title="Export to Excel">
                            <FileText size={16} /> Export
                        </button>
                        <input
                            type="file"
                            ref={fileInputRef}
                            onChange={handleImportExcel}
                            accept=".xlsx, .xls"
                            style={{ display: 'none' }}
                        />
                        <button className="btn-secondary-premium" onClick={() => fileInputRef.current.click()} title="Import from Excel">
                            <FileUp size={16} /> Import Excel
                        </button>
                        <button className="btn-primary-premium" onClick={() => { setEditId(null); setForm({ ...form, name: '', contact_person: '', mobile: '', phone: '', fax: '', email: '', address: '', ntn: '', gst: '' }); setShowForm(true); }}>
                            <Plus size={18} /> Add New Customer
                        </button>
                    </div>
                </div>

                <div className="table-search-premium mt-4">
                    <Search size={16} className="search-icon" />
                    <input
                        type="text"
                        placeholder="Search by name or contact..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                    />
                </div>

                <div className="premium-table-container">
                    <table className="premium-table">
                        <thead>
                            <tr>
                                <th>Customer Name</th>
                                <th>Location</th>
                                <th>Contact / Representative</th>
                                <th>Communication</th>
                                <th className="text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredCustomers.length === 0 ? (
                                <tr><td colSpan="4" className="empty-state">No customers found.</td></tr>
                            ) : (
                                filteredCustomers.map(c => (
                                    <tr key={c.id} className="table-row-hover">
                                        <td className="font-bold">{c.name}</td>
                                        <td>
                                            <span className={`badge-type ${c.location_id ? 'bg-blue-soft text-blue-dark' : 'bg-slate-soft text-slate-dark'}`}>
                                                {locations.find(l => l.id === c.location_id)?.name || 'N/A'}
                                            </span>
                                        </td>
                                        <td>
                                            <div className="flex items-center gap-2">
                                                <div className="user-initials bg-slate-100 text-slate-600 w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold">
                                                    {c.contact_person ? c.contact_person[0] : '?'}
                                                </div>
                                                {c.contact_person || 'N/A'}
                                            </div>
                                        </td>
                                        <td>
                                            <div className="text-sm">
                                                <div className="flex items-center gap-1"><Phone size={12} className="text-secondary" /> {c.mobile || c.phone || '-'}</div>
                                                <div className="flex items-center gap-1"><Mail size={12} className="text-secondary" /> {c.email || '-'}</div>
                                            </div>
                                        </td>
                                        <td className="text-right">
                                            <div className="flex justify-end gap-2">
                                                <button onClick={() => handleEdit(c)} className="btn-icon-edit" style={{ color: '#6366f1' }} title="Edit"><Edit2 size={16} /></button>
                                                <button onClick={() => handleDelete(c.id)} className="btn-icon-delete" title="Delete"><Trash2 size={16} /></button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {showForm && (
                <div className="modal-backdrop" onClick={resetForm}>
                    <div className="modal-box premium-modal animate-slide-up" style={{ maxWidth: 800 }} onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <div className="header-left">
                                <div className="icon-wrapper bg-blue-light"><UserCheck size={20} /></div>
                                <h3>{editId ? 'Edit Customer Settings' : 'New Customer Registration'}</h3>
                            </div>
                            <button className="close-btn" onClick={resetForm}>✕</button>
                        </div>
                        <form onSubmit={handleSubmit}>
                            <div style={{ padding: '32px' }}>
                                <div className="premium-form-grid">
                                    <div className="form-field full-width">
                                        <label>Customer / Enterprise Name</label>
                                        <input className="input-minimal" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required placeholder="Enter full name" />
                                    </div>
                                    <div className="form-field">
                                        <label>Contact Person</label>
                                        <input className="input-minimal" value={form.contact_person} onChange={e => setForm({ ...form, contact_person: e.target.value })} placeholder="Primary contact" />
                                    </div>
                                    <div className="form-field">
                                        <label>Mobile Number</label>
                                        <input className="input-minimal" value={form.mobile} onChange={e => setForm({ ...form, mobile: e.target.value })} placeholder="+92 XXX XXXXXXX" />
                                    </div>
                                    <div className="form-field">
                                        <label>Email ID</label>
                                        <input className="input-minimal" type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="customer@host.com" />
                                    </div>
                                    <div className="form-field">
                                        <label>Phone / Landline</label>
                                        <input className="input-minimal" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} placeholder="Optional" />
                                    </div>
                                    <div className="form-field full-width">
                                        <label>Mailing Address</label>
                                        <textarea className="input-minimal" value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} placeholder="Suite, Street, City" rows="2" />
                                    </div>
                                    <div className="form-field">
                                        <label>NTN Number (Optional)</label>
                                        <input className="input-minimal" value={form.ntn} onChange={e => setForm({ ...form, ntn: e.target.value })} />
                                    </div>
                                    <div className="form-field">
                                        <label>GST Number (Optional)</label>
                                        <input className="input-minimal" value={form.gst} onChange={e => setForm({ ...form, gst: e.target.value })} />
                                    </div>
                                    <div className="form-field">
                                        <label>Branch / Location</label>
                                        <SearchableSelect
                                            options={locations.map(loc => ({ value: loc.id, label: loc.name }))}
                                            value={form.location_id}
                                            onChange={val => setForm({ ...form, location_id: val })}
                                            placeholder="Select Location"
                                            disabled={!currentUser?.is_head_office && !editId}
                                        />
                                    </div>
                                </div>
                            </div>
                            <div className="modal-footer-premium">
                                <button type="button" className="btn-secondary-premium" onClick={resetForm}>Cancel</button>
                                <button type="submit" className="btn-primary-premium">{editId ? 'Update Customer' : 'Create Customer'}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default CustomerMaster;
