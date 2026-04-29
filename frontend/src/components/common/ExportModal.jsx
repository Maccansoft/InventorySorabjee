import React from 'react';
import { FileText, Table, X } from 'lucide-react';

const ExportModal = ({ isOpen, onClose, onSelect, title }) => {
    if (!isOpen) return null;

    return (
        <div
            style={{
                position: 'fixed',
                inset: 0,
                zIndex: 100000,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'rgba(15, 23, 42, 0.4)',
                backdropFilter: 'blur(8px)',
                animation: 'fadeIn 0.2s ease-out'
            }}
            onClick={onClose}
        >
            <div
                style={{
                    background: 'white',
                    borderRadius: 20,
                    width: '100%',
                    maxWidth: 400,
                    padding: 32,
                    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
                    position: 'relative',
                    animation: 'slideUp 0.3s ease-out'
                }}
                onClick={e => e.stopPropagation()}
            >
                <button
                    onClick={onClose}
                    style={{
                        position: 'absolute',
                        top: 16,
                        right: 16,
                        background: 'none',
                        border: 'none',
                        color: '#94a3b8',
                        cursor: 'pointer',
                        padding: 8,
                        borderRadius: '50%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        transition: 'background 0.2s'
                    }}
                    onMouseOver={e => e.currentTarget.style.background = '#f1f5f9'}
                    onMouseOut={e => e.currentTarget.style.background = 'none'}
                >
                    <X size={20} />
                </button>

                <div style={{ textAlign: 'center', marginBottom: 24 }}>
                    <h3 style={{ margin: '0 0 8px 0', fontSize: '1.25rem', fontWeight: 800, color: '#1e293b' }}>
                        Export Report
                    </h3>
                    <p style={{ margin: 0, fontSize: '0.875rem', color: '#64748b' }}>
                        Select your preferred file format for <strong>{title}</strong>
                    </p>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                    <button
                        onClick={() => { onSelect('EXCEL'); onClose(); }}
                        style={{
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            gap: 12,
                            padding: '24px 16px',
                            borderRadius: 16,
                            border: '2px solid #e2e8f0',
                            background: 'white',
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                        }}
                        onMouseOver={e => {
                            e.currentTarget.style.borderColor = '#10b981';
                            e.currentTarget.style.background = '#f0fdf4';
                            e.currentTarget.style.transform = 'translateY(-2px)';
                        }}
                        onMouseOut={e => {
                            e.currentTarget.style.borderColor = '#e2e8f0';
                            e.currentTarget.style.background = 'white';
                            e.currentTarget.style.transform = 'translateY(0)';
                        }}
                    >
                        <div style={{ width: 48, height: 48, borderRadius: 12, background: '#dcfce7', color: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Table size={24} />
                        </div>
                        <span style={{ fontWeight: 700, color: '#065f46', fontSize: '0.9rem' }}>Excel (.CSV)</span>
                    </button>

                    <button
                        onClick={() => { onSelect('PDF'); onClose(); }}
                        style={{
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            gap: 12,
                            padding: '24px 16px',
                            borderRadius: 16,
                            border: '2px solid #e2e8f0',
                            background: 'white',
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                        }}
                        onMouseOver={e => {
                            e.currentTarget.style.borderColor = '#ef4444';
                            e.currentTarget.style.background = '#fef2f2';
                            e.currentTarget.style.transform = 'translateY(-2px)';
                        }}
                        onMouseOut={e => {
                            e.currentTarget.style.borderColor = '#e2e8f0';
                            e.currentTarget.style.background = 'white';
                            e.currentTarget.style.transform = 'translateY(0)';
                        }}
                    >
                        <div style={{ width: 48, height: 48, borderRadius: 12, background: '#fee2e2', color: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <FileText size={24} />
                        </div>
                        <span style={{ fontWeight: 700, color: '#991b1b', fontSize: '0.9rem' }}>PDF (.PDF)</span>
                    </button>
                </div>

                <div style={{ marginTop: 24, textAlign: 'center', fontSize: '0.75rem', color: '#94a3b8' }}>
                    Your download will begin immediately after selection.
                </div>
            </div>
            <style>{`
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slideUp { from { transform: translateY(20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
      `}</style>
        </div>
    );
};

export default ExportModal;
