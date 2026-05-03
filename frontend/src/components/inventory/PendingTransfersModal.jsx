
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { X, Printer, Eye, Truck, CheckCircle, Clock } from 'lucide-react';
import { formatQty } from '../../utils/numberUtils';

const PendingTransfersModal = ({ isOpen, onClose, currentUser, onAcknowledge, onTransferClick }) => {
    const [requests, setRequests] = useState([]);
    const [loading, setLoading] = useState(false);

    const fetchPending = async () => {
        setLoading(true);
        try {
            const { data } = await axios.get(`/api/inventory/pending-transfer-requests`, {
                params: { location_id: currentUser.location_id }
            });
            setRequests(data);
        } catch (e) { console.error(e); }
        setLoading(false);
    };

    useEffect(() => {
        if (isOpen) fetchPending();
    }, [isOpen]);

    if (!isOpen) return null;

    // Group by from_location_name, then by trans_no
    const grouped = requests.reduce((acc, r) => {
        if (!acc[r.from_location_name]) acc[r.from_location_name] = {};
        if (!acc[r.from_location_name][r.trans_no]) acc[r.from_location_name][r.trans_no] = {
            id: r.id,
            trans_no: r.trans_no,
            trans_date: r.trans_date,
            status: r.status,
            items: []
        };
        acc[r.from_location_name][r.trans_no].items.push(r);
        return acc;
    }, {});

    const handlePrint = (originLoc, transNo, data) => {
        const printWindow = window.open('', '_blank');
        const html = `
            <html>
            <head>
                <title>Transfer Request - ${transNo}</title>
                <style>
                    body { font-family: sans-serif; padding: 20px; }
                    table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                    th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
                    .header { text-align: center; margin-bottom: 30px; }
                </style>
            </head>
            <body>
                <div class="header">
                    <h1>Transfer Request Confirmation</h1>
                    <p>Origin: <b>${originLoc}</b> | Request #: <b>${transNo}</b></p>
                    <p>Date: ${new Date(data.trans_date).toLocaleDateString()}</p>
                </div>
                <table>
                    <thead>
                        <tr>
                            <th>Maker</th><th>Category</th><th>Power</th><th>Stock Request</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${data.items.map(it => `
                            <tr>
                                <td>${it.maker_name}</td>
                                <td>${it.category_name}</td>
                                <td>${it.power || '-'}</td>
                                <td>${formatQty(it.qty)}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </body>
            </html>
        `;
        printWindow.document.write(html);
        printWindow.document.close();
        printWindow.print();
    };

    const beginTransfer = (locationName, transGroup) => {
        // Collect all items from all transactions for this location and tag them with their source Trans No
        const allItems = Object.entries(transGroup).flatMap(([transNo, tg]) => 
            tg.items.map(it => ({ ...it, reqTransNo: transNo }))
        );
        const targetLocationId = allItems[0]?.location_id;
        const requestIds = Object.values(transGroup).map(tg => tg.id);
        const requestNos = Object.keys(transGroup);

        if (onTransferClick) {
            onTransferClick({
                items: allItems,
                toLocationId: targetLocationId,
                toLocationName: locationName,
                requestIds,
                requestNos
            });
        }
    };

    return (
        <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100vw',
            height: '100vh',
            backgroundColor: 'rgba(15, 23, 42, 0.4)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 99999,
            padding: '24px'
        }} className="animate-fade-in">
            <div className="modal-content premium-card" style={{ maxWidth: '900px', width: '90%', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
                <div className="modal-header">
                    <div className="flex items-center gap-3">
                        <div className="icon-box bg-indigo-100 text-indigo-600">
                            <Truck size={22} />
                        </div>
                        <div>
                            <h2 style={{ fontSize: '1.25rem', fontWeight: 800 }}>Transfer Requisitions</h2>
                            <p style={{ fontSize: '0.85rem', color: '#64748b' }}>Stock requests from other branches</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="close-btn"><X size={20} /></button>
                </div>

                <div className="modal-body" style={{ maxHeight: '70vh', overflowY: 'auto', padding: '30px' }}>
                    {loading ? (
                        <div className="text-center py-10 text-slate-400">Loading requests...</div>
                    ) : requests.length === 0 ? (
                        <div className="text-center py-10 text-slate-400">No pending requests for your location.</div>
                    ) : (
                        Object.entries(grouped).map(([location, transGroup], locIdx) => (
                            <div key={location} style={{ marginBottom: 60 }}>
                                {/* Thick separator between different branch locations */}
                                {locIdx > 0 && <div style={{ borderTop: '4px solid #334155', margin: '40px 0', borderRadius: 2 }}></div>}
                                
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                                    <h3 style={{ fontSize: '1.25rem', fontWeight: 900, color: '#0f172a', margin: 0 }}>
                                        Requests from: "{location}"
                                    </h3>
                                    <button 
                                        onClick={() => beginTransfer(location, transGroup)}
                                        className="btn-primary"
                                        style={{ 
                                            display: 'flex', 
                                            alignItems: 'center', 
                                            gap: 8,
                                            padding: '8px 20px',
                                            fontSize: '0.85rem',
                                            borderRadius: '8px'
                                        }}
                                    >
                                        <Truck size={16} /> CLICK TO TRANSFER
                                    </button>
                                </div>
                                
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 40 }}>
                                    {Object.entries(transGroup).map(([transNo, data]) => {
                                        const totalQty = data.items.reduce((sum, item) => sum + parseFloat(item.qty || 0), 0);
                                        return (
                                            <div key={transNo} style={{ padding: '0 10px' }}>
                                                {/* Header Row */}
                                                <div style={{ display: 'flex', gap: 30, fontSize: '0.9rem', fontWeight: 700, color: '#1e293b', marginBottom: 12 }}>
                                                    <span>Transaction ID: {transNo}</span>
                                                    <span>Date: {new Date(data.trans_date).toLocaleDateString()}</span>
                                                </div>

                                                {/* Dashed Line */}
                                                <div style={{ borderTop: '1px dashed #94a3b8', marginBottom: 8 }}></div>
                                                
                                                {/* Table Column Headers */}
                                                <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 2fr 1fr 1fr', fontWeight: 800, fontSize: '0.8rem', color: '#475569', padding: '4px 0' }}>
                                                    <div>MAKER</div>
                                                    <div>CATEGORY</div>
                                                    <div className="text-center">POWER</div>
                                                    <div className="text-right">STOCK REQUEST</div>
                                                </div>

                                                {/* Dashed Line */}
                                                <div style={{ borderTop: '1px dashed #94a3b8', marginTop: 8, marginBottom: 12 }}></div>

                                                {/* Item Rows */}
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                                                    {data.items.map((it, idx) => (
                                                        <div key={idx} style={{ display: 'grid', gridTemplateColumns: '1.5fr 2fr 1fr 1fr', fontSize: '0.9rem', color: '#1e293b' }}>
                                                            <div style={{ fontWeight: 600 }}>{it.maker_name}</div>
                                                            <div>{it.category_name}</div>
                                                            <div className="text-center font-mono">{it.power || '-'}</div>
                                                            <div className="text-right font-bold">{formatQty(it.qty)}</div>
                                                        </div>
                                                    ))}
                                                </div>

                                                {/* Bottom Dashed Line */}
                                                <div style={{ borderTop: '1px dashed #94a3b8', marginTop: 15, marginBottom: 10 }}></div>

                                                {/* Total Qty Row */}
                                                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                                                    <div style={{ minWidth: 200, textAlign: 'right' }}>
                                                        <div style={{ fontSize: '0.95rem', fontWeight: 800, color: '#0f172a' }}>
                                                            TOTAL QTY &nbsp;&nbsp;&nbsp;&nbsp;&nbsp; {formatQty(totalQty)}
                                                        </div>
                                                        <div style={{ borderTop: '2px solid #334155', marginTop: 4, width: '100%' }}></div>
                                                    </div>
                                                </div>

                                                {/* Action Bar (Button format with icons) */}
                                                <div style={{ marginTop: 20, display: 'flex', gap: 15, alignItems: 'center' }}>
                                                    <span className="badge-pending" style={{ padding: '4px 12px', textTransform: 'uppercase', fontSize: '0.75rem', fontWeight: 900 }}>PENDING</span>
                                                    
                                                    <div style={{ flex: 1 }}></div>

                                                    <button 
                                                        onClick={() => handlePrint(location, transNo, data)} 
                                                        className="btn-secondary"
                                                        style={{ 
                                                            display: 'flex', 
                                                            alignItems: 'center', 
                                                            gap: 8,
                                                            padding: '8px 16px',
                                                            fontSize: '0.8rem',
                                                            borderRadius: '8px'
                                                        }}
                                                    >
                                                        <Printer size={16} /> PRINT
                                                    </button>
                                                </div>

                                                
                                                {/* Double thick separator for multi-transaction visuals within a location */}
                                                <div style={{ margin: '30px 0', borderBottom: '1px solid #f1f5f9' }}></div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
};

export default PendingTransfersModal;
