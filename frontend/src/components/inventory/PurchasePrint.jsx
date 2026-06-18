import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { X, Printer, Download } from 'lucide-react';
import ReactDOM from 'react-dom';
import html2pdf from 'html2pdf.js';
import { formatAmount, formatQty } from '../../utils/numberUtils';

// ─── Stock Purchase Print Modal ───────────────────────────────────────────────
// Renders a professional Purchase Order / GRN document for a single
// purchases record, fetched from GET /api/inventory/purchases/print/:id
// ─────────────────────────────────────────────────────────────────────────────

const PurchasePrint = ({ purchaseId, onClose, companyInfo }) => {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchPurchase = async () => {
            try {
                const { data: purData } = await axios.get(`/api/inventory/purchases/print/${purchaseId}`);

                let finalCompanyInfo = companyInfo;
                if (purData.location_id) {
                    try {
                        const { data: locCompanyInfo } = await axios.get(`/api/company?location_id=${purData.location_id}`);
                        finalCompanyInfo = locCompanyInfo;
                    } catch (e) { console.error('Failed to fetch location company info', e); }
                }

                setData({ ...purData, companyInfo: finalCompanyInfo });
            } catch (e) {
                console.error(e);
                alert('Error loading purchase details');
            }
            setLoading(false);
        };
        fetchPurchase();
    }, [purchaseId, companyInfo]);

    if (loading) return null;
    if (!data) return null;

    // ── Group details by item (maker + category + power) then by batch ──
    const groupedByItemAndBatch = (data.details || []).reduce((acc, d) => {
        const itemKey  = `${d.maker_id}-${d.category_id}-${d.power_id || ''}`;
        const batchKey = `${d.lot_no || ''}-${d.mfg_date || ''}-${d.exp_date || ''}`;
        const rate     = parseFloat(d.rate || 0);

        if (!acc[itemKey]) {
            acc[itemKey] = {
                description:   `${d.maker_name || ''} ${d.category_name || ''}`.trim(),
                category_desc: d.category_description || '',
                power:         d.power || '',
                unit_rate:     rate,
                batches:       {}
            };
        }

        if (!acc[itemKey].batches[batchKey]) {
            acc[itemKey].batches[batchKey] = { ...d, qty: 0 };
        }
        acc[itemKey].batches[batchKey].qty += parseFloat(d.qty || 0);

        return acc;
    }, {});

    const items = Object.values(groupedByItemAndBatch).map(item => {
        const batches            = Object.values(item.batches);
        const group_total_qty    = batches.reduce((s, b) => s + b.qty, 0);
        const group_total_amount = group_total_qty * item.unit_rate;
        return { ...item, lots: batches, group_total_qty, group_total_amount };
    });

    const grandTotal = items.reduce((s, item) => s + item.group_total_amount, 0);
    const totalQty   = (data.details || []).reduce((s, d) => s + parseFloat(d.qty || 0), 0);

    const handlePrint     = () => window.print();
    const handleExportPDF = () => {
        const element = document.getElementById('printable-purchase');
        const opt = {
            margin:     [10, 10, 10, 10],
            filename:   `Purchase_${(data.trans_no || 'N-A').replace(/[\/\\]/g, '_')}.pdf`,
            image:      { type: 'jpeg', quality: 0.98 },
            html2canvas: { scale: 2, useCORS: true, logging: false },
            jsPDF:      { unit: 'mm', format: 'a4', orientation: 'portrait' }
        };
        html2pdf().set(opt).from(element).save();
    };

    const formatDate = (dateStr) => {
        if (!dateStr) return '';
        const d = new Date(dateStr);
        return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
    };

    const modal = (
        <div className="pur-print-overlay">
            <div className="pur-print-content">

                {/* ── Action Bar (Hidden on Print) ── */}
                <div className="pur-action-bar no-print">
                    <div className="flex gap-4">
                        <button onClick={handlePrint}
                            className="flex items-center gap-2 bg-blue-700 text-white px-4 py-2 rounded-lg hover:bg-blue-800 transition-colors">
                            <Printer size={18} /> Print Purchase
                        </button>
                        <button onClick={handleExportPDF}
                            className="flex items-center gap-2 bg-slate-100 text-slate-700 px-4 py-2 rounded-lg hover:bg-slate-200 transition-colors">
                            <Download size={18} /> Export PDF
                        </button>
                    </div>
                    <button onClick={onClose}
                        className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-400">
                        <X size={24} />
                    </button>
                </div>

                {/* ── Document ── */}
                <div className="pur-document" id="printable-purchase">

                    {/* Header */}
                    <div className="pur-header">
                        <div className="pur-header-left">
                            <h1 className="pur-company-name">{data.companyInfo?.CompanyName || 'FA SYSTEM'}</h1>
                            <h2 className="pur-doc-type">GOODS RECEIVED NOTE / STOCK PURCHASE</h2>
                        </div>
                        <div className="pur-header-right">
                            <p className="pur-company-bold">{data.companyInfo?.CompanyName || 'FA SYSTEM'}</p>
                            {data.companyInfo?.Address  && <p className="pur-company-text">{data.companyInfo.Address}</p>}
                            {(data.companyInfo?.Contact || data.companyInfo?.FaxNo) && (
                                <p className="pur-company-text">
                                    {data.companyInfo?.Contact ? `Tel: ${data.companyInfo.Contact}` : ''}
                                    {data.companyInfo?.Contact && data.companyInfo?.FaxNo ? ' | ' : ''}
                                    {data.companyInfo?.FaxNo ? `Fax: ${data.companyInfo.FaxNo}` : ''}
                                </p>
                            )}
                            {data.companyInfo?.NTNo   && <p className="pur-company-text">NTN: {data.companyInfo.NTNo}</p>}
                            {data.companyInfo?.GSTNo  && <p className="pur-company-text">STRN/GST: {data.companyInfo.GSTNo}</p>}
                            {data.companyInfo?.GovtNo && <p className="pur-company-text">Govt No: {data.companyInfo.GovtNo}</p>}
                            {data.companyInfo?.Email  && <p className="pur-company-text pur-email">{data.companyInfo.Email}</p>}
                        </div>
                    </div>

                    <div className="pur-divider"></div>

                    {/* Purchase Info */}
                    <div className="pur-info-section">
                        <div className="pur-party-box">
                            <span className="pur-info-label">PURCHASED FROM:</span>
                            <h3 className="pur-party-name">{data.supplier_name || 'N/A'}</h3>
                            {data.supplier_address && <p className="pur-party-detail">{data.supplier_address}</p>}
                            {data.supplier_mobile  && <p className="pur-party-detail">{data.supplier_mobile}</p>}
                            <p className="pur-party-detail">Supplier ID: {data.supplier_id || 'N/A'}</p>
                        </div>
                        <div className="pur-meta-box">
                            <div className="pur-ref-large">GRN# {(data.trans_no || '').split('-').pop()}</div>
                            <div className="pur-meta-row">
                                <span className="pur-meta-label">Purchase Date:</span>
                                <span className="pur-meta-value">{formatDate(data.trans_date)}</span>
                            </div>
                            <div className="pur-meta-row">
                                <span className="pur-meta-label">Transaction Ref#:</span>
                                <span className="pur-meta-value">{data.trans_no}</span>
                            </div>
                        </div>
                    </div>

                    {/* Items Table */}
                    <table className="pur-table">
                        <thead>
                            <tr>
                                <th width="35"  className="pur-th-blue">S.NO</th>
                                <th width="220" className="pur-th-gray">DESCRIPTION</th>
                                <th width="40"  className="pur-th-gray">QTY</th>
                                <th width="80"  className="pur-th-gray">LOT NO</th>
                                <th width="80"  className="pur-th-gray">MFG DATE</th>
                                <th width="80"  className="pur-th-gray">EXP DATE</th>
                                <th width="60"  className="pur-th-gray text-center">UNIT RATE</th>
                                <th width="40"  className="pur-th-gray text-center">QTY</th>
                                <th width="70"  className="pur-th-darkblue text-center">TOTAL</th>
                            </tr>
                        </thead>
                        <tbody>
                            {items.map((item, idx) => (
                                <React.Fragment key={idx}>
                                    {item.lots.map((lot, li) => (
                                        <tr key={`${idx}-${li}`}>
                                            {li === 0 && (
                                                <td rowSpan={item.lots.length}
                                                    className="text-center font-bold pur-td-light-blue border-white border-b">
                                                    {idx + 1}
                                                </td>
                                            )}
                                            {li === 0 && (
                                                <td rowSpan={item.lots.length}
                                                    className="pur-td-gray border-white border-b">
                                                    <div className="pur-item-desc-box">
                                                        <div className="pur-item-name">{item.description}</div>
                                                        <div style={{ fontSize: '12px', fontWeight: '500', color: '#475569', marginTop: '2px' }}>
                                                            {item.category_desc}
                                                        </div>
                                                        <div className="pur-item-sub">{item.power}</div>
                                                    </div>
                                                </td>
                                            )}
                                            <td className="text-center pur-td-gray border-white">{formatQty(lot.qty)}</td>
                                            <td className="text-center pur-td-gray border-white">{lot.lot_no}</td>
                                            <td className="text-center pur-td-gray border-white">
                                                {lot.mfg_date ? new Date(lot.mfg_date).toLocaleDateString('en-GB').replace(/\//g, '-') : ''}
                                            </td>
                                            <td className="text-center pur-td-gray border-white">
                                                {lot.exp_date ? new Date(lot.exp_date).toLocaleDateString('en-GB').replace(/\//g, '-') : ''}
                                            </td>
                                            {li === 0 && (
                                                <td rowSpan={item.lots.length}
                                                    className="text-center pur-td-gray border-white border-b font-bold">
                                                    {formatAmount(item.unit_rate)}
                                                </td>
                                            )}
                                            {li === 0 && (
                                                <td rowSpan={item.lots.length}
                                                    className="text-center pur-td-gray border-white border-b font-bold">
                                                    {formatQty(item.group_total_qty)}
                                                </td>
                                            )}
                                            {li === 0 && (
                                                <td rowSpan={item.lots.length}
                                                    className="text-center pur-td-darkblue text-white font-bold border-b border-white">
                                                    {formatAmount(item.group_total_amount)}
                                                </td>
                                            )}
                                        </tr>
                                    ))}
                                </React.Fragment>
                            ))}
                        </tbody>
                    </table>

                    {/* Totals */}
                    <div className="pur-totals-section">
                        <div className="pur-totals-row border-none">
                            <span className="pur-total-label">Total Qty:</span>
                            <span className="pur-total-value">{formatQty(totalQty)}</span>
                        </div>
                        <div className="pur-totals-row">
                            <span className="pur-total-label">Gross Total:</span>
                            <span className="pur-total-value">{formatAmount(grandTotal)}</span>
                        </div>
                        <div className="pur-totals-row pur-grand-total-row">
                            <span className="pur-grand-label">PURCHASE TOTAL</span>
                            <span className="pur-grand-value">{formatAmount(grandTotal)}</span>
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="pur-footer-wrapper">
                        <div className="pur-signatures">
                            <div className="pur-sign-box">Received By: ___________________________</div>
                            <div className="pur-sign-box" style={{ marginLeft: '80px' }}>Verified By: ___________________________</div>
                        </div>
                        <div className="pur-footer-terms">
                            <div className="pur-terms-bar"></div>
                            <p>Goods received in good condition as per the above details.</p>
                            <p>Please verify quantity and quality of goods at the time of receiving.</p>
                            <p>Any discrepancy must be reported within 24 hours.</p>
                            <p>This is a system-generated document and serves as the official Goods Received Note.</p>
                        </div>
                        <div className="pur-sub-footer">
                            <p>Application Authorized to: {data.companyInfo?.CompanyName || 'FA SYSTEM'}</p>
                            <p>© Copyright Maccansoft Corporation. All Rights Reserved.</p>
                        </div>
                    </div>
                </div>

                {/* ── Scoped Styles ── */}
                <style>{`
                    .pur-print-overlay {
                        position: fixed;
                        top: 0; left: 0; right: 0; bottom: 0;
                        background: rgba(0,0,0,0.5);
                        z-index: 9999;
                        display: flex;
                        justify-content: center;
                        padding: 40px;
                        overflow-y: auto;
                    }
                    .pur-print-content {
                        background: white;
                        width: 1000px;
                        min-height: 100%;
                        border-radius: 12px;
                        box-shadow: 0 20px 50px rgba(0,0,0,0.3);
                        position: relative;
                    }
                    .pur-action-bar {
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                        padding: 16px 24px;
                        border-bottom: 1px solid #f1f5f9;
                        position: sticky;
                        top: 0;
                        background: white;
                        z-index: 10;
                        border-radius: 12px 12px 0 0;
                    }
                    .pur-document {
                        padding: 40px;
                        background: white;
                        font-family: 'Inter', sans-serif;
                        color: #1e293b;
                        display: flex;
                        flex-direction: column;
                        min-height: 297mm;
                        width: 210mm;
                        margin: 0 auto;
                        box-sizing: border-box;
                    }
                    .pur-footer-wrapper { margin-top: auto; padding-top: 20px; }

                    /* Header */
                    .pur-header { display: flex; justify-content: space-between; margin-bottom: 30px; }
                    .pur-header-left {}
                    .pur-company-name {
                        font-size: 32px; font-weight: 900;
                        color: #1d4ed8;
                        letter-spacing: -0.02em; margin: 0;
                    }
                    .pur-doc-type {
                        font-size: 16px; font-weight: 600;
                        color: #64748b; margin-top: 8px;
                    }
                    .pur-header-right { text-align: right; }
                    .pur-company-bold { font-size: 11px; font-weight: 800; color: #1e293b; margin: 0; text-align: right; }
                    .pur-company-text { font-size: 10px; color: #64748b; margin: 1px 0; font-weight: 500; }
                    .pur-email { color: #1d4ed8 !important; text-decoration: underline; }

                    /* Divider */
                    .pur-divider {
                        height: 2px; background: #f1f5f9;
                        border-top: 4px solid #1d4ed8;
                        margin-bottom: 30px;
                    }

                    /* Info section */
                    .pur-info-section { display: flex; justify-content: space-between; margin-bottom: 40px; }
                    .pur-party-box { width: 50%; }
                    .pur-info-label { font-size: 12px; font-weight: 800; color: #94a3b8; display: block; margin-bottom: 8px; }
                    .pur-party-name { font-size: 22px; font-weight: 800; color: #1e293b; margin-bottom: 8px; }
                    .pur-party-detail { font-size: 12px; color: #64748b; margin: 2px 0; font-weight: 500; }
                    .pur-meta-box { text-align: right; }
                    .pur-ref-large {
                        font-size: 28px; font-weight: 900;
                        color: #1d4ed8; margin-bottom: 15px; opacity: 0.85;
                    }
                    .pur-meta-row { display: flex; justify-content: flex-end; gap: 15px; margin-bottom: 4px; }
                    .pur-meta-label { font-size: 12px; font-weight: 800; color: #94a3b8; }
                    .pur-meta-value { font-size: 12px; font-weight: 700; color: #1e293b; min-width: 150px; }

                    /* Table */
                    .pur-table { width: 100%; border-collapse: collapse; margin-bottom: 40px; }
                    .pur-table thead th {
                        padding: 12px 8px; font-size: 11px;
                        font-weight: 800; text-align: left;
                        border-bottom: 2px solid #e2e8f0;
                    }
                    .pur-table tbody td {
                        padding: 0; border-bottom: 1px solid #f1f5f9; font-size: 10px;
                    }
                    .pur-table tbody td.text-center,
                    .pur-table tbody td.text-right { padding: 15px 10px; }

                    /* TH colours — blue theme */
                    .pur-th-blue     { background: #3b82f6 !important; color: white !important; }
                    .pur-th-gray     { background: #e2e8f0 !important; color: #475569 !important; }
                    .pur-th-darkblue { background: #1d4ed8 !important; color: white !important; }

                    /* TD colours */
                    .pur-td-light-blue { background: #dbeafe !important; }
                    .pur-td-gray       { background: #f1f5f9 !important; }
                    .pur-td-darkblue   { background: #3b82f6 !important; color: white !important; }
                    .border-white      { border: 1px solid white !important; }

                    /* Item desc */
                    .pur-item-desc-box { padding: 8px 10px; }
                    .pur-item-name { color: #1d4ed8; font-weight: 700; font-size: 11px; line-height: 1.2; }
                    .pur-item-sub  { color: #94a3b8; font-size: 9px; margin-top: 2px; }

                    /* Totals */
                    .pur-totals-section { width: 350px; margin-left: auto; margin-bottom: 60px; }
                    .pur-totals-row { display: flex; justify-content: space-between; padding: 10px 0; border-top: 1px solid #f1f5f9; }
                    .pur-total-label  { font-size: 13px; font-weight: 700; color: #64748b; }
                    .pur-total-value  { font-size: 14px; font-weight: 800; color: #1e293b; }
                    .pur-grand-total-row { border-top: 2px solid #1d4ed8; padding: 15px 0; }
                    .pur-grand-label { color: #1d4ed8; font-size: 1.2rem; font-weight: 900; }
                    .pur-grand-value { color: #1d4ed8; font-size: 1.4rem; font-weight: 900; }

                    /* Footer */
                    .pur-signatures { display: flex; margin-top: 30px; margin-bottom: 60px; }
                    .pur-sign-box { font-size: 15px; font-weight: 800; color: #64748b; display: inline-block; }
                    .pur-footer-terms {
                        border-left: 5px solid #1d4ed8; padding-left: 20px;
                        font-size: 11px; color: #64748b; line-height: 1.6; font-weight: 500;
                    }
                    .pur-footer-terms p { margin: 2px 0; }
                    .pur-terms-bar { height: 3px; background: linear-gradient(90deg, #1d4ed8, transparent); margin-bottom: 12px; }
                    .pur-sub-footer {
                        margin-top: 50px; text-align: center;
                        border-top: 1px solid #f1f5f9; padding-top: 20px;
                        font-size: 10px; color: #94a3b8;
                    }
                    .pur-sub-footer p { margin: 2px 0; }

                    /* Print media */
                    @media print {
                        @page { size: A4 portrait; margin: 0; }
                        body * { visibility: hidden; }
                        #printable-purchase, #printable-purchase * { visibility: visible; }
                        .pur-print-overlay {
                            position: absolute; left: 0; top: 0; width: 100%; height: auto;
                            background: white; padding: 0;
                            display: block; overflow: visible !important;
                        }
                        .pur-print-content {
                            box-shadow: none; width: 100%; border-radius: 0;
                            display: block; position: static; overflow: visible !important;
                        }
                        #printable-purchase { position: static; margin: 0; padding: 40px !important; }
                        .no-print { display: none !important; }
                    }
                `}</style>
            </div>
        </div>
    );

    return ReactDOM.createPortal(modal, document.body);
};

export default PurchasePrint;
