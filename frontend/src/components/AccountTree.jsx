import React, { useState } from 'react';
import { ChevronRight, ChevronDown, Folder, Box, Edit2, Trash2, Plus, MapPin } from 'lucide-react';

/**
 * Recursive AccountNode — renders one account + its children.
 * Supports unlimited nesting levels.
 */
const AccountNode = ({ account, accounts, level = 0, onEdit, onDelete, onAdd }) => {
    const [open, setOpen] = useState(level < 2); // auto-open first 2 levels
    const children = account.children || accounts.filter(acc => acc.parent_id === account.id);
    const hasChildren = children.length > 0;

    return (
        <li className="tree-node">
            <div
                className={`tree-row ${hasChildren ? 'has-children' : ''}`}
                style={{ paddingLeft: `${level * 22 + 12}px` }}
                onClick={() => hasChildren && setOpen(!open)}
            >
                <span className="tree-toggle">
                    {hasChildren
                        ? (open ? <ChevronDown size={15} /> : <ChevronRight size={15} />)
                        : <span style={{ width: 15, display: 'inline-block' }} />}
                </span>

                <span className="tree-icon">
                    {account.is_virtual ? <MapPin size={16} /> : (hasChildren ? <Folder size={16} /> : <Box size={14} />)}
                </span>

                <span className="tree-code" style={account.is_virtual ? { color: '#6366f1', fontWeight: 800 } : {}}>
                    {account.account_code}
                </span>
                <span className="tree-name" style={account.is_virtual ? { fontWeight: 700 } : {}}>
                    {account.account_name}
                </span>

                {!account.is_virtual && (
                    <>
                        <span className={`tree-badge badge-${account.account_type?.toLowerCase()}`}>
                            {account.account_type}
                        </span>

                        <span className={`status-badge ${account.is_active ? 'active' : 'inactive'}`}
                            style={{ marginLeft: 12, fontSize: '0.7rem' }}>
                            {account.is_active ? 'Active' : 'Inactive'}
                        </span>
                    </>
                )}

                {/* Actions */}
                {!account.is_virtual && (
                    <div className="tree-actions" onClick={e => e.stopPropagation()}>
                        <button className="tree-action-btn edit" onClick={() => onEdit(account)} title="Edit Account">
                            <Edit2 size={13} />
                        </button>
                        {!account.is_main && (
                            <button className="tree-action-btn delete" onClick={() => onDelete(account)} title="Delete Account">
                                <Trash2 size={13} />
                            </button>
                        )}
                        <button className="tree-action-btn add" onClick={() => onAdd(account)} title="Add Sub-account">
                            <Plus size={13} />
                        </button>
                    </div>
                )}
            </div>

            {open && hasChildren && (
                <ul className="tree-children">
                    {children.map(child => (
                        <AccountNode
                            key={child.id}
                            account={child}
                            accounts={accounts}
                            level={level + 1}
                            onEdit={onEdit}
                            onDelete={onDelete}
                            onAdd={onAdd}
                        />
                    ))}
                </ul>
            )}
        </li>
    );
};


/**
 * AccountTree — renders the full chart of accounts as an interactive tree.
 * Accepts a flat `accounts` array and renders the hierarchy recursively.
 */
const AccountTree = ({ accounts, onEdit, onDelete, onAdd }) => {
    // If it's a nested tree, root items are the ones in the array.
    // If it's a flat list (e.g. search), we filter items with no parent.
    const rootAccounts = accounts.some(a => a.children)
        ? accounts
        : accounts.filter(acc => !acc.parent_id);

    if (rootAccounts.length === 0) {
        return (
            <div style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>
                No accounts found.
            </div>
        );
    }

    return (
        <div className="account-tree">
            <ul className="tree-root">
                {rootAccounts.map(account => (
                    <AccountNode
                        key={account.id}
                        account={account}
                        accounts={accounts}
                        onEdit={onEdit}
                        onDelete={onDelete}
                        onAdd={onAdd}
                    />
                ))}
            </ul>
        </div>
    );
};

export default AccountTree;
