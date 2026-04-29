import React, { useState, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom';
import { formatAmount, formatQty } from '../../utils/numberUtils';
import axios from 'axios';
import {
    Plus, Save, Loader, Search, BookOpen, ShoppingCart, Repeat,
    Truck, FileText, RefreshCw, CheckCircle, AlertCircle
} from 'lucide-react';

import SalesInvoicePrint from './SalesInvoicePrint';
import SearchableSelect from '../common/SearchableSelect';
import FormHeader from './StockTransactionForm/FormHeader';
import DetailsTable from './StockTransactionForm/DetailsTable';
import { inputStyle, labelStyle } from './StockTransactionForm/styles';

const API = '/api/inventory';

const StockTransactionForm = ({ type, editId, detailId, currentUser, onClose, onSave, companyInfo, preloadData }) => {
    // ── CONFIG DATA ──
    const typeInfo = {
        'STOCK_OPENING': { label: 'Stock Opening Balance', icon: <BookOpen />, color: '#f97316', bg: '#fff7ed', endpoint: 'opening-balances' },
        'PURCHASE': { label: 'Stock Purchase', icon: <ShoppingCart />, color: '#2563eb', bg: '#eff6ff', endpoint: 'purchases' },
        'PURCHASE_RETURN': { label: 'Purchase Return', icon: <Repeat />, color: '#dc2626', bg: '#fef2f2', endpoint: 'purchase-returns' },
        'TRANSFER_REQUEST': { label: 'Stock Transfer Request', icon: <Truck />, color: '#7c3aed', bg: '#f5f3ff', endpoint: 'transfer-requests' },
        'TRANSFER': { label: 'Stock Transfer (Inter-Location)', icon: <Truck />, color: '#059669', bg: '#ecfdf5', endpoint: 'transfers' },
        'SALES_INVOICE': { label: 'Sales Invoice', icon: <FileText />, color: '#0891b2', bg: '#ecfeff', endpoint: 'sales' },
        'SALES_RETURN': { label: 'Sales Return', icon: <RefreshCw />, color: '#ea580c', bg: '#fff7ed', endpoint: 'sales-returns' }
    };
    const currentType = typeInfo[type] || typeInfo['PURCHASE'];
    const { label, icon, color, endpoint } = currentType;
    const accent = `${color}dd`;
    const bgColor = currentType.bg;

    // ── STATE ──
    const [makers, setMakers] = useState([]);
    const [powers, setPowers] = useState([]);
    const [suppliers, setSuppliers] = useState([]);
    const [customers, setCustomers] = useState([]);
    const [locations, setLocations] = useState([]);
    const [transferRequests, setTransferRequests] = useState([]);
    const [selectedRequest, setSelectedRequest] = useState(null);
    const [validationError, setValidationError] = useState(null);
    const [qtyError, setQtyError] = useState(false);
    const [rowCategories, setRowCategories] = useState({});
    const [lotErrors, setLotErrors] = useState({});
    const [isClosing, setIsClosing] = useState(false);
    const [showPrintId, setShowPrintId] = useState(null);
    const [isSaving, setIsSaving] = useState(false);
    const [successMessage, setSuccessMessage] = useState(null);
    const [salesRates, setSalesRates] = useState({ a_rates: [], b_rates: [] });

    const [header, setHeader] = useState({
        trans_no: '',
        trans_date: new Date().toISOString().split('T')[0],
        supplier_id: '',
        customer_id: '',
        from_location_id: currentUser.location_id,
        to_location_id: '',
        total_amount: 0,
        total_qty: 0,
        transfer_request_id: '',
    });

    const isRequestType = type === 'TRANSFER_REQUEST';
    const isOutgoing = ['SALES_INVOICE', 'TRANSFER', 'PURCHASE_RETURN', 'TRANSFER_REQUEST', 'SALES_RETURN'].includes(type);

    const [details, setDetails] = useState([{
        maker_id: '', category_id: '', power_id: '',
        stock_required: 0,
        stock_received: 0,
        lot_no: '', sno: '0', mfg_date: '', exp_date: '', qty: 0, rate: 0, p_rate: '', amount: 0, qty_in_hand: 0,
        qty_sold: 0
    }]);

    const [rowMeta, setRowMeta] = useState({ 0: { scanRaw: '', autoFilled: false, checking: false, lotError: null } });
    const inputRefs = useRef({});
    const dateInputRef = useRef(null);

    // ── DATA FETCHING ──
    useEffect(() => {
        const fetchMasters = async () => {
            try {
                const [m, p, s, c, l] = await Promise.all([
                    axios.get(`${API}/makers`),
                    axios.get(`${API}/powers`),
                    axios.get(`${API}/suppliers`),
                    axios.get(`${API}/customers`),
                    axios.get('/api/locations')
                ]);
                setMakers(m.data || []);
                setPowers(p.data || []);
                setSuppliers(s.data || []);
                setCustomers(c.data || []);
                setLocations(l.data || []);

                if (type === 'SALES_INVOICE') {
                    const sr = await axios.get(`${API}/sales-invoice-rates`);
                    setSalesRates(sr.data || { a_rates: [], b_rates: [] });
                }

                if (editId) fetchRecord(editId);
                if (type === 'TRANSFER') fetchTransferRequests();

                // --- INITIAL FOCUS ---
                setTimeout(() => {
                    if (['PURCHASE', 'PURCHASE_RETURN', 'SALES_INVOICE', 'SALES_RETURN'].includes(type)) {
                        if (inputRefs.current['header-party']) inputRefs.current['header-party'].focus();
                    } else if (['TRANSFER', 'TRANSFER_REQUEST'].includes(type)) {
                        if (inputRefs.current['header-location']) inputRefs.current['header-location'].focus();
                    } else {
                        // Stock Opening or other
                        if (inputRefs.current['maker-0']) inputRefs.current['maker-0'].focus();
                    }
                }, 500);

            } catch (e) { console.error('Masters load error:', e); }
        };
        fetchMasters();
    }, [editId]);

    // ── FETCH NEXT TRANSACTION NO (New Records Only) ──
    const fetchNextNo = async () => {
        if (!editId && currentUser?.location_id && currentUser?.fiscal_year_id) {
            try {
                const { data } = await axios.get(`${API}/next-no`, {
                    params: { 
                        type, 
                        location_id: currentUser.location_id, 
                        fiscal_year_id: currentUser.fiscal_year_id 
                    }
                });
                setHeader(prev => ({ ...prev, trans_no: data.trans_no }));
            } catch (err) {
                console.error('Next-No Fetch Error:', err);
            }
        }
    };

    useEffect(() => {
        fetchNextNo();
    }, [editId, type, currentUser]);

    const fetchRecord = async (id) => {
        try {
            const { data } = await axios.get(`${API}/${endpoint}/${id}`);
            const h = { ...data };
            h.trans_date = h.trans_date ? h.trans_date.substring(0, 10) : new Date().toISOString().substring(0, 10);
            setHeader(h);

            const rows = data.details || [];
            const newDetails = rows.map(r => ({ 
                ...r, 
                reqTransNo: r.stock_req, // Map source Transaction ID for grouping
                stock_received: r.stock_received || 0,
                mfg_date: r.mfg_date ? r.mfg_date.substring(0, 10) : '', 
                exp_date: r.exp_date ? r.exp_date.substring(0, 10) : '' 
            })).sort((a, b) => (b.reqTransNo || '').localeCompare(a.reqTransNo || ''));
            setDetails(newDetails);

            // Prefetch categories for each maker in the form
            const uniqueMakers = [...new Set(newDetails.map(r => r.maker_id))];
            uniqueMakers.forEach(mId => {
                if (mId) axios.get(`${API}/categories?maker_id=${mId}`).then(res => setRowCategories(prev => ({ ...prev, [mId]: res.data })));
            });
        } catch (e) { console.error('Fetch record error:', e); }
    };

    // ── PRELOAD DATA EFFECT ──
    useEffect(() => {
        if (preloadData && preloadData._timestamp && type === 'TRANSFER' && !editId) {
            setHeader(prev => ({
                ...prev,
                to_location_id: preloadData.toLocationId,
                from_location_id: currentUser.location_id,
                transfer_request_id: preloadData.requestIds ? preloadData.requestIds.join(',') : '',
            }));
            
            const preloadedDetails = preloadData.items.map(it => ({
                maker_id: it.maker_id,
                category_id: it.category_id,
                power_id: it.power_id,
                reqTransNo: it.reqTransNo, // Preserve source Trans ID for grouping
                stock_required: it.stock_received || it.qty || 0, // Mapping Request Stock to Stock Required
                qty: 1, 
                rate: 0,
                amount: 0,
                qty_in_hand: 0,
                lot_no: '',
                sno: '0',
                mfg_date: '',
                exp_date: '',
                qty_sold: 0
            })).sort((a, b) => (b.reqTransNo || '').localeCompare(a.reqTransNo || ''));
            setDetails(preloadedDetails);
            
            const makers = [...new Set(preloadedDetails.map(d => d.maker_id))];
            makers.forEach(mId => {
                if (mId) axios.get(`${API}/categories?maker_id=${mId}`).then(res => setRowCategories(prev => ({ ...prev, [mId]: res.data })));
            });
            
            preloadedDetails.forEach((row, idx) => triggerStockInHandCalculation(idx, row));

            // Auto-focus on first row barcode field for immediate scanning
            setTimeout(() => {
                if (inputRefs.current && inputRefs.current['barcode-0']) {
                    inputRefs.current['barcode-0'].focus();
                }
            }, 800);
        }
    }, [preloadData, type, editId]);

    const fetchTransferRequests = async () => {
        try {
            const { data } = await axios.get(`${API}/transfer-requests`);
            setTransferRequests(data.filter(r => r.status === 'PENDING' && r.to_location_id === currentUser.location_id));
        } catch (e) { console.error(e); }
    };

    // ── HANDLERS ──
    const handleMakerOrCategoryChange = async (idx, field, val) => {
        const newDetails = [...details];
        newDetails[idx][field] = val;
        
        if (field === 'maker_id' && val) {
            const { data } = await axios.get(`${API}/categories?maker_id=${val}`);
            setRowCategories(prev => ({ ...prev, [val]: data }));
            newDetails[idx].category_id = ''; // Reset category
        }

        if (field === 'category_id' && val && type === 'SALES_INVOICE') {
            try {
                const { data } = await axios.get(`${API}/get-category-rate/${val}`);
                if (data && data.rate !== undefined) {
                    newDetails[idx].rate = data.rate;
                    newDetails[idx].amount = Math.round(parseFloat(newDetails[idx].qty || 0) * parseFloat(data.rate));
                    calculateTotals(newDetails);
                }
            } catch (err) {
                console.error("Error fetching category rate:", err);
            }
        }

        const shouldFetchStock = (type !== 'STOCK_OPENING') && (field === 'maker_id' || field === 'category_id');
        if (shouldFetchStock) {
            const { maker_id, category_id, power_id } = newDetails[idx];
            if (maker_id && category_id && power_id) {
                axios.get(`${API}/stock-balance`, {
                    params: { maker_id, category_id, power_id, location_id: header.from_location_id || header.location_id, fiscal_year_id: currentUser.fiscal_year_id }
                }).then(({ data }) => {
                    const latest = [...details];
                    latest[idx].qty_in_hand = data.balance;
                    setDetails(latest);
                });
            }
        }
        setDetails(newDetails);
    };

    const updateRow = (idx, field, val) => {
        const newDetails = [...details];
        
        if (field === 'qty') {
            const row = newDetails[idx];
            // Block quantity update if Lot/SNo is missing for Sales Invoice/Return
            if ((type === 'SALES_INVOICE' || type === 'SALES_RETURN') && (!row.lot_no || !row.sno || row.sno === '0')) {
                alert("Please scan barcode or enter Lot/SNo before entering quantity.");
                return;
            }
            const cleanVal = val === '' ? '' : Math.floor(Math.max(0, parseFloat(val || 0)));
            newDetails[idx].qty = cleanVal;
            const r = parseFloat(newDetails[idx].rate || 0);
            newDetails[idx].amount = Math.round((parseFloat(cleanVal) || 0) * r);
        } else {
            newDetails[idx][field] = val;
            if (field === 'rate') {
                const q = parseFloat(newDetails[idx].qty || 0);
                const r = val === '' ? '' : parseFloat(val || 0);
                newDetails[idx].rate = r;
                newDetails[idx].amount = Math.round(q * (parseFloat(r) || 0));
            }
            if (field === 'amount') {
                newDetails[idx].amount = val === '' ? '' : parseFloat(val || 0);
            }
        }

        if (['maker_id', 'category_id', 'power_id'].includes(field)) {
            triggerStockInHandCalculation(idx, newDetails[idx]);
        }

        setDetails(newDetails);
        calculateTotals(newDetails);
    };

    const triggerStockInHandCalculation = (idx, rowData) => {
        if (type === 'TRANSFER_REQUEST') return; // REMOVE Stock In Hand logic for TRQ
        const { maker_id, category_id, power_id } = rowData;
        if (type !== 'STOCK_OPENING' && maker_id && category_id) {
            axios.get(`${API}/stock-balance`, {
                params: {
                    maker_id, category_id, power_id: power_id || '',
                    location_id: header.from_location_id || header.location_id,
                    fiscal_year_id: currentUser.fiscal_year_id
                }
            }).then(({ data }) => {
                setDetails(prev => {
                    const next = [...prev];
                    if (next[idx]) next[idx].qty_in_hand = data.balance;
                    return next;
                });
            });
        }
    };

    const addRow = (idx) => {
        const actualIdx = (typeof idx === 'number') ? idx : undefined;
        setDetails(prev => {
            const sourceRow = actualIdx !== undefined ? prev[actualIdx] : prev[prev.length - 1];
            // Block new row if current row lacks Lot/SNo for Sales
            if ((type === 'SALES_INVOICE' || type === 'SALES_RETURN') && sourceRow && (!sourceRow.lot_no || !sourceRow.sno || sourceRow.sno === '0')) {
                alert("Current row must have Lot No and SNo before adding another row.");
                return prev;
            }
            const lastRow = sourceRow || {};
            const newRow = { 
                maker_id: lastRow.maker_id || '', 
                category_id: lastRow.category_id || '', 
                power_id: lastRow.power_id || '', 
                reqTransNo: lastRow.reqTransNo || null,
                stock_required: lastRow.stock_required || 0,
                stock_received: lastRow.stock_received || 0,
                lot_no: '', sno: '0', qty: 0, rate: 0, amount: 0, qty_in_hand: 0 
            };
            const next = [...prev];
            if (idx !== undefined) {
                next.splice(idx + 1, 0, newRow);
            } else {
                next.push(newRow);
            }
            return next;
        });

        if (idx !== undefined) {
             setRowMeta(prev => {
                 const newMeta = {};
                 // Shift all metadata by 1 after idx
                 Object.keys(prev).forEach(key => {
                     const k = parseInt(key);
                     if (k > idx) newMeta[k + 1] = prev[k];
                     else newMeta[k] = prev[k];
                 });
                 newMeta[idx + 1] = { scanRaw: '', autoFilled: false };
                 return newMeta;
             });
        }
    };

    const removeRow = (idx) => {
        if (details.length === 1) return;
        const newDetails = details.filter((_, i) => i !== idx);
        setDetails(newDetails);
        calculateTotals(newDetails);
    };

    const calculateTotals = (rows) => {
        let totalQty = 0, totalAmount = 0;
        rows.forEach(r => {
            totalQty += parseFloat(r.qty || 0);
            totalAmount += parseFloat(r.amount || 0);
        });
        setHeader(prev => ({ ...prev, total_qty: totalQty, total_amount: Math.round(totalAmount) }));
    };


    /**
     * @description Completely rewritten barcode matching engine. 
     * Uses ONLY the manual Barcode Setup table.
     */
    const executeBarcodeLookup = async (idx, barcodeValue) => {
        const val = barcodeValue.trim();
        if (!val) return;

        const makerId = details[idx].maker_id;
        const makerName = makers.find(m => m.id === Number(makerId))?.name || '';
        console.log(`[BarcodeScan] Row ${idx} | Maker: ${makerName || 'Searching All Masters'} | Barcode: ${val}`);

        try {
            const { data } = await axios.get(`${API}/barcode-lookup`, { 
                params: { barcode: val, maker: makerName } 
            });

            if (data.found) {
                const foundLot = data.lot_no || '';
                const foundSno = data.sno || '0';

                // --- REAL-TIME DUPLICATE CHECK ---
                if (foundSno !== '0' && foundSno !== '') {
                    // 1. Check current form locally
                    const isLocalDuplicate = details.some((row, i) => i !== idx && row.lot_no === foundLot && row.sno === foundSno);
                    if (isLocalDuplicate) {
                        alert(`Duplicate Scan: Lot #${foundLot} / SNo #${foundSno} is already added in this transaction.`);
                        setDetails(prev => {
                            const next = [...prev];
                            next[idx].barcode = ''; // Clear scanner
                            return next;
                        });
                        return;
                    }

                    // 2. Check Global Database (Only for Purchases and Stock Opening - Type Specific)
                    if (['PURCHASE', 'STOCK_OPENING'].includes(type)) {
                        try {
                            const { data: globalCheck } = await axios.get(`${API}/check-duplicate-item`, {
                                params: { lot_no: foundLot, sno: foundSno, type }
                            });
                            if (globalCheck.exists) {
                                alert(`Serial Conflict: Item (Lot #${foundLot} / SNo #${foundSno}) was already entered in ${globalCheck.trans_no}. Process blocked.`);
                                setDetails(prev => {
                                    const next = [...prev];
                                    next[idx].barcode = ''; // Clear scanner
                                    return next;
                                });
                                return;
                            }
                        } catch (err) { console.error("Global duplicate check failed", err); }
                    }
                }

                const newDetails = [...details];
                
                // If Maker name came back, try to match it (helps if no maker was selected yet)
                let finalMakerId = makerId;
                if (data.maker) {
                    const m = makers.find(mk => mk.name.toUpperCase() === data.maker.toUpperCase());
                    if (m) finalMakerId = m.id;
                }

                newDetails[idx] = { 
                    ...newDetails[idx], 
                    barcode: '', // Clear the scanner field after successful capture
                    maker_id: finalMakerId,
                    lot_no: foundLot, 
                    sno: foundSno, 
                    qty: 1, // SET QTY TO 1 UPON SUCCESSFUL SCAN
                    exp_date: data.exp_date ? data.exp_date.split('T')[0] : '', 
                    mfg_date: data.mfg_date ? data.mfg_date.split('T')[0] : '' 
                };

                // Auto-fetch categories if maker changed
                if (finalMakerId && finalMakerId !== makerId) {
                    axios.get(`${API}/categories?maker_id=${finalMakerId}`)
                        .then(res => setRowCategories(prev => ({ ...prev, [finalMakerId]: res.data })));
                }

                // Update Row Volume/Amount
                newDetails[idx].amount = Math.round(parseFloat(newDetails[idx].qty || 0) * parseFloat(newDetails[idx].rate || 0));
                
                // Set metadata flag
                setRowMeta(prev => ({ ...prev, [idx]: { ...prev[idx], autoFilled: true } }));
                
                setDetails(newDetails);
                calculateTotals(newDetails);
                
                // --- SMART AUTOMATION: ROW COMPLETION ---
                handleBarcodeComplete(idx, newDetails);

                // Fetch Stock balance (Only if NOT a Transfer Request)
                if (type !== 'TRANSFER_REQUEST') {
                    const { category_id, power_id } = newDetails[idx];
                if (finalMakerId && category_id && power_id) {
                    const { data: balData } = await axios.get(`${API}/stock-balance`, {
                        params: { 
                            maker_id: finalMakerId, 
                            category_id, 
                            power_id, 
                            location_id: header.from_location_id || header.location_id, 
                            fiscal_year_id: currentUser.fiscal_year_id 
                        }
                    });
                    setDetails(prev => {
                        const d = [...prev];
                        d[idx].qty_in_hand = balData.balance;
                        return d;
                    });
                }
                }
            }
        } catch (err) {
            console.error("[Barcode] Lookup Error:", err);
        }
    };

    const handleScanKeyDown = (e, i) => {
        if (e.key === 'Enter' || e.key === 'Tab') {
            e.preventDefault();
            const val = e.target.value.trim();
            executeBarcodeLookup(i, val);
        }
    };

    const moveToNextField = (idx, currentField) => {
        // Special case: Header fields move to First Row
        if (currentField === 'header-party' || currentField === 'header-location') {
            const fieldToFocus = type === 'SALES_RETURN' ? `barcode-0` : `maker-0`;
            if (inputRefs.current[fieldToFocus]) {
                inputRefs.current[fieldToFocus].focus();
            }
            return;
        }

        const sequence = ['maker', 'category', 'power', 'barcode', 'qty'];
        let nextField = '';

        if (currentField === 'maker') nextField = (type === 'SALES_INVOICE' || type === 'SALES_RETURN') ? 'barcode' : 'category';
        else if (currentField === 'category') nextField = 'power';
        else if (currentField === 'power') {
            // For TRQ, barcode field doesn't exist
            nextField = isRequestType ? 'qty' : 'barcode';
        } else if (currentField === 'barcode') {
            nextField = 'qty';
        } else if (currentField === 'qty') {
            // End of row logic handled in handleQtyKeyDown
            return;
        }

        if (nextField && inputRefs.current[`${nextField}-${idx}`]) {
            setTimeout(() => {
                inputRefs.current[`${nextField}-${idx}`].focus();
            }, 50);
        }
    };

    const handleQtyKeyDown = (e, i) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            if (i === details.length - 1) {
                addRow();
                // Focusing new row after creation is handled in addNewRowWithDefaults
            } else {
                // Move to Maker of next row
                if (inputRefs.current[`maker-${i + 1}`]) {
                    inputRefs.current[`maker-${i + 1}`].focus();
                }
            }
        }
    };

    const handleManualScan = (idx) => {
        const val = details[idx].barcode || details[idx].lot_no;
        if (val) executeBarcodeLookup(idx, val);
    };

    const enrichDataFromLotNo = async (lotNo, idx, passedSno = null) => {
        const enrichmentTypes = ['PURCHASE_RETURN', 'TRANSFER', 'SALES_INVOICE', 'SALES_RETURN'];
        if (!enrichmentTypes.includes(type) || !lotNo) return;
        try {
            const currentSno = passedSno !== null ? passedSno : (details[idx]?.sno || '');
            const { data } = await axios.get(`${API}/lookup-lot/${lotNo}`, {
                params: { sno: currentSno, type }
            });

            if (data && data.category_id) {
                setDetails(prev => {
                    const next = [...prev];
                    if (!next[idx]) return prev;
                    
                    const enrichedRow = { 
                        ...next[idx], 
                        maker_id: data.maker_id || next[idx].maker_id,
                        category_id: data.category_id, 
                        power_id: data.power_id || '',
                        exp_date: data.exp_date ? data.exp_date.split('T')[0] : '',
                        mfg_date: data.mfg_date ? data.mfg_date.split('T')[0] : '',
                        qty: (type === 'SALES_RETURN' && data.qty) ? data.qty : next[idx].qty,
                        rate: (type === 'SALES_INVOICE' && parseFloat(next[idx].rate || 0) > 0) ? next[idx].rate : (data.rate || next[idx].rate),
                        p_rate: data.p_rate || next[idx].p_rate
                    };
                    
                    if (enrichedRow.rate) {
                        enrichedRow.amount = Math.round(parseFloat(enrichedRow.qty || 0) * parseFloat(enrichedRow.rate));
                    }
                    
                    next[idx] = enrichedRow;
                    calculateTotals(next);
                    if (['PURCHASE_RETURN', 'TRANSFER', 'SALES_INVOICE', 'SALES_RETURN'].includes(type)) {
                        triggerStockInHandCalculation(idx, enrichedRow);
                    }
                    return next;
                });
                
                const makerId = data.maker_id || details[idx]?.maker_id;
                if (makerId) {
                    axios.get(`${API}/categories?maker_id=${makerId}`)
                        .then(res => setRowCategories(prev => ({ ...prev, [makerId]: res.data })));
                }
            }
        } catch (e) { console.warn("[Enrichment] No match found for lot:", lotNo); }
    };

    const handleBarcodeComplete = (idx, currentDetails) => {
        const row = currentDetails[idx];
        
        // --- ENRICHMENT FOR EXISTING LOTS (Sales, Transfers, Returns) ---
        const enrichmentTypes = ['PURCHASE_RETURN', 'TRANSFER', 'SALES_INVOICE', 'SALES_RETURN'];
        if (enrichmentTypes.includes(type) && row.lot_no) {
            enrichDataFromLotNo(row.lot_no, idx, row.sno);
        }

        // --- NEW: Dynamic Expansion for Stock Transfer (Inter-Location) ---
        if (type === 'TRANSFER' && row.reqTransNo && row.lot_no) {
             const groupKey = `${row.reqTransNo}-${row.maker_id}-${row.category_id}-${row.power_id}`;
             const groupItems = currentDetails.filter(d => `${d.reqTransNo}-${d.maker_id}-${d.category_id}-${d.power_id}` === groupKey);
             const totalQty = groupItems.reduce((sum, item) => sum + parseFloat(item.qty || 0), 0);
             const stockReq = parseFloat(row.stock_received || row.stock_required || 0);

             if (totalQty < stockReq) {
                 const newRow = { 
                    ...row, 
                    barcode: '', sno: '0', qty: 0, lot_no: '',
                    mfg_date: '', exp_date: '', qty_in_hand: 0 
                 };
                 setDetails(prev => {
                     const next = [...prev];
                     next.splice(idx + 1, 0, newRow);
                     return next;
                 });
                 // Auto focus new barcode field
                 setTimeout(() => {
                     if (inputRefs.current[`barcode-${idx+1}`]) {
                         inputRefs.current[`barcode-${idx+1}`].focus();
                     }
                 }, 200);
                 return; // Expansion handled, stop further row logic
             } else {
                 // Requirement met, stop further row logic even if it's the last row
                 return;
             }
        }

        // Check if row has necessary fields from scan (Maker and at least one other like Lot or Date)
        if (row.maker_id && (row.lot_no || row.exp_date)) {
            // Debounce/Event check: Only add if this is the last row
            if (idx === currentDetails.length - 1) {
                setTimeout(() => addNewRowWithDefaults(idx), 100);
            }
        }
    };

    const addNewRowWithDefaults = (prevIdx) => {
        setDetails(prev => {
            const sourceRow = prev[prevIdx];
            const lastRow = sourceRow || {};
            const newRow = {
                maker_id: lastRow.maker_id || '',
                category_id: lastRow.category_id || '',
                power_id: lastRow.power_id || '', 
                lot_no: '', sno: '0', mfg_date: '', exp_date: '', 
                qty: 0, rate: 0, p_rate: '', amount: 0, qty_in_hand: 0, qty_sold: 0
            };
            const updated = [...prev, newRow];
            
            // AUTO FOCUS POWER FIELD if no power was selected, otherwise focus scan/barcode
            setTimeout(() => {
                const nextIdx = updated.length - 1;
                const fieldToFocus = newRow.power_id ? (isRequestType ? `qty-${nextIdx}` : `barcode-${nextIdx}`) : `power-${nextIdx}`;
                if (inputRefs.current[fieldToFocus]) {
                    inputRefs.current[fieldToFocus].focus();
                }
            }, 150);

            // Trigger stock check for the new row immediately
            if (newRow.maker_id && newRow.category_id) {
                triggerStockInHandCalculation(updated.length - 1, newRow);
            }

            return updated;
        });
        
        setRowMeta(prev => ({ 
            ...prev, 
            [prevIdx + 1]: { scanRaw: '', autoFilled: false, checking: false, lotError: null } 
        }));
    };

    const handleSubmit = async (e) => {
        if (e) e.preventDefault();
        
        // --- VALIDATION FOR TRANSFER REQUESTS ---
        if (type === 'TRANSFER_REQUEST' && !header.to_location_id) {
            alert("Please select a Target Location for the transfer request.");
            return;
        }

        setIsSaving(true);
        try {
            // -- DUPLICATE LOT & SNO VALIDATION --
            const seenPairs = new Set();
            for (let i = 0; i < details.length; i++) {
                const row = details[i];
                if (row.lot_no && row.maker_id) {
                    const key = `${row.lot_no.trim().toUpperCase()}|${(row.sno || '0').trim().toUpperCase()}`;
                    if (seenPairs.has(key)) {
                        alert(`Duplicate Item Detected: Lot #${row.lot_no} and SNo #${row.sno || '0'} is already entered in another row.`);
                        setIsSaving(false); 
                        return;
                    }
                    seenPairs.add(key);
                }
            }

            // -- VALDIATION FOR OUTGOING TRANSACTIONS --
            if (isOutgoing) {
                for (let i = 0; i < details.length; i++) {
                    const row = details[i];
                    
                    if (type === 'SALES_INVOICE') {
                        if (!row.lot_no || !row.lot_no.trim()) {
                            alert(`Row ${i + 1}: Lot No is mandatory for Sales Invoice.`);
                            setIsSaving(false); return;
                        }
                        if (!row.sno || !row.sno.trim() || row.sno === '0') {
                            alert(`Row ${i + 1}: SNo is mandatory for Sales Invoice.`);
                            setIsSaving(false); return;
                        }
                    }

                    if (!row.qty || row.qty <= 0) {
                        alert(`Row ${i + 1}: Quantity must be greater than 0.`);
                        setIsSaving(false); return;
                    }
                    if (type !== 'TRANSFER_REQUEST' && parseFloat(row.qty) > parseFloat(row.qty_in_hand || 0)) {
                        const mName = makers.find(m => m.id === row.maker_id)?.name || 'Item';
                        alert(`Row ${i + 1} (${mName}): Requested quantity exceeds available stock (${row.qty_in_hand || 0}).`);
                        setIsSaving(false); return;
                    }
                    // Date Validation
                    if (row.exp_date && row.mfg_date && row.exp_date <= row.mfg_date) {
                        alert(`Row ${i + 1}: Expiry Date must be greater than Manufacturing Date.`);
                        setIsSaving(false); return;
                    }
                }
            }

            const payload = { 
                ...header, 
                location_id: currentUser.location_id,
                fiscal_year_id: currentUser.fiscal_year_id,
                user_id: currentUser.id,
                details: details.filter(d => d.maker_id && d.category_id) 
            };

            const method = editId ? 'put' : 'post';
            const url = editId ? `${API}/${endpoint}/${editId}` : `${API}/${endpoint}`;
            const { data } = await axios[method](url, payload);

            if (data.success) {
                setSuccessMessage(editId ? 'Updated Successfully!' : 'Posted Successfully!');
                if (!editId) {
                    resetForm();
                    // After reset, immediately fetch next serial
                    fetchNextNo();
                }
                if (onSave) onSave(true);
                setTimeout(() => setSuccessMessage(null), 3000);
            }
        } catch (e) {
            console.error('Save Error:', e);
            alert(e.response?.data?.error || 'Error saving transaction');
        } finally { setIsSaving(false); }
    };


    const resetForm = () => {
        setHeader(prev => ({ ...prev, trans_no: '', total_amount: 0, total_qty: 0 }));
        if (isRequestType) {
            setDetails([{ maker_id: '', category_id: '', power_id: '', qty: 0, qty_in_hand: 0, stock_received: 0 }]);
        } else {
            setDetails([{ maker_id: '', category_id: '', power_id: '', lot_no: '', sno: '0', mfg_date: '', exp_date: '', qty: 0, rate: 0, p_rate: '', amount: 0, qty_in_hand: 0, stock_required: 0 }]);
        }
    };

    const modal = (
        <div className={`modal-overlay ${isClosing ? 'closing' : ''}`} style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.4)', backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 99999, padding: 24 }}>
            <div className="modal-card" style={{ background: 'white', borderRadius: 24, width: '98%', maxWidth: 1800, height: '94vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 50px 100px -20px rgba(0,0,0,0.25)' }}>

                <FormHeader label={label} icon={icon} color={color} accent={accent} bgColor={bgColor} currentUser={currentUser} onClose={() => { setIsClosing(true); setTimeout(onClose, 300); }} />
                
                <form 
                    onSubmit={handleSubmit} 
                    onKeyDown={(e) => { if (e.key === 'Enter' && e.target.tagName !== 'TEXTAREA' && e.target.type !== 'submit') e.preventDefault(); }}
                    style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}
                >
                    <div style={{ flex: 1, overflowY: 'auto', padding: '32px 40px' }}>
                        
                        {/* Status Messages */}
                        {successMessage && <div className="success-overlay"><CheckCircle size={20} /> {successMessage}</div>}
                        

                        {/* Header Fields Grid */}
                        <div className="header-fields-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 20, marginBottom: 28 }}>
                             <div>
                                <label style={labelStyle}>Trans #</label>
                                <input 
                                    type="text" 
                                    value={header.trans_no || (() => {
                                        const p = {
                                            'STOCK_OPENING': 'OB', 'PURCHASE': 'PUR', 'PURCHASE_RETURN': 'PRT',
                                            'SALES_INVOICE': 'SLE', 'SALES_RETURN': 'SRT', 'TRANSFER': 'TRN', 'TRANSFER_REQUEST': 'TRQ'
                                        }[type] || '???';
                                        const loc = currentUser?.location_code || (currentUser?.location_name ? currentUser.location_name.substring(0, 3).toUpperCase() : '...');
                                        const fy = currentUser?.fiscal_year_label || '....';
                                        return `${p}/${loc}/${fy}/....`;
                                    })()} 
                                    readOnly 
                                    style={{ ...inputStyle, background: '#f8fafc', fontWeight: 700, color: '#0284c7' }} 
                                />
                            </div>

                            <div>
                                <label style={labelStyle}>Date</label>
                                <input type="date" value={header.trans_date} onChange={e => setHeader({ ...header, trans_date: e.target.value })} style={inputStyle} required />
                            </div>
                            
                            {(type === 'PURCHASE' || type === 'PURCHASE_RETURN') && (
                                <div>
                                    <label style={labelStyle}>Supplier / Vendor</label>
                                    <SearchableSelect 
                                        ref={el => inputRefs.current['header-party'] = el}
                                        options={suppliers.map(s => ({ value: s.id, label: s.name }))} 
                                        value={header.supplier_id} 
                                        onChange={val => setHeader({ ...header, supplier_id: val })} 
                                        onEnter={() => moveToNextField(0, 'header-party')}
                                        placeholder="Select Vendor" 
                                    />
                                </div>
                            )}

                            {(type === 'SALES_INVOICE' || type === 'SALES_RETURN') && (
                                <div>
                                    <label style={labelStyle}>Customer</label>
                                    <SearchableSelect 
                                        ref={el => inputRefs.current['header-party'] = el}
                                        options={customers.map(c => ({ value: c.id, label: c.name }))} 
                                        value={header.customer_id} 
                                        onChange={val => {
                                            setHeader({ ...header, customer_id: val });
                                            if (type === 'SALES_RETURN') {
                                                setTimeout(() => {
                                                    if (inputRefs.current['barcode-0']) inputRefs.current['barcode-0'].focus();
                                                }, 100);
                                            }
                                        }} 
                                        onEnter={() => moveToNextField(0, 'header-party')}
                                        placeholder="Select Customer" 
                                        noOptionsMessage="No customers found for this location"
                                    />
                                </div>
                            )}

                            {(type === 'TRANSFER' || type === 'TRANSFER_REQUEST') && (
                                <div>
                                    <label style={labelStyle}>To Branch Location</label>
                                     <SearchableSelect 
                                        ref={el => inputRefs.current['header-location'] = el}
                                        options={(locations || []).filter(l => l.id !== currentUser.location_id).map(l => ({ value: l.id, label: l.name }))} 
                                        value={header.to_location_id} 
                                        onChange={val => setHeader({ ...header, to_location_id: val })} 
                                        onEnter={() => moveToNextField(0, 'header-location')}
                                        placeholder="Target Location" 
                                        disabled={!!preloadData}
                                    />
                                </div>
                            )}
                        </div>

                        {/* Details Table */}
                        <DetailsTable {...{ 
                            details, makers, rowCategories, powers, rowMeta, salesRates,
                            handleMakerOrCategoryChange, updateRow, removeRow, addRow, 
                            handleScanKeyDown, handleQtyKeyDown, handleManualScan,
                            highlightDetailId: detailId, type, refs: inputRefs,
                            moveToNextField
                        }} />
                    </div>

                    {/* Footer / Summary */}
                    <div style={{ padding: '24px 40px', background: '#f8fafc', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ display: 'flex', gap: 40 }}>
                            <div className="stat-pill">Total Items: <strong>{formatQty(header.total_qty)}</strong></div>
                            {!isRequestType && (
                                <div className="stat-pill">Grand Total: <strong>PKR {formatAmount(header.total_amount || 0)}</strong></div>
                            )}
                        </div>

                        <button type="submit" disabled={isSaving} className="btn-primary" style={{ background: `linear-gradient(135deg, ${color}, ${accent})`, padding: '14px 40px' }}>
                            {isSaving ? <Loader size={18} className="spin" /> : <Save size={18} />}
                            {isSaving ? 'Saving...' : (editId ? 'Update Record' : 'Post Transaction')}
                        </button>
                    </div>
                </form>
            </div>
            <style>{`
                .modal-overlay { animation: fadeIn 0.3s ease-out; }
                .success-overlay { position: fixed; top: 100px; left: 50%; transform: translateX(-50%); background: #22c55e; color: white; padding: 12px 30px; border-radius: 50px; z-index: 100; box-shadow: 0 10px 20px rgba(34,197,94,0.3); display: flex; align-items: center; gap: 8px; font-weight: 800; }
                .stat-pill { font-size: 0.9rem; color: #64748b; }
                .stat-pill strong { color: #1e293b; font-size: 1.1rem; margin-left: 8px; }
                @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
                .spin { animation: spin 1s linear infinite; }
                @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
                @keyframes highlightPulse {
                    0% { background-color: transparent; }
                    50% { background-color: #fff7ed; outline: 2px solid #f97316; }
                    100% { background-color: transparent; }
                }
                .focused-row { animation: highlightPulse 2s ease-in-out infinite; }
            `}</style>
        </div>
    );

    return ReactDOM.createPortal(modal, document.body);
};

export default StockTransactionForm;
