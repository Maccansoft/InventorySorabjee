import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
    TrendingUp, TrendingDown, Wallet, Box, CreditCard,
    ArrowUpRight, ArrowDownRight, Activity, PieChart,
    ArrowDownCircle, ArrowUpCircle, BookMarked, Bell, Truck
} from 'lucide-react';
import PendingTransfersModal from './inventory/PendingTransfersModal';

const Dashboard = ({ summaryStats, currentUser, onNavigate, notifCount, onShowNotifs }) => {
    const fmt = n => `PKR ${Math.abs(n || 0).toLocaleString()}`;
    const currentMonthLabel = new Date().toLocaleString('default', { month: 'long' });

    const stats = [
        { label: 'Total Purchase', key: 'total_purchase', color: '#6366f1', icon: <Box size={24} />, bg: '#eef2ff' },
        { label: 'Total Sales', key: 'total_sales', color: '#10b981', icon: <TrendingUp size={24} />, bg: '#f0fdf4' },
        { label: 'Total Receipts', key: 'total_receipts', color: '#3b82f6', icon: <ArrowDownCircle size={24} />, bg: '#eff6ff' },
        { label: 'Total Payments', key: 'total_payments', color: '#f59e0b', icon: <ArrowUpCircle size={24} />, bg: '#fffbeb' },
        { label: 'Profit / Loss', key: 'profit_loss', color: '#ef4444', icon: <Activity size={24} />, bg: '#fef2f2' },
    ];

    const quickActions = [
        { label: 'New Receipt', tab: 'Receipts', icon: <ArrowDownCircle size={20} />, color: '#10b981' },
        { label: 'New Payment', tab: 'Payments', icon: <ArrowUpCircle size={20} />, color: '#ef4444' },
        { label: 'Journal Entry', tab: 'Journal Vouchers', icon: <BookMarked size={20} />, color: '#6366f1' },
        { label: 'View Ledgers', tab: 'Ledgers', icon: <Activity size={20} />, color: '#0f172a' },
    ];

    return (
        <div className="dashboard-container animate-fade-in">
            <div className="dashboard-welcome">
                <div className="welcome-text">
                    <div className="flex items-center gap-4">
                        <h2>Welcome back, {currentUser.full_name || currentUser.username}! 👋</h2>
                    </div>
                    <p>Performance review for the month of <strong>{currentMonthLabel} {new Date().getFullYear()}</strong>.</p>
                </div>
                <div className="welcome-date">
                    <p>{new Date().toLocaleDateString('en-PK', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
                </div>
            </div>

            <div className="dashboard-stats-grid">
                {stats.map((stat, i) => {
                    const value = summaryStats ? summaryStats[stat.key] : 0;
                    return (
                        <div key={i} className="dashboard-stat-card">
                            <div className="stat-card-header">
                                <div className="stat-card-icon" style={{ backgroundColor: stat.bg, color: stat.color }}>
                                    {stat.icon}
                                </div>
                                <div className={`stat-trend ${value >= 0 ? 'up' : 'down'}`}>
                                    {value >= 0 ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                                    <span>{stat.key === 'profit_loss' ? (value >= 0 ? 'Surplus' : 'Deficit') : 'Active'}</span>
                                </div>
                            </div>
                            <div className="stat-card-info">
                                <span className="stat-label">{stat.label}</span>
                                <h3 className="stat-value">{fmt(value)}</h3>
                            </div>

                            {stat.key === 'total_receipts' && summaryStats && (
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginTop: '12px', color: '#64748b' }}>
                                    <div>Cash: <b>{fmt(summaryStats.receipt_cash).replace('PKR ', '')}</b></div>
                                    <div>Onl: <b>{fmt(summaryStats.receipt_online).replace('PKR ', '')}</b></div>
                                    <div>Chq: <b>{fmt(summaryStats.receipt_cheque).replace('PKR ', '')}</b></div>
                                </div>
                            )}

                            {stat.key === 'total_payments' && summaryStats && (
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginTop: '12px', color: '#64748b' }}>
                                    <div>Cash: <b>{fmt(summaryStats.payment_cash).replace('PKR ', '')}</b></div>
                                    <div>Onl: <b>{fmt(summaryStats.payment_online).replace('PKR ', '')}</b></div>
                                    <div>Chq: <b>{fmt(summaryStats.payment_cheque).replace('PKR ', '')}</b></div>
                                </div>
                            )}

                            {!['total_receipts', 'total_payments'].includes(stat.key) && (
                                <div className="stat-card-progress">
                                    <div className="progress-bar" style={{ width: '70%', backgroundColor: stat.color }}></div>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            <div className="dashboard-main-grid">
                <div className="dashboard-section quick-actions-section">
                    <div className="section-header">
                        <h3>Quick Actions</h3>
                    </div>
                    <div className="quick-actions-grid">
                        {quickActions.map((action, i) => (
                            <button key={i} className="quick-action-btn" onClick={() => onNavigate(action.tab)}>
                                <div className="action-icon" style={{ color: action.color }}>
                                    {action.icon}
                                </div>
                                <span>{action.label}</span>
                            </button>
                        ))}
                    </div>
                </div>

                <div className="dashboard-section recent-activity">
                    <div className="section-header">
                        <h3>System Status</h3>
                        <button className="view-all-link">Overview</button>
                    </div>
                    <div className="activity-list">
                        <div className="activity-item">
                            <div className="activity-status-dot active"></div>
                            <div className="activity-details">
                                <p className="activity-text">Database Connection</p>
                                <span className="activity-time">Optimal performance</span>
                            </div>
                        </div>
                        <div className="activity-item">
                            <div className="activity-status-dot active"></div>
                            <div className="activity-details">
                                <p className="activity-text">Location Sync</p>
                                <span className="activity-time">All 5 locations active</span>
                            </div>
                        </div>
                        <div className="activity-item">
                            <div className="activity-status-dot active"></div>
                            <div className="activity-details">
                                <p className="activity-text">Fiscal Year {currentUser.fiscal_year_label}</p>
                                <span className="activity-time">Running normally</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="dashboard-footer-info">
                <div className="info-card">
                    <PieChart size={20} />
                    <div>
                        <h4>Last Analysis</h4>
                        <p>Your financial reports are up to date based on the latest voucher entries.</p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Dashboard;
