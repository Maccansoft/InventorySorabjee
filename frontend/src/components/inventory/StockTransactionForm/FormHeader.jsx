import React from 'react';
import { MapPin, Calendar, Plus } from 'lucide-react';

const FormHeader = ({ label, icon, color, accent, bgColor, currentUser, onClose }) => {
    return (
        <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '24px 32px', borderBottom: '1px solid #f1f5f9',
            background: `linear-gradient(to right, ${bgColor}50, white)`, flexShrink: 0,
        }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <div style={{
                    width: 50, height: 50, borderRadius: 16,
                    background: `linear-gradient(135deg, ${color}, ${accent})`, color: 'white',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    boxShadow: `0 8px 16px ${color}30`,
                }}>{React.cloneElement(icon, { size: 26 })}</div>
                <div>
                    <div style={{ fontWeight: 800, fontSize: '1.3rem', color: '#1e293b', letterSpacing: '-0.02em' }}>{label}</div>
                    <div style={{ fontSize: '0.82rem', color: '#64748b', fontWeight: 500, display: 'flex', alignItems: 'center', gap: 8 }}>
                        <MapPin size={13} /> {currentUser.location_name}
                        <span style={{ opacity: 0.3 }}>|</span>
                        <Calendar size={13} /> FY: {currentUser.fiscal_year_label}
                    </div>
                </div>
            </div>
            <button
                type="button"
                onClick={onClose}
                className="hover-scale"
                title="Close Form"
                style={{
                    background: '#f1f5f9',
                    border: '1px solid #e2e8f0',
                    width: 36, height: 36,
                    borderRadius: 10,
                    fontSize: '0.9rem',
                    cursor: 'pointer',
                    color: '#64748b',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'all 0.2s',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
                }}
            >
                <Plus size={20} style={{ transform: 'rotate(45deg)' }} />
            </button>
        </div>
    );
};

export default FormHeader;
