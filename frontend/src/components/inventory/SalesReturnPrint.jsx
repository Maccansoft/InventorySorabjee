import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { X, Printer, Download } from 'lucide-react';
import ReactDOM from 'react-dom';
import html2pdf from 'html2pdf.js';
import { formatAmount, formatQty } from '../../utils/numberUtils';

// ─── Sales Return Print Modal ────────────────────────────────────────────────
// Renders a professional Credit Note / Sales Return document for a single
// sales_return record, fetched from GET /api/inventory/sales-returns/print/:id
// ─────────────────────────────────────────────────────────────────────────────

const SalesReturnPrint = ({ returnId, onClose, companyInfo }) => {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchReturn = async () => {
            try {
                const { data: retData } = await axios.get(`/api/inventory/sales-returns/print/${returnId}`);

                let finalCompanyInfo = companyInfo;
                if (retData.location_id) {
                    try {
                        const { data: locCompanyInfo } = await axios.get(`/api/company?location_id=${retData.location_id}`);
                        finalCompanyInfo = locCompanyInfo;
                    } catch (e) { console.error('Failed to fetch location company info', e); }
                }

                setData({ ...retData, companyInfo: finalCompanyInfo });
            } catch (e) {
                console.error(e);
                alert('Error loading sales return details');
            }
            setLoading(false);
        };
        fetchReturn();
    }, [returnId, companyInfo]);

    if (loading) return null;
    if (!data) return null;

    // ── Group details by item (maker + category + power) then by batch ──
    const groupedByItemAndBatch = (data.details || []).reduce((acc, d) => {
        const itemKey = `${d.maker_id}-${d.category_id}-${d.power_id || ''}`;
        const batchKey = `${d.lot_no || ''}-${d.mfg_date || ''}-${d.exp_date || ''}`;
        const pRate = parseFloat(d.p_rate || d.rate || 0);

        if (!acc[itemKey]) {
            acc[itemKey] = {
                description: `${d.maker_name || ''} ${d.category_name || ''}`.trim(),
                category_desc: d.category_description || '',
                power: d.power || '',
                unit_price: pRate,
                batches: {}
            };
        }

        if (!acc[itemKey].batches[batchKey]) {
            acc[itemKey].batches[batchKey] = { ...d, qty: 0 };
        }
        acc[itemKey].batches[batchKey].qty += parseFloat(d.qty || 0);

        return acc;
    }, {});

    const items = Object.values(groupedByItemAndBatch).map(item => {
        const batches = Object.values(item.batches);
        const group_total_qty    = batches.reduce((s, b) => s + b.qty, 0);
        const group_total_amount = group_total_qty * item.unit_price;
        return { ...item, lots: batches, group_total_qty, group_total_amount };
    });

    const grandTotal = items.reduce((s, item) => s + item.group_total_amount, 0);
    const totalQty   = (data.details || []).reduce((s, d) => s + parseFloat(d.qty || 0), 0);

    const handlePrint = () => window.print();

    const handleExportPDF = () => {
        const element = document.getElementById('printable-sales-return');
        const opt = {
            margin: [10, 10, 10, 10],
            filename: `SalesReturn_${(data.trans_no || 'N-A').replace(/[\/\\]/g, '_')}.pdf`,
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: { scale: 2, useCORS: true, logging: false },
            jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
        };
        html2pdf().set(opt).from(element).save();
    };

    const formatDate = (dateStr) => {
        if (!dateStr) return '';
        const d = new Date(dateStr);
        return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
    };

    const modal = (
        <div className="print-modal-overlay">
            <div className="print-modal-content">
                {/* ── Action Bar (Hidden on Print) ── */}
                <div className="print-action-bar no-print">
                    <div className="flex gap-4">
                        <button onClick={handlePrint}
                            className="flex items-center gap-2 bg-orange-600 text-white px-4 py-2 rounded-lg hover:bg-orange-700 transition-colors">
                            <Printer size={18} /> Print Credit Note
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
                <div className="invoice-document" id="printable-sales-return">

                    {/* Header */}
                    <div className="inv-header">
                        <div className="inv-header-left">
                            <h1 className="company-name-large-return">{data.companyInfo?.CompanyName || 'FA SYSTEM'}</h1>
                            <h2 className="doc-type-title-return">CREDIT NOTE / SALES RETURN</h2>
                        </div>
                        <div className="inv-header-right">
                            <p className="company-info-text-bold">{data.companyInfo?.CompanyName || 'FA SYSTEM'}</p>
                            {data.companyInfo?.Address  && <p className="company-info-text">{data.companyInfo.Address}</p>}
                            {(data.companyInfo?.Contact || data.companyInfo?.FaxNo) && (
                                <p className="company-info-text">
                                    {data.companyInfo?.Contact ? `Tel: ${data.companyInfo.Contact}` : ''}
                                    {data.companyInfo?.Contact && data.companyInfo?.FaxNo ? ' | ' : ''}
                                    {data.companyInfo?.FaxNo ? `Fax: ${data.companyInfo.FaxNo}` : ''}
                                </p>
                            )}
                            {data.companyInfo?.NTNo   && <p className="company-info-text">NTN: {data.companyInfo.NTNo}</p>}
                            {data.companyInfo?.GSTNo  && <p className="company-info-text">STRN/GST: {data.companyInfo.GSTNo}</p>}
                            {data.companyInfo?.GovtNo && <p className="company-info-text">Govt No: {data.companyInfo.GovtNo}</p>}
                            {data.companyInfo?.Email  && <p className="company-info-text email">{data.companyInfo.Email}</p>}
                        </div>
                    </div>

                    <div className="divider-orange"></div>

                    {/* Return Info Section */}
                    <div className="inv-info-section">
                        <div className="bill-to-box">
                            <span className="info-label">CREDIT TO:</span>
                            <h3 className="customer-name-print">{data.customer_name}</h3>
                            <p className="customer-detail-text">{data.customer_address}</p>
                            <p className="customer-detail-text">{data.customer_mobile}</p>
                            <p className="customer-detail-text">Cus. ID: {data.customer_id || 'N/A'}</p>
                        </div>
                        <div className="invoice-meta-box">
                            <div className="invoice-number-large-return">RETURN# {(data.trans_no || '').split('-').pop()}</div>
                            <div className="meta-row">
                                <span className="meta-label">Return Date:</span>
                                <span className="meta-value">{formatDate(data.trans_date)}</span>
                            </div>
                            <div className="meta-row">
                                <span className="meta-label">Return Ref#:</span>
                                <span className="meta-value">{data.trans_no}</span>
                            </div>
                        </div>
                    </div>

                    {/* Items Table */}
                    <table className="inv-table-main">
                        <thead>
                            <tr>
                                <th width="35"  className="th-salmon-return">S.NO</th>
                                <th width="220" className="th-gray-return">DESCRIPTION</th>
                                <th width="40"  className="th-gray-return">QTY</th>
                                <th width="80"  className="th-gray-return">LOT NO</th>
                                <th width="80"  className="th-gray-return">MFG DATE</th>
                                <th width="80"  className="th-gray-return">EXP DATE</th>
                                <th width="60"  className="th-gray-return text-center">UNIT PRICE</th>
                                <th width="40"  className="th-gray-return text-center">QTY</th>
                                <th width="70"  className="th-orange text-center">TOTAL</th>
                            </tr>
                        </thead>
                        <tbody>
                            {items.map((item, idx) => (
                                <React.Fragment key={idx}>
                                    {item.lots.map((lot, li) => (
                                        <tr key={`${idx}-${li}`}>
                                            {li === 0 && (
                                                <td rowSpan={item.lots.length}
                                                    className="text-center font-bold td-light-orange border-white border-b">
                                                    {idx + 1}
                                                </td>
                                            )}
                                            {li === 0 && (
                                                <td rowSpan={item.lots.length}
                                                    className="td-light-gray-return border-white border-b">
                                                    <div className="item-description-box">
                                                        <div className="item-main-name-return">{item.description}</div>
                                                        <div style={{ fontSize: '12px', fontWeight: '500', color: '#475569', marginTop: '2px' }}>
                                                            {item.category_desc}
                                                        </div>
                                                        <div className="item-sub-text">{item.power}</div>
                                                    </div>
                                                </td>
                                            )}
                                            <td className="text-center td-light-gray-return border-white">{formatQty(lot.qty)}</td>
                                            <td className="text-center td-light-gray-return border-white">{lot.lot_no}</td>
                                            <td className="text-center td-light-gray-return border-white">
                                                {lot.mfg_date ? new Date(lot.mfg_date).toLocaleDateString('en-GB').replace(/\//g, '-') : ''}
                                            </td>
                                            <td className="text-center td-light-gray-return border-white">
                                                {lot.exp_date ? new Date(lot.exp_date).toLocaleDateString('en-GB').replace(/\//g, '-') : ''}
                                            </td>
                                            {li === 0 && (
                                                <td rowSpan={item.lots.length}
                                                    className="text-center td-light-gray-return border-white border-b font-bold">
                                                    {formatAmount(item.unit_price)}
                                                </td>
                                            )}
                                            {li === 0 && (
                                                <td rowSpan={item.lots.length}
                                                    className="text-center td-light-gray-return border-white border-b font-bold">
                                                    {formatQty(item.group_total_qty)}
                                                </td>
                                            )}
                                            {li === 0 && (
                                                <td rowSpan={item.lots.length}
                                                    className="text-center td-orange text-white font-bold border-b border-white">
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
                    <div className="inv-totals-section">
                        <div className="totals-row border-none">
                            <span className="total-label">Total Qty:</span>
                            <span className="total-value">{formatQty(totalQty)}</span>
                        </div>
                        <div className="totals-row">
                            <span className="total-label">Gross Return:</span>
                            <span className="total-value">{formatAmount(grandTotal)}</span>
                        </div>
                        <div className="totals-row grand-total-row-return">
                            <span className="total-label-grand-return">CREDIT TOTAL</span>
                            <span className="total-value-grand-return">{formatAmount(grandTotal)}</span>
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="invoice-footer-wrapper">
                        <div className="signatures-section">
                            <div className="sign-box">Authorised By: ___________________________</div>
                        </div>
                        <div className="footer-terms-return">
                            <div className="terms-decoration-bar-return"></div>
                            <p>This document confirms the return of goods and corresponding credit to the customer's account.</p>
                            <p>Please retain this credit note for your records.</p>
                            <p>Credit will be adjusted against the next invoice or refunded as per agreed terms.</p>
                            <p>This is a system-generated document and does not require a signature.</p>
                        </div>
                        <div className="sub-footer-attribution">
                            <p>Application Authorized to: {data.companyInfo?.CompanyName || 'FA SYSTEM'}</p>
                            <p>© Copyright Maccansoft Corporation. All Rights Reserved.</p>
                        </div>
                    </div>
                </div>

                {/* ── Scoped Styles ── */}
                <style>{`
                    .print-modal-overlay {
                        position: fixed;
                        top: 0; left: 0; right: 0; bottom: 0;
                        background: rgba(0,0,0,0.5);
                        z-index: 9999;
                        display: flex;
                        justify-content: center;
                        padding: 40px;
                        overflow-y: auto;
                    }
                    .print-modal-content {
                        background: white;
                        width: 1000px;
                        min-height: 100%;
                        border-radius: 12px;
                        box-shadow: 0 20px 50px rgba(0,0,0,0.3);
                        position: relative;
                    }
                    .print-action-bar {
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
                    .invoice-document {
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
                    .invoice-footer-wrapper { margin-top: auto; padding-top: 20px; }

                    /* Header */
                    .inv-header { display: flex; justify-content: space-between; margin-bottom: 30px; }
                    .company-name-large-return {
                        font-size: 32px; font-weight: 900;
                        color: #ea580c;
                        letter-spacing: -0.02em; margin: 0;
                    }
                    .doc-type-title-return {
                        font-size: 18px; font-weight: 600;
                        color: #64748b; margin-top: 8px;
                    }
                    .inv-header-right { text-align: right; }
                    .company-info-text {
                        font-size: 10px; color: #64748b;
                        margin: 1px 0; font-weight: 500;
                    }
                    .company-info-text.email { color: #ea580c; text-decoration: underline; }
                    .company-info-text-bold { font-size: 11px; font-weight: 800; color: #1e293b; margin: 0; text-align: right; }

                    /* Divider */
                    .divider-orange {
                        height: 2px;
                        background: #f1f5f9;
                        border-top: 4px solid #ea580c;
                        margin-bottom: 30px;
                    }

                    /* Info section */
                    .inv-info-section { display: flex; justify-content: space-between; margin-bottom: 40px; }
                    .bill-to-box { width: 50%; }
                    .info-label { font-size: 12px; font-weight: 800; color: #94a3b8; display: block; margin-bottom: 8px; }
                    .customer-name-print { font-size: 22px; font-weight: 800; color: #1e293b; margin-bottom: 8px; }
                    .customer-detail-text { font-size: 12px; color: #64748b; margin: 2px 0; font-weight: 500; }
                    .invoice-meta-box { text-align: right; }
                    .invoice-number-large-return {
                        font-size: 28px; font-weight: 900;
                        color: #ea580c; margin-bottom: 15px; opacity: 0.85;
                    }
                    .meta-row { display: flex; justify-content: flex-end; gap: 15px; margin-bottom: 4px; }
                    .meta-label { font-size: 12px; font-weight: 800; color: #94a3b8; }
                    .meta-value { font-size: 12px; font-weight: 700; color: #1e293b; min-width: 150px; }

                    /* Table */
                    .inv-table-main { width: 100%; border-collapse: collapse; margin-bottom: 40px; }
                    .inv-table-main thead th {
                        padding: 12px 8px; font-size: 11px;
                        font-weight: 800; text-align: left;
                        border-bottom: 2px solid #e2e8f0;
                    }
                    .inv-table-main tbody td {
                        padding: 0; border-bottom: 1px solid #f1f5f9; font-size: 10px;
                    }
                    .inv-table-main tbody td.text-center,
                    .inv-table-main tbody td.text-right { padding: 15px 10px; }

                    /* TH colours — orange theme */
                    .th-salmon-return { background: #f97316 !important; color: white !important; }
                    .th-gray-return   { background: #e2e8f0 !important; color: #475569 !important; }
                    .th-orange        { background: #ea580c !important; color: white !important; }

                    /* TD colours */
                    .td-light-orange    { background: #fff7ed !important; }
                    .td-light-gray-return { background: #f1f5f9 !important; }
                    .td-orange          { background: #f97316 !important; color: white !important; }
                    .border-white       { border: 1px solid white !important; }

                    /* Item desc */
                    .item-description-box { padding: 8px 10px; }
                    .item-main-name-return { color: #ea580c; font-weight: 700; font-size: 11px; line-height: 1.2; }
                    .item-sub-text        { color: #94a3b8; font-size: 9px; margin-top: 2px; }

                    /* Totals */
                    .inv-totals-section { width: 350px; margin-left: auto; margin-bottom: 60px; }
                    .totals-row { display: flex; justify-content: space-between; padding: 10px 0; border-top: 1px solid #f1f5f9; }
                    .total-label  { font-size: 13px; font-weight: 700; color: #64748b; }
                    .total-value  { font-size: 14px; font-weight: 800; color: #1e293b; }
                    .grand-total-row-return { border-top: 2px solid #ea580c; padding: 15px 0; }
                    .total-label-grand-return { color: #ea580c; font-size: 1.2rem; font-weight: 900; }
                    .total-value-grand-return { color: #ea580c; font-size: 1.4rem; font-weight: 900; }

                    /* Footer */
                    .signatures-section { margin-top: 30px; margin-bottom: 60px; }
                    .sign-box { font-size: 15px; font-weight: 800; color: #64748b; display: inline-block; }
                    .footer-terms-return {
                        border-left: 5px solid #ea580c; padding-left: 20px;
                        font-size: 11px; color: #64748b; line-height: 1.6; font-weight: 500;
                    }
                    .footer-terms-return p { margin: 2px 0; }
                    .terms-decoration-bar-return { height: 3px; background: linear-gradient(90deg, #ea580c, transparent); margin-bottom: 12px; }
                    .sub-footer-attribution {
                        margin-top: 50px; text-align: center;
                        border-top: 1px solid #f1f5f9; padding-top: 20px;
                        font-size: 10px; color: #94a3b8;
                    }
                    .sub-footer-attribution p { margin: 2px 0; }

                    /* Print media */
                    @media print {
                        @page { size: A4 portrait; margin: 0; }
                        body * { visibility: hidden; }
                        #printable-sales-return, #printable-sales-return * { visibility: visible; }
                        .print-modal-overlay {
                            position: absolute; left: 0; top: 0; width: 100%; height: auto;
                            background: white; padding: 0;
                            display: block; overflow: visible !important;
                        }
                        .print-modal-content {
                            box-shadow: none; width: 100%; border-radius: 0;
                            display: block; position: static; overflow: visible !important;
                        }
                        #printable-sales-return { position: static; margin: 0; padding: 40px !important; }
                        .no-print { display: none !important; }
                    }
                `}</style>
            </div>
        </div>
    );

    return ReactDOM.createPortal(modal, document.body);
};

export default SalesReturnPrint;
