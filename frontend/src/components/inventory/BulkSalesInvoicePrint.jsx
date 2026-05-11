import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { X, Printer, Download } from 'lucide-react';
import ReactDOM from 'react-dom';
import { formatAmount, formatQty } from '../../utils/numberUtils';

const BulkSalesInvoicePrint = ({ selection, onClose, companyInfo, currentUser }) => {
    const [invoices, setInvoices] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchInvoices = async () => {
            try {
                let params = {
                    location_id: currentUser.location_id,
                    fiscal_year_id: currentUser.fiscal_year_id
                };
                if (selection.mode === 'RANGE') {
                    params.fromNo = selection.fromNo;
                    params.toNo = selection.toNo;
                } else {
                    // For specific numbers, the backend needs to handle lookup by trans_no list or we fetch by IDs
                    // The backend I just wrote supports 'ids'. Let's see if I should support 'transNos'
                    // Actually, let's update the backend to support 'transNos' too or just lookup IDs here.
                    // For now, let's assume specificNos are trans_nos.
                    params.transNos = selection.specificNos;
                }

                const { data } = await axios.get('/api/inventory/sales/print-bulk', { params });
                setInvoices(data);
            } catch (e) {
                console.error(e);
                alert('Error loading invoices: ' + (e.response?.data?.error || e.message));
                onClose();
            }
            setLoading(false);
        };
        fetchInvoices();
    }, [selection, currentUser]);

    if (loading) {
        return (
            <div className="print-modal-overlay">
                <div style={{
                    background: 'white',
                    padding: '32px',
                    borderRadius: '16px',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '16px',
                    boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)'
                }}>
                    <div style={{
                        width: '48px',
                        height: '48px',
                        border: '4px solid #2563eb',
                        borderTopColor: 'transparent',
                        borderRadius: '50%',
                        animation: 'spin 1s linear infinite'
                    }}></div>
                    <p style={{ fontWeight: 'bold', color: '#475569' }}>Preparing Invoices for Printing...</p>
                    <style>{`
                        @keyframes spin {
                            from { transform: rotate(0deg); }
                            to { transform: rotate(360deg); }
                        }
                    `}</style>
                </div>
            </div>
        );
    }

    if (invoices.length === 0) return null;

    const handlePrint = () => {
        window.print();
    };

    const formatDate = (dateStr) => {
        if (!dateStr) return '';
        const d = new Date(dateStr);
        return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
    };

    const processInvoiceData = (data) => {
        const groupedByItemAndBatch = data.details.reduce((acc, d) => {
            const itemKey = `${d.maker_id}-${d.category_id}-${d.power_id || ''}`;
            const batchKey = `${d.lot_no || ''}-${d.mfg_date || ''}-${d.exp_date || ''}`;
            const pRate = parseFloat(d.p_rate || 0);

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
            const group_total_qty = batches.reduce((sum, b) => sum + b.qty, 0);
            const group_total_amount = group_total_qty * item.unit_price;

            return {
                ...item,
                lots: batches,
                group_total_qty,
                group_total_amount
            };
        });
        const invoiceGrossTotal = items.reduce((sum, item) => sum + item.group_total_amount, 0);
        return { items, invoiceGrossTotal };
    };

    const modal = (
        <div className="print-modal-overlay">
            <div className="print-modal-content" style={{ width: '1100px' }}>
                <div className="print-action-bar no-print">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                        <h2 style={{ fontWeight: 700, color: '#334155', margin: 0 }}>Bulk Print Preview ({invoices.length} Invoices)</h2>
                        <button 
                            onClick={handlePrint} 
                            className="btn-primary"
                            style={{ 
                                background: '#2563eb', 
                                border: 'none',
                                padding: '8px 24px'
                            }}
                        >
                            <Printer size={18} /> Print All Invoices
                        </button>
                    </div>
                    <button onClick={onClose} style={{ padding: '8px', color: '#94a3b8' }}>
                        <X size={24} />
                    </button>
                </div>

                <div id="bulk-printable-area">
                    {invoices.map((inv, idx) => {
                        const { items, invoiceGrossTotal } = processInvoiceData(inv);
                        return (
                            <div key={inv.id} className="invoice-document bulk-invoice-page" style={{ pageBreakAfter: 'always', padding: '40px 60px' }}>
                                {/* Header */}
                                <div className="inv-header">
                                    <div className="inv-header-left">
                                        <h1 className="company-name-large">SORABJEE PATEL & CO</h1>
                                        <h2 className="doc-type-title">INVOICE</h2>
                                    </div>
                                    <div className="inv-header-right">
                                        <p className="company-info-text-bold">SORABJEE PATEL & CO.</p>
                                        <p className="company-info-text">45, Badri Building I.I Chundrigar Road,</p>
                                        <p className="company-info-text">Karachi - 74000 [Pakistan] P.O. Box: 13524</p>
                                        <p className="company-info-text">Tel: +92-21-3242-1033, +92-21-3247-3218</p>
                                        <p className="company-info-text">Fax: +92-21-3242-3018</p>
                                        <p className="company-info-text">NTN: 2271347-6</p>
                                        <p className="company-info-text">STRN: 17-00-9018-034-19</p>
                                        <p className="company-info-text email">kmn_sorabjee64@yahoo.com</p>
                                    </div>
                                </div>

                                <div className="divider-red"></div>

                                {/* Billing & Invoice Info */}
                                <div className="inv-info-section">
                                    <div className="bill-to-box">
                                        <span className="info-label">INVOICE TO:</span>
                                        <h3 className="customer-name-print">{inv.customer_name}</h3>
                                        <p className="customer-detail-text">{inv.customer_address}</p>
                                        <p className="customer-detail-text">{inv.customer_mobile}</p>
                                        <p className="customer-detail-text">Cus. ID: {inv.customer_id || 'N/A'}</p>
                                        <p className="customer-detail-text">PO# {inv.po_no || 'N/A'}</p>
                                    </div>
                                    <div className="invoice-meta-box">
                                        <div className="invoice-number-large">INVOICE# {inv.trans_no.split('-').pop()}</div>
                                        <div className="meta-row">
                                            <span className="meta-label">Invoice Date:</span>
                                            <span className="meta-value">{formatDate(inv.trans_date)}</span>
                                        </div>
                                        <div className="meta-row">
                                            <span className="meta-label">Invoice#:</span>
                                            <span className="meta-value">{inv.trans_no}</span>
                                        </div>
                                        <div className="meta-row">
                                            <span className="meta-label">DC Date:</span>
                                            <span className="meta-value">{formatDate(inv.trans_date)}</span>
                                        </div>
                                        <div className="meta-row">
                                            <span className="meta-label">DC#:</span>
                                            <span className="meta-value">{inv.trans_no}</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Table */}
                                <table className="inv-table-main">
                                    <thead>
                                        <tr>
                                            <th width="35" className="th-salmon">S.NO</th>
                                            <th width="220" className="th-gray">DESCRIPTION</th>
                                            <th width="40" className="th-gray">QTY</th>
                                            <th width="80" className="th-gray">LOT NO</th>
                                            <th width="80" className="th-gray">MFG DATE</th>
                                            <th width="80" className="th-gray">EXP DATE</th>
                                            <th width="60" className="th-gray text-center">UNIT PRICE</th>
                                            <th width="40" className="th-gray text-center">QTY</th>
                                            <th width="70" className="th-red text-center">TOTAL</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {items.map((item, iIdx) => (
                                            <React.Fragment key={iIdx}>
                                                {item.lots.map((lot, li) => (
                                                    <tr key={`${iIdx}-${li}`}>
                                                        {li === 0 && (
                                                            <td rowSpan={item.lots.length} className="text-center font-bold td-light-red border-white border-b">
                                                                {iIdx + 1}
                                                            </td>
                                                        )}
                                                        {li === 0 && (
                                                            <td rowSpan={item.lots.length} className="td-light-gray border-white border-b">
                                                                <div className="item-description-box">
                                                                    <div className="item-main-name">{item.description}</div>
                                                                    <div className="item-cat-desc" style={{ fontSize: '10px', fontWeight: '500', color: '#475569', marginTop: '1px' }}>
                                                                        {item.category_desc}
                                                                    </div>
                                                                    <div className="item-sub-text">{item.power}</div>
                                                                </div>
                                                            </td>
                                                        )}
                                                        <td className="text-center td-light-gray border-white">{formatQty(lot.qty)}</td>
                                                        <td className="text-center td-light-gray border-white">{lot.lot_no}</td>
                                                        <td className="text-center td-light-gray border-white">{new Date(lot.mfg_date).toLocaleDateString('en-GB').replace(/\//g, '-')}</td>
                                                        <td className="text-center td-light-gray border-white">{new Date(lot.exp_date).toLocaleDateString('en-GB').replace(/\//g, '-')}</td>
                                                        {li === 0 && (
                                                            <td rowSpan={item.lots.length} className="text-center td-light-gray border-white border-b font-bold">
                                                                {formatAmount(item.unit_price)}
                                                            </td>
                                                        )}
                                                        {li === 0 && (
                                                            <td rowSpan={item.lots.length} className="text-center td-light-gray border-white border-b font-bold">
                                                                {formatQty(item.group_total_qty)}
                                                            </td>
                                                        )}
                                                        {li === 0 && (
                                                            <td rowSpan={item.lots.length} className="text-center td-salmon text-white font-bold border-b border-white">
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
                                        <span className="total-value">{formatQty(inv.details.reduce((s, d) => s + parseFloat(d.qty), 0))}</span>
                                    </div>
                                    <div className="totals-row">
                                        <span className="total-label">Gross Total:</span>
                                        <span className="total-value">{formatAmount(invoiceGrossTotal)}</span>
                                    </div>
                                    <div className="totals-row grand-total-row">
                                        <span className="total-label-grand">GRAND TOTAL</span>
                                        <span className="total-value-grand">{formatAmount(invoiceGrossTotal)}</span>
                                    </div>
                                </div>

                                {/* Signatures */}
                                <div className="signatures-section">
                                    <div className="sign-box">
                                        Reciever's Sign: ___________________________
                                    </div>
                                </div>

                                {/* Footer Terms */}
                                <div className="footer-terms">
                                    <div className="terms-decoration-bar"></div>
                                    <p>Payment shall be made in full at the time of receiving goods.</p>
                                    <p>The customer has to make sure the quantity and quality of goods at the time of receiving.</p>
                                    <p>Goods can not be returned once received, without a valid reason.</p>
                                    <p>Any claim will be entertained within 5 days after receiving the goods.</p>
                                    <p>Company does not take any responsibility if customer fails to check the goods at the time of receiving.</p>
                                    <p>This is a system-generated invoice, does not need signature.</p>
                                </div>

                                {/* Sub Footer */}
                                <div className="sub-footer-attribution">
                                    <p>Application Authorized to: SORABJEE PATEL & CO.</p>
                                    <p>© Copyright Maccansoft Corporation. All Rights Reserved.</p>
                                </div>
                            </div>
                        );
                    })}
                </div>

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
                        padding: 60px 80px;
                        background: white;
                        font-family: 'Inter', sans-serif;
                        color: #1e293b;
                    }

                    .inv-header {
                        display: flex;
                        justify-content: space-between;
                        margin-bottom: 30px;
                    }
                    .company-name-large {
                        font-size: 32px;
                        font-weight: 900;
                        color: #e11d48;
                        letter-spacing: -0.02em;
                        margin: 0;
                    }
                    .doc-type-title {
                        font-size: 20px;
                        font-weight: 500;
                        color: #64748b;
                        margin-top: 8px;
                    }
                    .inv-header-right {
                        text-align: right;
                    }
                    .company-info-text {
                        font-size: 10px;
                        color: #64748b;
                        margin: 1px 0;
                        font-weight: 500;
                    }
                    .company-info-text.email {
                        color: #e11d48;
                        text-decoration: underline;
                    }

                    .divider-red {
                        height: 2px;
                        background: #f1f5f9;
                        border-top: 4px solid #e11d48;
                        margin-bottom: 30px;
                    }

                    .inv-info-section {
                        display: flex;
                        justify-content: space-between;
                        margin-bottom: 40px;
                    }
                    .bill-to-box {
                        width: 50%;
                    }
                    .info-label {
                        font-size: 12px;
                        font-weight: 800;
                        color: #94a3b8;
                        display: block;
                        margin-bottom: 8px;
                    }
                    .customer-name-print {
                        font-size: 22px;
                        font-weight: 800;
                        color: #1e293b;
                        margin-bottom: 8px;
                    }
                    .customer-detail-text {
                        font-size: 12px;
                        color: #64748b;
                        margin: 2px 0;
                        font-weight: 500;
                    }

                    .invoice-meta-box {
                        text-align: right;
                    }
                    .invoice-number-large {
                        font-size: 28px;
                        font-weight: 900;
                        color: #e11d48;
                        margin-bottom: 15px;
                        opacity: 0.8;
                    }
                    .meta-row {
                        display: flex;
                        justify-content: flex-end;
                        gap: 15px;
                        margin-bottom: 4px;
                    }
                    .meta-label {
                        font-size: 12px;
                        font-weight: 800;
                        color: #94a3b8;
                    }
                    .meta-value {
                        font-size: 12px;
                        font-weight: 700;
                        color: #1e293b;
                        min-width: 150px;
                    }

                    .inv-table-main {
                        width: 100%;
                        border-collapse: collapse;
                        margin-bottom: 40px;
                    }
                    .inv-table-main thead th {
                        background: #f1f5f9;
                        padding: 12px 8px;
                        font-size: 11px;
                        font-weight: 800;
                        color: #64748b;
                        text-align: left;
                        border-bottom: 2px solid #e2e8f0;
                    }
                    .inv-table-main tbody td {
                        padding: 0;
                        border-bottom: 1px solid #f1f5f9;
                        font-size: 10px;
                    }
                    .item-description-box {
                        padding: 8px 10px;
                    }
                    .item-main-name {
                        color: #e11d48;
                        font-weight: 700;
                        font-size: 11px;
                        line-height: 1.2;
                    }
                    .item-sub-text {
                        color: #94a3b8;
                        font-size: 9px;
                        margin-top: 2px;
                    }
                    .inv-table-main tbody td.text-center, 
                    .inv-table-main tbody td.text-right {
                        padding: 15px 10px;
                    }

                    .inv-totals-section {
                        width: 350px;
                        margin-left: auto;
                        margin-bottom: 60px;
                    }
                    .totals-row {
                        display: flex;
                        justify-content: space-between;
                        padding: 10px 0;
                        border-top: 1px solid #f1f5f9;
                    }
                    .total-label {
                        font-size: 13px;
                        font-weight: 700;
                        color: #64748b;
                    }
                    .total-value {
                        font-size: 14px;
                        font-weight: 800;
                        color: #1e293b;
                    }
                    .grand-total-row {
                        border-top: 2px solid #e11d48;
                        padding: 15px 0;
                        color: #e11d48;
                    }
                    .total-label-grand { color: #e11d48; font-size: 1.2rem; font-weight: 900; }
                    .total-value-grand { color: #e11d48; font-size: 1.4rem; font-weight: 900; }

                    .signatures-section {
                        margin-top: 30px;
                        margin-bottom: 60px;
                    }
                    .sign-box {
                        font-size: 15px;
                        font-weight: 800;
                        color: #64748b;
                        border-bottom: 2px solid transparent;
                        display: inline-block;
                    }

                    .footer-terms {
                        border-left: 5px solid #e11d48;
                        padding-left: 20px;
                        font-size: 11px;
                        color: #64748b;
                        line-height: 1.6;
                        font-weight: 500;
                    }
                    .footer-terms p { margin: 2px 0; }

                    .sub-footer-attribution {
                        margin-top: 50px;
                        text-align: center;
                        border-top: 1px solid #f1f5f9;
                        padding-top: 20px;
                        font-size: 10px;
                        color: #94a3b8;
                    }
                    .sub-footer-attribution p { margin: 2px 0; }

                    @media print {
                        body * { visibility: hidden; }
                        #bulk-printable-area, #bulk-printable-area * { visibility: visible; }
                        #bulk-printable-area {
                            position: absolute;
                            left: 0; top: 0; width: 100%;
                            margin: 0;
                            padding: 0;
                        }
                        .invoice-document {
                            margin: 0;
                            padding: 20px 40px !important;
                            border: none;
                            box-shadow: none;
                        }
                        .no-print { display: none !important; }
                        .print-modal-overlay { background: white; padding: 0; }
                        .print-modal-content { box-shadow: none; width: 100%; border-radius: 0; }
                        thead { display: table-header-group; }
                        tfoot { display: table-footer-group; }
                    }

                    .th-salmon { background: #e67e73 !important; color: white !important; }
                    .th-gray { background: #e2e8f0 !important; color: #475569 !important; }
                    .th-red { background: #e11d48 !important; color: white !important; }
                    .td-light-red { background: #fde2e1 !important; }
                    .td-light-gray { background: #f1f5f9 !important; }
                    .td-salmon { background: #e67e73 !important; color: white !important; }
                    .border-white { border: 1px solid white !important; }
                    .company-info-text-bold { font-size: 11px; font-weight: 800; color: #1e293b; margin: 0; text-align: right; }
                `}</style>
            </div>
        </div>
    );

    return ReactDOM.createPortal(modal, document.body);
};

export default BulkSalesInvoicePrint;
