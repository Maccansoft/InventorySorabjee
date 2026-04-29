import React from 'react';
import { Plus, Trash2, Scan, Search } from 'lucide-react';
import SearchableSelect from '../../common/SearchableSelect';
import { thStyle, tdStyle, inputStyle } from './styles';
import { formatAmount, formatQty } from '../../../utils/numberUtils';

const DetailsTable = ({
    details, makers, rowCategories, powers, rowMeta, salesRates,
    handleMakerOrCategoryChange, updateRow, removeRow, addRow,
    handleScanKeyDown, handleQtyKeyDown, handleManualScan,
    highlightDetailId, type, refs, moveToNextField
}) => {
    const isTrq = type === 'TRANSFER_REQUEST';

    return (
        <div className="premium-scrollbar" style={{ background: 'white', borderRadius: 18, border: '1px solid #e2e8f0', minHeight: '500px', maxHeight: '680px', overflow: 'auto', position: 'relative', zIndex: 1, boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '1300px' }}>
                <thead style={{ position: 'sticky', top: 0, zIndex: 10, background: '#f8fafc' }}>
                    <tr style={{ background: '#f8fafc' }}>
                        <th style={{ ...thStyle, width: '180px' }}>Maker</th>
                        <th style={{ ...thStyle, width: '180px' }}>Category</th>
                        <th style={{ ...thStyle, width: '100px' }}>Power</th>
                        {type === 'TRANSFER' && <th style={{ ...thStyle, width: '100px', textAlign: 'center' }}>Stock Required</th>}
                        {type === 'TRANSFER_REQUEST' && <th style={{ ...thStyle, width: '100px', textAlign: 'center' }}>Stock Received</th>}
                        {type !== 'STOCK_OPENING' && type !== 'TRANSFER_REQUEST' && <th style={{ ...thStyle, width: '100px', textAlign: 'center' }}>Stock In Hand</th>}
                        {!isTrq && (
                            <>
                                <th style={{ ...thStyle, width: '150px' }}>Barcode Scan</th>
                                <th style={{ ...thStyle, width: '120px' }}>Lot No</th>
                                <th style={{ ...thStyle, width: '120px' }}>SNo</th>
                                <th style={{ ...thStyle, width: '130px' }}>MFG Date</th>
                                <th style={{ ...thStyle, width: '130px' }}>EXP Date</th>
                            </>
                        )}
                        <th style={{ ...thStyle, width: '100px', textAlign: 'center' }}>{isTrq ? 'Qty Request' : 'Qty'}</th>
                        {(!isTrq && type !== 'TRANSFER') && (
                            <>
                                {type === 'SALES_INVOICE' ? (
                                    <>
                                        <th style={{ ...thStyle, width: '120px', textAlign: 'right' }}>A.RATE</th>
                                        <th style={{ ...thStyle, width: '120px', textAlign: 'right' }}>P.RATE</th>
                                    </>
                                ) : (
                                    <th style={{ ...thStyle, width: '100px', textAlign: 'right' }}>Rate</th>
                                )}
                                <th style={{ ...thStyle, width: '120px', textAlign: 'right' }}>Amount</th>
                            </>
                        )}
                        <th style={{ ...thStyle, width: '50px' }}></th>
                    </tr>
                </thead>
                <tbody>
                    {(() => {
                        let lastTransNo = null;
                        let lastItemKey = null;
                        let groupQty = 0;

                        const result = [];

                        details.forEach((d, i) => {
                            const isTransfer = type === 'TRANSFER';
                            const itemKey = `${d.reqTransNo}-${d.maker_id}-${d.category_id}-${d.power_id}`;
                            const isNewTrans = isTransfer && d.reqTransNo && d.reqTransNo !== lastTransNo;
                            const isFirstOfItem = isTransfer && d.reqTransNo && itemKey !== lastItemKey;

                            if (isNewTrans) {
                                result.push(
                                    <tr key={`trans-h-${d.reqTransNo}-${i}`} style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                                        <td colSpan={50} style={{ padding: '12px 20px', position: 'relative' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                                <div style={{ background: '#3b82f6', color: 'white', padding: '2px 8px', borderRadius: '4px', fontSize: '0.65rem', fontWeight: 900, textTransform: 'uppercase' }}>SOURCE</div>
                                                <span style={{ fontWeight: 800, color: '#1e293b', fontSize: '0.85rem' }}>
                                                    Transaction ID: <span style={{ color: '#2563eb' }}>{d.reqTransNo}</span>
                                                </span>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            }
                            lastTransNo = d.reqTransNo;
                            lastItemKey = itemKey;

                            // We only show parent-level fields on the FIRST row of the item group
                            const shouldShowParentFields = !isTransfer || !d.reqTransNo || isFirstOfItem;

                            result.push(
                                <tr key={`row-${i}`} className={`row-animate ${d.id === highlightDetailId ? 'focused-row' : ''}`} style={{ borderTop: i > 0 && !isNewTrans && shouldShowParentFields ? '1px solid #f1f5f9' : 'none', background: 'white' }}>
                                    {/* Maker Column */}
                                    <td style={tdStyle}>
                                        {shouldShowParentFields ? (
                                            <SearchableSelect
                                                ref={el => { if (refs) refs.current[`maker-${i}`] = el; }}
                                                options={makers.map(m => ({ value: m.id, label: m.name }))}
                                                value={d.maker_id}
                                                onChange={val => handleMakerOrCategoryChange(i, 'maker_id', val)}
                                                onEnter={() => moveToNextField(i, 'maker')}
                                                placeholder="-- Maker --"
                                            />
                                        ) : null}
                                    </td>
                                    {/* Category Column */}
                                    <td style={tdStyle}>
                                        {shouldShowParentFields ? (
                                            <SearchableSelect
                                                ref={el => { if (refs) refs.current[`category-${i}`] = el; }}
                                                options={(rowCategories[d.maker_id] || []).map(c => ({ value: c.id, label: c.name }))}
                                                value={d.category_id}
                                                onChange={val => handleMakerOrCategoryChange(i, 'category_id', val)}
                                                onEnter={() => moveToNextField(i, 'category')}
                                                placeholder="-- Category --"
                                            />
                                        ) : null}
                                    </td>
                                    {/* Power Column */}
                                    <td style={tdStyle}>
                                        {shouldShowParentFields ? (
                                            <SearchableSelect
                                                ref={el => { if (refs) refs.current[`power-${i}`] = el; }}
                                                options={powers.map(p => ({ value: p.id, label: p.power }))}
                                                value={d.power_id}
                                                onChange={val => updateRow(i, 'power_id', val)}
                                                onEnter={() => moveToNextField(i, 'power')}
                                                placeholder="P"
                                            />
                                        ) : null}
                                    </td>
                                    {/* Stock Logic Column */}
                                    {type === 'TRANSFER' && (
                                        <td style={tdStyle}>
                                            {shouldShowParentFields ? (
                                                <input
                                                    type="text"
                                                    value={parseFloat(d.stock_required || 0) % 1 === 0 ? parseFloat(d.stock_required || 0).toString() : parseFloat(d.stock_required || 0).toFixed(2)}
                                                    onChange={e => updateRow(i, 'stock_required', e.target.value)}
                                                    style={{ ...inputStyle, textAlign: 'center', fontWeight: 700, color: '#0369a1' }}
                                                />
                                            ) : null}
                                        </td>
                                    )}
                                    {type === 'TRANSFER_REQUEST' && (
                                        <td style={tdStyle}>
                                            {shouldShowParentFields ? (
                                                <input type="number" min="0" value={d.stock_received || 0} onChange={e => updateRow(i, 'stock_received', e.target.value)} style={{ ...inputStyle, textAlign: 'center', fontWeight: 700, color: '#0369a1' }} />
                                            ) : null}
                                        </td>
                                    )}
                                    {/* Stock In Hand Column */}
                                    {type !== 'STOCK_OPENING' && type !== 'TRANSFER_REQUEST' && (
                                        <td style={{ ...tdStyle, textAlign: 'center', fontWeight: 800, color: '#475569' }}>
                                            {shouldShowParentFields ? formatQty(d.qty_in_hand || 0) : null}
                                        </td>
                                    )}

                                    {/* --- FULFILLMENT FIELDS (Always Show) --- */}
                                    {!isTrq && (
                                        <>
                                            <td style={tdStyle}>
                                                <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                                                    <input
                                                        ref={el => { if (refs) refs.current[`barcode-${i}`] = el; }}
                                                        placeholder={(d.maker_id || type === 'SALES_RETURN') ? "Scan or Enter" : "Select Maker First"}
                                                        value={d.barcode || ''}
                                                        disabled={!d.maker_id && type !== 'SALES_RETURN'}
                                                        onChange={e => updateRow(i, 'barcode', e.target.value)}
                                                        onKeyDown={e => handleScanKeyDown(e, i)}
                                                        style={{
                                                            ...inputStyle,
                                                            paddingRight: 40,
                                                            background: (d.maker_id || type === 'SALES_RETURN') ? '#f8fafc' : '#f1f5f9'
                                                        }}
                                                    />
                                                    <div style={{ position: 'absolute', right: 10, color: '#94a3b8' }}><Scan size={14} /></div>
                                                </div>
                                            </td>
                                            <td style={tdStyle}>
                                                <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                                                    <input value={d.lot_no || ''} onChange={e => updateRow(i, 'lot_no', e.target.value)} placeholder="LOT" style={{ ...inputStyle, fontWeight: 700, borderColor: rowMeta[i]?.autoFilled ? '#2563eb' : '#e2e8f0' }} />
                                                    <button type="button" onClick={() => handleManualScan(i)} style={{ position: 'absolute', right: 8, background: 'none', border: 'none', color: '#64748b' }}><Search size={14} /></button>
                                                </div>
                                            </td>
                                            <td style={tdStyle}>
                                                <input value={d.sno || ''} onChange={e => updateRow(i, 'sno', e.target.value)} style={{ ...inputStyle, textAlign: 'center' }} placeholder="SNo" />
                                            </td>
                                            <td style={tdStyle}>
                                                <input type="date" value={d.mfg_date} onChange={e => updateRow(i, 'mfg_date', e.target.value)} style={inputStyle} />
                                            </td>
                                            <td style={tdStyle}>
                                                <input type="date" value={d.exp_date} onChange={e => updateRow(i, 'exp_date', e.target.value)} style={inputStyle} />
                                            </td>
                                        </>
                                    )}
                                    <td style={tdStyle}>
                                        <input ref={el => { if (refs) refs.current[`qty-${i}`] = el; }} type="text" value={formatQty(d.qty)} onChange={e => updateRow(i, 'qty', e.target.value.replace(/,/g, ''))} onKeyDown={e => handleQtyKeyDown(e, i)} style={{ ...inputStyle, textAlign: 'center', fontWeight: 800 }} />
                                    </td>
                                    {(!isTrq && type !== 'TRANSFER') && (
                                        <>
                                            <td style={tdStyle}>
                                                <input
                                                    type="text"
                                                    value={formatAmount(d.rate)}
                                                    onChange={e => updateRow(i, 'rate', e.target.value.replace(/,/g, ''))}
                                                    style={{ ...inputStyle, textAlign: 'right' }}
                                                />
                                            </td>
                                            {type === 'SALES_INVOICE' && (
                                                <td style={tdStyle}>
                                                    <input
                                                        type="text"
                                                        value={formatAmount(d.p_rate)}
                                                        onChange={e => updateRow(i, 'p_rate', e.target.value.replace(/,/g, ''))}
                                                        style={{ ...inputStyle, textAlign: 'right', color: '#64748b' }}
                                                        placeholder="P.Rate"
                                                    />
                                                </td>
                                            )}
                                            <td style={tdStyle}>
                                                <input
                                                    type="text"
                                                    value={formatAmount(d.amount)}
                                                    onChange={e => updateRow(i, 'amount', e.target.value.replace(/,/g, ''))}
                                                    style={{ ...inputStyle, textAlign: 'right', fontWeight: 800 }}
                                                />
                                            </td>
                                        </>
                                    )}
                                    <td style={tdStyle}>
                                        <button type="button" onClick={() => removeRow(i)} style={{ background: 'none', border: 'none', color: '#ef4444' }}><Trash2 size={16} /></button>
                                    </td>
                                </tr>
                            );

                            // Detect end of an Item Group to show Footer (Add Row + Total Qty)
                            const nextRow = details[i + 1];
                            const nextItemKey = nextRow ? `${nextRow.reqTransNo}-${nextRow.maker_id}-${nextRow.category_id}-${nextRow.power_id}` : null;

                            if (isTransfer && d.reqTransNo) {
                                groupQty += parseFloat(d.qty || 0);
                                if (itemKey !== nextItemKey) {
                                    result.push(
                                        <tr key={`footer-${itemKey}-${i}`} style={{ background: '#fdfdfd', borderBottom: '2px solid #e2e8f0' }}>
                                            <td colSpan={20} style={{ padding: '6px 20px' }}>
                                                <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center' }}>
                                                    <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                                                        Total Qty for this item: <strong style={{ color: '#1e293b', fontSize: '0.85rem' }}>{formatQty(groupQty)}</strong>
                                                    </div>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                    groupQty = 0; // Reset for next group
                                }
                            }
                        });
                        return result;
                    })()}
                </tbody>
            </table>
            {type !== 'TRANSFER' && (
                <div style={{ padding: '16px 20px', background: '#f8fafc', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'center' }}>
                    <button type="button" onClick={() => addRow()} className="btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 20px' }}>
                        <Plus size={16} /> Add Another Row
                    </button>
                </div>
            )}
        </div>
    );
};

export default DetailsTable;
