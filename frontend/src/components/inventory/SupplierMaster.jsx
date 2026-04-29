import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import {
    Plus, Trash2, Truck, Search, RefreshCw, Mail, Phone,
    MapPin, Building, Edit2, Printer, FileText, FileUp
} from 'lucide-react';
import SearchableSelect from '../common/SearchableSelect';
import * as XLSX from 'xlsx';
import { exportToCSV, printTable } from '../../utils/exportUtils';

const API = '/api/inventory';

const SupplierMaster = ({ currentUser, locations, companyInfo, reportMeta }) => {
    const [suppliers, setSuppliers] = useState([]);
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

    const fetchSuppliers = async () => {
        setLoading(true);
        try {
            const params = {};
            if (filterLocationId !== 'ALL') params.location_id = filterLocationId;
            const { data } = await axios.get(`${API}/suppliers`, { params });
            setSuppliers(data);
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

                const mappedSuppliers = data.map(row => {
                    const r = {};
                    Object.keys(row).forEach(k => r[k.toLowerCase().replace(/\s/g, '_')] = row[k]);

                    return {
                        name: r.name || r.supplier_name || r.company || r.enterprise || '',
                        contact_person: r.contact_person || r.contact || r.representative || '',
                        mobile: r.mobile || r.mobile_no || r.phone_no || r.phone || '',
                        phone: r.phone || r.phone_no || r.landline || '',
                        email: r.email || r.email_id || '',
                        address: r.address || r.mailing_address || r.office_address || r.location || '',
                        ntn: r.ntn || r.ntn_no || '',
                        gst: r.gst || r.gst_no || '',
                        location_id: currentUser?.location_id || (filterLocationId !== 'ALL' ? filterLocationId : locations[0]?.id)
                    };
                }).filter(s => s.name);

                if (mappedSuppliers.length === 0) {
                    alert('No valid supplier names found in the file.');
                    setLoading(false);
                    return;
                }

                if (window.confirm(`Found ${mappedSuppliers.length} suppliers. Proceed with import?`)) {
                    await axios.post(`${API}/suppliers/import`, { suppliers: mappedSuppliers });
                    alert('Import Successful!');
                    fetchSuppliers();
                }
            } catch (err) {
                console.error('Import error:', err);
                alert('Failed to parse Excel file.');
            } finally {
                setLoading(false);
                e.target.value = null;
            }
        };
        reader.readAsBinaryString(file);
    };

    useEffect(() => { fetchSuppliers(); }, [filterLocationId]);

    const handleExportCSV = () => {
        const headers = ['Name', 'Location', 'Contact Person', 'Mobile', 'Phone', 'Email', 'Address', 'NTN', 'GST'];
        const fields = ['name', 'location_name', 'contact_person', 'mobile', 'phone', 'email', 'address', 'ntn', 'gst'];

        const data = filteredSuppliers.map(s => ({
            ...s,
            location_name: locations.find(l => l.id === s.location_id)?.name || 'N/A'
        }));

        exportToCSV('Supplier_List', headers, data, fields);
    };

    const handlePrint = () => {
        const headers = ['Name', 'Location', 'Contact', 'Mobile', 'Email'];
        const fields = ['name', 'location_name', 'contact_person', 'mobile', 'email'];

        const data = filteredSuppliers.map(s => ({
            ...s,
            location_name: locations.find(l => l.id === s.location_id)?.name || 'N/A'
        }));

        const meta = {
            ...reportMeta,
            location: filterLocationId === 'ALL' ? 'All Locations' : (locations.find(l => l.id === parseInt(filterLocationId))?.name || 'Selected Location')
        };

        printTable('Supplier Master Registry', headers, data, fields, companyInfo, meta);
    };

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
                await axios.put(`${API}/suppliers/${editId}`, {
                    ...form,
                    name: form.name.toUpperCase(),
                    contact_person: (form.contact_person || '').toUpperCase()
                });
            } else {
                await axios.post(`${API}/suppliers`, {
                    ...form,
                    name: form.name.toUpperCase(),
                    contact_person: (form.contact_person || '').toUpperCase()
                });
            }
            resetForm();
            fetchSuppliers();
        } catch (e) { alert(e.response?.data?.error || 'Error saving supplier'); }
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Are you sure you want to delete this supplier?')) return;
        try {
            await axios.delete(`${API}/suppliers/${id}`);
            fetchSuppliers();
        } catch (e) { alert(e.response?.data?.error || 'Error deleting supplier'); }
    };

    const handleEdit = (s) => {
        setForm({
            name: s.name,
            contact_person: s.contact_person || '',
            mobile: s.mobile || '',
            phone: s.phone || '',
            fax: s.fax || '',
            email: s.email || '',
            address: s.address || '',
            ntn: s.ntn || '',
            gst: s.gst || '',
            location_id: s.location_id || ''
        });
        setEditId(s.id);
        setShowForm(true);
    };

    const filteredSuppliers = suppliers.filter(s =>
        (s.name || '').toLowerCase().includes(search.toLowerCase()) ||
        (s.contact_person || '').toLowerCase().includes(search.toLowerCase())
    );

    return (
        <div className="animate-fade-in">
            <div className="inventory-card premium-card">
                <div className="card-header-flex">
                    <div className="header-icon-title">
                        <div className="icon-wrapper bg-green-light"><Truck size={22} /></div>
                        <div>
                            <h3>Supplier Master</h3>
                            <p>Manage your product vendors and suppliers</p>
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
                        <button className="btn-refresh" onClick={fetchSuppliers} disabled={loading}>
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
                            <Plus size={18} /> Add New Supplier
                        </button>
                    </div>
                </div>

                <div className="table-search-premium mt-4">
                    <Search size={16} className="search-icon" />
                    <input
                        type="text"
                        placeholder="Search by company or contact person..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                    />
                </div>

                <div className="premium-table-container">
                    <table className="premium-table">
                        <thead>
                            <tr>
                                <th>Company Details</th>
                                <th>Location</th>
                                <th>Contact Info</th>
                                <th>Taxation</th>
                                <th className="text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredSuppliers.length === 0 ? (
                                <tr><td colSpan="5" className="empty-state">No suppliers registered.</td></tr>
                            ) : (
                                filteredSuppliers.map(s => (
                                    <tr key={s.id} className="table-row-hover">
                                        <td>
                                            <div className="company-info-cell">
                                                <div className="company-logo-mini">{s.name ? s.name[0] : '?'}</div>
                                                <div>
                                                    <div className="font-bold">{s.name}</div>
                                                    <div className="text-xs text-secondary flex items-center gap-1">
                                                        <MapPin size={10} /> {s.address || 'No address'}
                                                    </div>
                                                </div>
                                            </div>
                                        </td>
                                        <td>
                                            <span className={`badge-type ${s.location_id ? 'bg-blue-soft text-blue-dark' : 'bg-slate-soft text-slate-dark'}`}>
                                                {locations.find(l => l.id === s.location_id)?.name || 'N/A'}
                                            </span>
                                        </td>
                                        <td>
                                            <div className="contact-info-cell">
                                                <div className="contact-name">{s.contact_person || 'N/A'}</div>
                                                <div className="contact-details">
                                                    <span><Phone size={10} /> {s.mobile || s.phone || '-'}</span>
                                                    <span><Mail size={10} /> {s.email || '-'}</span>
                                                </div>
                                            </div>
                                        </td>
                                        <td>
                                            <div className="tax-info-cell">
                                                <span>NTN: {s.ntn || 'N/A'}</span>
                                                <span>GST: {s.gst || 'N/A'}</span>
                                            </div>
                                        </td>
                                        <td className="text-right">
                                            <div className="flex justify-end gap-2">
                                                <button onClick={() => handleEdit(s)} className="btn-icon-edit" style={{ color: '#6366f1' }} title="Edit"><Edit2 size={16} /></button>
                                                <button onClick={() => handleDelete(s.id)} className="btn-icon-delete" title="Delete"><Trash2 size={16} /></button>
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
                                <div className="icon-wrapper bg-green-light"><Truck size={20} /></div>
                                <h3>{editId ? 'Edit Supplier Profile' : 'Register New Supplier'}</h3>
                            </div>
                            <button className="close-btn" onClick={resetForm}>✕</button>
                        </div>
                        <form onSubmit={handleSubmit}>
                            <div style={{ padding: '32px' }}>
                                <div className="premium-form-grid">
                                    <div className="form-field full-width">
                                        <label>Company / Supplier Name</label>
                                        <div className="input-with-icon">
                                            <input className="input-minimal" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required placeholder="e.g. ALPHA TRADERS" />
                                        </div>
                                    </div>
                                    <div className="form-field">
                                        <label>Contact Person</label>
                                        <input className="input-minimal" value={form.contact_person} onChange={e => setForm({ ...form, contact_person: e.target.value })} placeholder="Full Name" />
                                    </div>
                                    <div className="form-field">
                                        <label>Mobile Number</label>
                                        <input className="input-minimal" value={form.mobile} onChange={e => setForm({ ...form, mobile: e.target.value })} placeholder="+92 XXX XXXXXXX" />
                                    </div>
                                    <div className="form-field">
                                        <label>Email Address</label>
                                        <input className="input-minimal" type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="vendor@example.com" />
                                    </div>
                                    <div className="form-field">
                                        <label>Phone / Fax</label>
                                        <input className="input-minimal" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} placeholder="Landline" />
                                    </div>
                                    <div className="form-field full-width">
                                        <label>Office Address</label>
                                        <textarea className="input-minimal" value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} placeholder="Full physical address" rows="2" />
                                    </div>
                                    <div className="form-field">
                                        <label>NTN Number</label>
                                        <input className="input-minimal" value={form.ntn} onChange={e => setForm({ ...form, ntn: e.target.value })} placeholder="National Tax Number" />
                                    </div>
                                    <div className="form-field">
                                        <label>GST Number</label>
                                        <input className="input-minimal" value={form.gst} onChange={e => setForm({ ...form, gst: e.target.value })} placeholder="Sales Tax Number" />
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
                                <button type="button" className="btn-secondary-premium" onClick={resetForm}>Discard</button>
                                <button type="submit" className="btn-primary-premium">{editId ? 'Update Supplier' : 'Save Supplier Profile'}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default SupplierMaster;
