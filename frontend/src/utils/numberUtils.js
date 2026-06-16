/**
 * Standardized Number Formatting for Stock Movement Modules
 */

/**
 * Rule 1: Amount/Rate Fields
 * - 1000 Separator (commas)
 * - Remove .00 only
 * - Keep decimals if non-zero
 */
export const formatAmount = (num) => {
    if (num === '') return '';
    if (num === null || num === undefined || isNaN(num)) return '0';
    const val = Number(num);
    return val.toLocaleString('en-US', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
        useGrouping: true
    });
};

/**
 * Rule 2: QTY Fields
 * - NO thousand separator
 * - NO trailing .00
 * - Clean numeric string
 */
export const formatQty = (num) => {
    if (num === '') return '';
    if (num === null || num === undefined || isNaN(num)) return '0';
    const val = Number(num);
    // toString() on a number naturally removes trailing .00 and doesn't add commas
    return val.toString();
};

/**
 * Rule 3: Accounts Module Amount Fields
 * - Rounds to nearest whole number (no decimals shown)
 * - 1000 Separator (commas)
 * - Handles null / undefined / empty → returns '' if blank, '0' otherwise
 * - Handles negative values correctly: -120000 → -120,000
 *
 * Used in: Receipts, Payments, Journal Voucher, Cash/Bank Book,
 *          Ledgers, Multiple Ledgers, Receivables, Payables,
 *          Trial Balance, Balance Sheet
 */
export const formatAcctAmt = (num, blankIfZero = false) => {
    if (num === null || num === undefined || num === '') {
        return blankIfZero ? '' : '0';
    }
    const val = Math.round(Number(num));
    if (isNaN(val)) return blankIfZero ? '' : '0';
    if (blankIfZero && val === 0) return '';
    return val.toLocaleString('en-US', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
        useGrouping: true
    });
};

/**
 * Rule 4: Short Date Display
 * Converts any date value (ISO datetime string, plain date string, Date object)
 * to a short "YYYY-MM-DD" format for display only.
 * "2026-06-15T19:00:00.000Z"  →  "2026-06-15"
 * "2026-06-15"                →  "2026-06-15"
 * null / undefined / ''       →  '—'
 * Does NOT alter any stored data or API values.
 */
export const formatShortDate = (val) => {
    if (val === null || val === undefined || val === '') return '—';
    const s = String(val);
    // If it's an ISO datetime or any string longer than 10 chars, slice YYYY-MM-DD
    return s.length > 10 ? s.slice(0, 10) : s;
};

