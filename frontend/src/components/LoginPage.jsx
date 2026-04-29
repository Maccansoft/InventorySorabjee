import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Eye, EyeOff, TrendingUp, Lock, User, MapPin, Calendar } from 'lucide-react';

const API = '/api';

const LoginPage = ({ onLogin }) => {
    const [form, setForm] = useState({ username: '', password: '', location_id: '', fiscal_year_id: '' });
    const [locations, setLocations] = useState([]);
    const [fiscalYears, setFiscalYears] = useState([]);
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        const fetchDropdowns = async () => {
            try {
                const [locRes, fyRes] = await Promise.all([
                    axios.get(`${API}/auth/locations`),
                    axios.get(`${API}/auth/fiscal-years`)
                ]);
                setLocations(Array.isArray(locRes.data) ? locRes.data : []);
                setFiscalYears(Array.isArray(fyRes.data) ? fyRes.data : []);
                // Pre-select first active fiscal year
                if (Array.isArray(fyRes.data)) {
                    const activeFY = fyRes.data.find(fy => !fy.is_closed);
                    if (activeFY) setForm(f => ({ ...f, fiscal_year_id: activeFY.id }));
                }
            } catch (e) {
                setError('Failed to load configuration. Please check the server connection.');
            }
        };
        fetchDropdowns();
    }, []);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setForm(prev => ({ ...prev, [name]: value }));
        setError('');
    };

    // ── AUTO-SELECT LOCATION FROM USERNAME ──
    useEffect(() => {
        if (!form.username || !locations.length) return;

        // Matches suffixes like -KHI, /KHI (case-insensitive)
        const parts = form.username.split(/[-/]/);
        if (parts.length > 1) {
            const suffix = parts[parts.length - 1].trim().toUpperCase();
            const matchedLoc = locations.find(l => 
                (l.code && l.code.toUpperCase() === suffix) || 
                (l.name && l.name.toUpperCase().includes(suffix))
            );
            
            if (matchedLoc && parseInt(form.location_id) !== matchedLoc.id) {
                setForm(prev => ({ ...prev, location_id: matchedLoc.id }));
            }
        }
    }, [form.username, locations]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!form.username || !form.password || !form.location_id || !form.fiscal_year_id) {
            setError('All fields are required');
            return;
        }
        setLoading(true);
        setError('');
        try {
            const { data } = await axios.post(`${API}/auth/login`, form);
            if (data.success) {
                onLogin(data);
            }
        } catch (err) {
            setError(err.response?.data?.error || 'Login failed. Please try again.');
        }
        setLoading(false);
    };

    return (
        <div className="login-page">
            {/* Animated background */}
            <div className="login-bg">
                <div className="login-bg-shape shape-1" />
                <div className="login-bg-shape shape-2" />
                <div className="login-bg-shape shape-3" />
            </div>

            <div className="login-container">
                {/* Left panel - Branding */}
                <div className="login-brand-panel">
                    <div className="login-brand-content">
                        <div className="login-logo">
                            <TrendingUp size={40} className="login-logo-icon" />
                        </div>
                        <h1 className="login-brand-title">MACCANSOFT<br />Business Suite</h1>
                        <p className="login-brand-sub">Inventory, Payroll & Accounting</p>
                        <div className="login-brand-divider" />
                        <div className="login-brand-features">
                            <div className="login-feature-item">
                                <div className="login-feature-dot" />
                                <span>Multi-Location Management</span>
                            </div>
                            <div className="login-feature-item">
                                <div className="login-feature-dot" />
                                <span>Fiscal Year Tracking</span>
                            </div>
                            <div className="login-feature-item">
                                <div className="login-feature-dot" />
                                <span>Complete Chart of Accounts</span>
                            </div>
                            <div className="login-feature-item">
                                <div className="login-feature-dot" />
                                <span>Voucher & Ledger Management</span>
                            </div>
                            <div className="login-feature-item">
                                <div className="login-feature-dot" />
                                <span>Financial Reports</span>
                            </div>
                        </div>
                        <div className="login-brand-footer">
                            <span>Powered by </span>
                            <span className="login-brand-maccan">Maccansoft Corporation</span>
                        </div>
                    </div>
                </div>

                {/* Right panel - Login form */}
                <div className="login-form-panel">
                    <div className="login-form-box">
                        <div className="login-form-header">
                            <h2>Welcome Back</h2>
                            <p>Sign in to access your account</p>
                        </div>

                        {error && (
                            <div className="login-error-msg">
                                <span>⚠️ {error}</span>
                            </div>
                        )}

                        <form onSubmit={handleSubmit} className="login-form">
                            {/* Username */}
                            <div className="login-field">
                                <label htmlFor="login-username">Username</label>
                                <div className="login-input-wrap">
                                    <User className="login-input-icon" size={18} />
                                    <input
                                        id="login-username"
                                        type="text"
                                        name="username"
                                        placeholder="Enter your username"
                                        value={form.username}
                                        onChange={handleChange}
                                        autoComplete="username"
                                    />
                                </div>
                            </div>

                            {/* Password */}
                            <div className="login-field">
                                <label htmlFor="login-password">Password</label>
                                <div className="login-input-wrap">
                                    <Lock className="login-input-icon" size={18} />
                                    <input
                                        id="login-password"
                                        type={showPassword ? 'text' : 'password'}
                                        name="password"
                                        placeholder="Enter your password"
                                        value={form.password}
                                        onChange={handleChange}
                                        autoComplete="current-password"
                                    />
                                    <button
                                        type="button"
                                        className="login-eye-btn"
                                        onClick={() => setShowPassword(!showPassword)}
                                        tabIndex={-1}
                                    >
                                        {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                                    </button>
                                </div>
                            </div>

                            {/* Fiscal Year */}
                            <div className="login-field">
                                <label htmlFor="login-fiscal-year">Fiscal Year</label>
                                <div className="login-input-wrap">
                                    <Calendar className="login-input-icon" size={18} />
                                    <select
                                        id="login-fiscal-year"
                                        name="fiscal_year_id"
                                        value={form.fiscal_year_id}
                                        onChange={handleChange}
                                    >
                                        <option value="">— Select Fiscal Year —</option>
                                        {Array.isArray(fiscalYears) && fiscalYears.map(fy => (
                                            <option key={fy.id} value={fy.id}>
                                                {fy.label}{fy.is_closed ? ' (Closed)' : ' (Active)'}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            {/* Location */}
                            <div className="login-field">
                                <label htmlFor="login-location">Location / Branch</label>
                                <div className="login-input-wrap">
                                    <MapPin className="login-input-icon" size={18} />
                                    <select
                                        id="login-location"
                                        name="location_id"
                                        value={form.location_id}
                                        onChange={handleChange}
                                    >
                                        <option value="">— Select Location —</option>
                                        {Array.isArray(locations) && locations.map(loc => (
                                            <option key={loc.id} value={loc.id}>
                                                {loc.name}{loc.is_head_office ? ' 🏢 (Head Office)' : ''}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <button
                                type="submit"
                                className={`login-submit-btn ${loading ? 'loading' : ''}`}
                                disabled={loading}
                            >
                                {loading ? (
                                    <span className="login-spinner" />
                                ) : (
                                    'Sign In'
                                )}
                            </button>
                        </form>


                    </div>
                </div>
            </div>
        </div>
    );
};

export default LoginPage;
