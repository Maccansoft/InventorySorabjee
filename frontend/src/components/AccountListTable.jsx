import React, { useState } from 'react';
import { Search, Edit2, Trash2 } from 'lucide-react';

const AccountListTable = ({ accounts, onEdit, onDelete, currentUser, searchQuery: propSearchQuery, setSearchQuery: propSetSearchQuery }) => {
    const [localSearchQuery, setLocalSearchQuery] = useState('');
    const searchQuery = propSearchQuery !== undefined ? propSearchQuery : localSearchQuery;
    const setSearchQuery = propSetSearchQuery !== undefined ? propSetSearchQuery : setLocalSearchQuery;

    // Filter accounts locally based on the search query
    const filteredAccounts = accounts.filter(account => {
        const query = searchQuery.toLowerCase();
        return (
            (account.account_code || '').toLowerCase().includes(query) ||
            (account.account_name || '').toLowerCase().includes(query) ||
            (account.location_name || '').toLowerCase().includes(query) ||
            (account.parent_name || '').toLowerCase().includes(query) ||
            (account.creator_name || '').toLowerCase().includes(query)
        );
    });

    // Sort accounts by account_code naturally
    const sortedAccounts = [...filteredAccounts].sort((a, b) => {
        return (a.account_code || '').localeCompare(b.account_code || '', undefined, { numeric: true, sensitivity: 'base' });
    });

    const isFYClosed = currentUser?.fiscal_year_closed;

    return (
        <div className="account-list-table-wrapper animate-fade-in" style={{ marginTop: '10px' }}>
            {/* Premium Search Bar */}
            <div className="table-search-premium" style={{ marginBottom: '24px' }}>
                <Search size={18} className="search-icon" />
                <input
                    type="text"
                    placeholder="Search by Code, Name, Location, Parent or Creator..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                />
            </div>

            {/* Premium Table Container */}
            <div className="premium-table-container">
                <table className="premium-table">
                    <thead>
                        <tr>
                            <th style={{ fontSize: '0.72rem' }}>Account Code</th>
                            <th style={{ fontSize: '0.72rem' }}>Account Name</th>
                            <th style={{ fontSize: '0.72rem' }}>Location</th>
                            <th style={{ fontSize: '0.72rem' }}>Parent Account</th>
                            <th style={{ fontSize: '0.72rem', textAlign: 'center' }}>Account Type</th>
                            <th style={{ fontSize: '0.72rem' }}>Status</th>
                            <th style={{ fontSize: '0.72rem' }}>Statement Type</th>
                            <th style={{ fontSize: '0.72rem', textAlign: 'center' }}>Inventory Mapped</th>
                            <th style={{ fontSize: '0.72rem' }}>Created By</th>
                            <th style={{ fontSize: '0.72rem', textAlign: 'center' }}>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {sortedAccounts.length === 0 ? (
                            <tr>
                                <td colSpan="10" className="empty-state" style={{ textAlign: 'center', padding: '48px', color: '#94a3b8' }}>
                                    No accounts found.
                                </td>
                            </tr>
                        ) : (
                            sortedAccounts.map(account => {
                                // Determine if account is a Parent or Child
                                const isParent = account.is_main || accounts.some(a => a.parent_id === account.id);
                                const accountTypeLabel = isParent ? 'PARENT' : 'CHILD';

                                // Format parent display name (strictly display only the Account Name as requested)
                                const parentDisplay = account.parent_name || '—';

                                // Format inventory module display
                                const hasInventoryMapping = account.inventory_module && account.inventory_module !== 'NONE';

                                return (
                                    <tr key={account.id} className="table-row-hover">
                                        {/* 1. Account Code */}
                                        <td style={{ fontSize: '0.72rem', fontWeight: 700, color: '#1e293b', fontFamily: 'monospace' }}>
                                            {account.account_code}
                                        </td>
                                        
                                        {/* 2. Account Name */}
                                        <td style={{ fontSize: '0.72rem', fontWeight: 600, color: '#1e293b' }}>
                                            {account.account_name}
                                        </td>
                                        
                                        {/* 3. Location */}
                                        <td style={{ fontSize: '0.72rem' }}>
                                            {account.location_name ? (
                                                <span className="maker-tag" style={{ fontSize: '0.72rem', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                                    {account.location_name}
                                                </span>
                                            ) : (
                                                <span style={{ color: '#94a3b8', fontStyle: 'italic', fontSize: '0.72rem' }}>Global</span>
                                            )}
                                        </td>
                                        
                                        {/* 4. Parent Account */}
                                        <td style={{ fontSize: '0.72rem', color: '#475569' }}>
                                            {parentDisplay}
                                        </td>
                                        
                                        {/* 5. Account Type (PARENT / CHILD) */}
                                        <td style={{ fontSize: '0.72rem', textAlign: 'center' }}>
                                            <span 
                                                className={`tree-badge badge-${accountTypeLabel.toLowerCase()}`}
                                                style={{ 
                                                    padding: '4px 10px', 
                                                    borderRadius: '8px', 
                                                    fontSize: '0.72rem', 
                                                    fontWeight: 800,
                                                    display: 'inline-block',
                                                    width: '72px',
                                                    textAlign: 'center'
                                                }}
                                            >
                                                {accountTypeLabel}
                                            </span>
                                        </td>
                                        
                                        {/* 6. Active Status */}
                                        <td style={{ fontSize: '0.72rem' }}>
                                            <span className={`status-badge ${account.is_active ? 'active' : 'inactive'}`} style={{ fontSize: '0.72rem' }}>
                                                {account.is_active ? 'Active' : 'Inactive'}
                                            </span>
                                        </td>
                                        
                                        {/* 7. Statement Type */}
                                        <td style={{ fontSize: '0.72rem', fontWeight: 500, color: '#334155' }}>
                                            {account.statement_type === 'BALANCE_SHEET' ? 'Balance Sheet' :
                                             account.statement_type === 'PROFIT_LOSS' ? 'Profit & Loss' :
                                             account.statement_type === 'BOTH' ? 'Both' : (account.statement_type || '—')}
                                        </td>
                                        
                                        {/* 8. Inventory Module */}
                                        <td style={{ fontSize: '0.72rem', textAlign: 'center' }}>
                                            {hasInventoryMapping ? (
                                                <span 
                                                    className="status-pill verified animate-fade-in" 
                                                    style={{ 
                                                        fontSize: '0.72rem', 
                                                        padding: '3px 10px', 
                                                        display: 'inline-flex', 
                                                        alignItems: 'center', 
                                                        gap: '4px',
                                                        fontWeight: 700 
                                                    }}
                                                    title={account.inventory_module.replace('_', ' ')}
                                                >
                                                    Yes
                                                </span>
                                            ) : (
                                                <span style={{ color: '#94a3b8', fontSize: '0.72rem' }}>No</span>
                                            )}
                                        </td>
                                        
                                        {/* 9. Created By */}
                                        <td style={{ fontSize: '0.72rem', color: '#475569', fontWeight: 500 }}>
                                            {account.creator_name || <span style={{ color: '#94a3b8', fontSize: '0.72rem' }}>System</span>}
                                        </td>
                                        
                                        {/* 10. Actions (Edit / Delete) */}
                                        <td style={{ fontSize: '0.72rem', textAlign: 'center' }}>
                                            <div style={{ display: 'inline-flex', gap: '8px', alignItems: 'center' }}>
                                                <button 
                                                    className="tree-action-btn edit" 
                                                    onClick={() => !isFYClosed && onEdit(account)} 
                                                    disabled={isFYClosed}
                                                    title="Edit Account"
                                                    style={{ padding: '6px', borderRadius: '6px' }}
                                                >
                                                    <Edit2 size={13} />
                                                </button>
                                                {!account.is_main && (
                                                    <button 
                                                        className="tree-action-btn delete" 
                                                        onClick={() => !isFYClosed && onDelete(account)} 
                                                        disabled={isFYClosed}
                                                        title="Delete Account"
                                                        style={{ padding: '6px', borderRadius: '6px' }}
                                                    >
                                                        <Trash2 size={13} />
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default React.memo(AccountListTable);
