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
