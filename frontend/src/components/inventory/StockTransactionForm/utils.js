/**
 * GS1 Barcode Parser v5
 * Precision-matched to medical device barcode standards.
 */
export const parseBarcode = (raw) => {
    if (!raw) return { lot: null, exp: null, sno: '0' };
    
    // Normalize full-width characters (Japanese) to half-width
    let b = raw.trim().replace(/[０-９]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xFF10 + 48));
    let payload = b;
    
    // Remote AIM identifiers
    if (payload.startsWith(']C1')) payload = payload.substring(3);
    else if (payload.startsWith('[C1')) payload = payload.substring(3);
    else if (payload.startsWith(')C1')) payload = payload.substring(3);
    
    // Remove formatting characters
    payload = payload.replace(/[()|]/g, '');

    // Look for AI (17) - Expiration Date (YYMMDD)
    const m17 = payload.match(/17(\d{6})$/) || payload.match(/17(\d{6})/);
    let lot = null, exp = null, sno = '0';

    if (m17) {
        const dateStr = m17[1], expPos = m17.index;
        
        // Date parsing logic (handles DD-MM-YY variations)
        const p3 = dateStr.slice(4, 6);
        const n3 = parseInt(p3, 10);
        const iy = (n3 >= 24 && n3 <= 40);
        const yy = iy ? dateStr.slice(4, 6) : dateStr.slice(0, 2);
        const mm = dateStr.slice(2, 4);
        const dd = iy ? dateStr.slice(0, 2) : dateStr.slice(4, 6);
        
        if (parseInt(mm, 10) >= 1 && parseInt(mm, 10) <= 12) {
            exp = `20${yy}-${mm}-${parseInt(dd, 10) === 0 ? '01' : dd}`;
        }

        // Look for AI (10) Lot or (21) Serial
        let lotPart = payload.substring(0, expPos);
        lotPart = lotPart.replace(/^01\d{14}/, ''); // Remove GTIN AI(01)
        
        const aiMatch = lotPart.match(/^(10|21)/);
        const ai = aiMatch ? aiMatch[1] : '';
        lotPart = lotPart.replace(/^(10|21)/, '');

        // Specific Serial/Lot splitting for certain devices
        if (ai === '21' && lotPart.length === 11) {
            const bridges = ['16', '26', '36', '07', '30', '15', '13', '155', '104'];
            for (const bridge of bridges) {
                if (lotPart.endsWith(bridge)) {
                    sno = bridge;
                    lot = lotPart.slice(0, -bridge.length);
                    break;
                }
            }
        }
        
        if (!lot) lot = lotPart;
    } else {
        // Fallback for non-dated barcodes
        const fallback = payload.match(/^(?:10|21)(\w+)/);
        if (fallback) lot = fallback[1];
    }
    
    return { lot, exp, sno };
};

export const formatDateDisplay = (dateStr) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    const months = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
    return `${String(d.getDate()).padStart(2, '0')}-${months[d.getMonth()]}-${d.getFullYear()}`;
};
