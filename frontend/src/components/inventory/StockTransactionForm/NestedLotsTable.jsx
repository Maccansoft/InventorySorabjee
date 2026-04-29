import React from 'react';
import { Plus, Trash2, Scan, Search } from 'lucide-react';
import SearchableSelect from '../../common/SearchableSelect';
import { thStyle, tdStyle, inputStyle } from './styles';
import { formatAmount, formatQty } from '../../../utils/numberUtils';

const NestedLotsTable = ({
    details, makers, rowCategories, powers, rowMeta, lotErrors,
    handleMakerOrCategoryChange, updateRow, removeRow, addRow,
    handleScanKeyDown, handleManualScan, handleQtyKeyDown,
    addLotToRow, removeLotFromRow, updateNestedLot, handleLotScanKeyDown,
    type, color, accent, highlightDetailId
}) => {
    return (
        <div style={{ background: 'white', borderRadius: 18, border: '1px solid #e2e8f0', minHeight: '500px', position: 'relative', zIndex: 1, boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>

                <thead>
                    <tr style={{ background: '#f8fafc' }}>
                        <th style={{ ...thStyle, width: '180px' }}>Item (Maker)</th>
                        <th style={{ ...thStyle, width: '180px' }}>Category</th>
                        <th style={{ ...thStyle, width: '100px' }}>Power</th>
                        <th style={{ ...thStyle, width: '150px' }}>Barcode Scan</th>
                        <th style={{ ...thStyle, width: '120px' }}>Lot No</th>
                        <th style={{ ...thStyle, width: '60px' }}>SNO</th>
                        <th style={{ ...thStyle, width: '130px' }}>MFG</th>
                        <th style={{ ...thStyle, width: '130px' }}>EXP</th>
                        <th style={{ ...thStyle, width: '100px', textAlign: 'right' }}>Rate</th>
                        <th style={{ ...thStyle, width: '80px', textAlign: 'center' }}>Qty</th>
                        {(type === 'SALES_INVOICE' || type === 'TRANSFER') && <th style={{ ...thStyle, width: '80px', textAlign: 'center' }}>Stock In Hand</th>}
                        <th style={{ ...thStyle, width: '120px', textAlign: 'right' }}>Amount</th>
                        <th style={{ ...thStyle, width: '40px' }}></th>
                    </tr>
                </thead>
                <tbody>
                    {details.map((d, i) => (
                        <React.Fragment key={i}>
                            {d.lots.length === 0 ? (
                                <tr className="row-animate" style={{ borderTop: i > 0 ? '1px solid #f1f5f9' : 'none' }}>
                                    <td style={tdStyle}>
                                        <SearchableSelect
                                            options={makers.map(m => ({ value: m.id, label: m.name }))}
                                            value={d.maker_id}
                                            onChange={val => handleMakerOrCategoryChange(i, 'maker_id', val)}
                                            placeholder="-- Maker --"
                                        />
                                    </td>
                                    <td style={tdStyle}>
                                        <SearchableSelect
                                            options={(rowCategories[d.maker_id] || []).map(c => ({ value: c.id, label: c.name }))}
                                            value={d.category_id}
                                            onChange={val => handleMakerOrCategoryChange(i, 'category_id', val)}
                                            placeholder="-- Category --"
                                        />
                                    </td>
                                    <td style={tdStyle}>
                                        <SearchableSelect
                                            options={powers.map(p => ({ value: p.id, label: p.power }))}
                                            value={d.power_id}
                                            onChange={val => updateRow(i, 'power_id', val)}
                                            placeholder="P"
                                        />
                                    </td>
                                    <td style={tdStyle} colSpan={5}>
                                        <div style={{ background: '#f8fafc', padding: '8px 12px', borderRadius: 10, fontSize: '0.8rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: 8 }}>
                                            <Scan size={14} /> Scan item barcode to add lot...
                                            <input
                                                style={{ ...inputStyle, width: 200, padding: '4px 8px', fontSize: '0.75rem', height: 'auto', background: 'white' }}
                                                placeholder="Click & Scan..."
                                                onKeyDown={e => handleLotScanKeyDown(e, i)}
                                            />
                                        </div>
                                    </td>
                                    <td style={tdStyle}>
                                        <input type="number" value={d.rate} onChange={e => updateRow(i, 'rate', e.target.value)} style={{ ...inputStyle, textAlign: 'right', background: 'transparent' }} />
                                    </td>
                                    <td style={{ ...tdStyle, textAlign: 'center', fontWeight: 800 }}>--</td>
                                    {type === 'SALES_INVOICE' && <td style={{ ...tdStyle, textAlign: 'center', fontWeight: 800 }}>--</td>}
                                    <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 800 }}>0</td>

                                    <td style={tdStyle}>
                                        <button type="button" onClick={() => removeRow(i)} style={{ color: '#ef4444', background: 'none', border: 'none' }}><Trash2 size={16} /></button>
                                    </td>
                                </tr>
                            ) : d.lots.map((lot, li) => (
                                <tr key={`${i}-${li}`} className={`row-animate ${lot.id === highlightDetailId ? 'focused-row' : ''}`} style={{ borderTop: li === 0 && i !== 0 ? '1px solid #f1f5f9' : 'none' }}>
                                    {li === 0 && (
                                        <>
                                            <td rowSpan={d.lots.length} style={tdStyle}>
                                                <SearchableSelect
                                                    options={makers.map(m => ({ value: m.id, label: m.name }))}
                                                    value={d.maker_id}
                                                    onChange={val => handleMakerOrCategoryChange(i, 'maker_id', val)}
                                                    placeholder="-- Maker --"
                                                />
                                            </td>
                                            <td rowSpan={d.lots.length} style={tdStyle}>
                                                <SearchableSelect
                                                    options={(rowCategories[d.maker_id] || []).map(c => ({ value: c.id, label: c.name }))}
                                                    value={d.category_id}
                                                    onChange={val => handleMakerOrCategoryChange(i, 'category_id', val)}
                                                    placeholder="-- Category --"
                                                />
                                            </td>
                                            <td rowSpan={d.lots.length} style={tdStyle}>
                                                <SearchableSelect
                                                    options={powers.map(p => ({ value: p.id, label: p.power }))}
                                                    value={d.power_id}
                                                    onChange={val => updateRow(i, 'power_id', val)}
                                                    placeholder="P"
                                                />
                                            </td>
                                        </>
                                    )}
                                    <td style={tdStyle}>
                                        <div style={{ position: 'relative' }}>
                                            <input
                                                placeholder="Scan"
                                                onKeyDown={e => handleLotScanKeyDown(e, i, li)}
                                                style={{ ...inputStyle, background: '#f8fafc' }}
                                            />
                                            <div style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }}>
                                                <Scan size={14} />
                                            </div>
                                        </div>
                                    </td>
                                    <td style={tdStyle}>
                                        <div style={{ position: 'relative' }}>
                                            <input
                                                value={lot.lot_no || ''}
                                                onChange={e => updateNestedLot(i, li, 'lot_no', e.target.value)}
                                                style={{ ...inputStyle, fontWeight: 700, borderColor: lotErrors[`${i}-${li}`] ? '#ef4444' : '#e2e8f0' }}
                                                placeholder="LOT"
                                            />
                                            {lotErrors[`${i}-${li}`] && (
                                                <div style={{ position: 'absolute', top: '100%', left: 0, background: '#ef4444', color: 'white', fontSize: '0.6rem', padding: '2px 6px', borderRadius: 4, zIndex: 10, whiteSpace: 'nowrap' }}>
                                                    {lotErrors[`${i}-${li}`]}
                                                </div>
                                            )}
                                        </div>
                                    </td>
                                    <td style={tdStyle}>
                                        <input value={lot.sno || ''} onChange={e => updateNestedLot(i, li, 'sno', e.target.value)} style={{ ...inputStyle, textAlign: 'center' }} placeholder="0" />
                                    </td>
                                    <td style={tdStyle}><input type="date" value={lot.mfg_date} onChange={e => updateNestedLot(i, li, 'mfg_date', e.target.value)} style={inputStyle} /></td>
                                    <td style={tdStyle}><input type="date" value={lot.exp_date} onChange={e => updateNestedLot(i, li, 'exp_date', e.target.value)} style={inputStyle} /></td>

                                    
                                    {li === 0 && (
                                        <>
                                            <td rowSpan={d.lots.length} style={tdStyle}>
                                                <input
                                                    type="text"
                                                    step="1"
                                                    value={formatAmount(d.rate || 0)}
                                                    onChange={e => {
                                                        const raw = e.target.value.replace(/,/g, '');
                                                        updateRow(i, 'rate', raw);
                                                    }}
                                                    style={{ ...inputStyle, textAlign: 'right', fontWeight: 600 }}
                                                />
                                            </td>
                                            <td rowSpan={d.lots.length} style={{ ...tdStyle, textAlign: 'center', fontWeight: 800, color }}>
                                                {formatQty(d.total_qty)}
                                            </td>
                                            {(type === 'SALES_INVOICE' || type === 'SALES_RETURN' || type === 'TRANSFER') && (
                                                <td rowSpan={d.lots.length} style={{ ...tdStyle, textAlign: 'center', fontWeight: 800 }}>
                                                    {formatQty(d.qty_in_hand || 0)}
                                                </td>
                                            )}
                                            <td rowSpan={d.lots.length} style={{ ...tdStyle, textAlign: 'right', fontWeight: 800, color }}>
                                                {formatAmount(d.amount || 0)}
                                            </td>
                                            <td rowSpan={d.lots.length} style={tdStyle}>
                                                <button type="button" onClick={() => removeRow(i)} style={{ color: '#ef4444', background: 'none', border: 'none' }}><Trash2 size={16} /></button>
                                            </td>
                                        </>
                                    )}
                                </tr>
                            ))}
                        </React.Fragment>
                    ))}
                </tbody>
            </table>
            <div style={{ padding: '16px 20px', background: '#f8fafc', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'center' }}>
                <button type="button" onClick={addRow} className="btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Plus size={16} /> Add Another Item Row
                </button>
            </div>
        </div>
    );
};

export default NestedLotsTable;
