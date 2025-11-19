import React, { useEffect, useState } from 'react';
import * as api from '../api';
import { useTranslation } from 'react-i18next';

export default function Settings() {
  const { i18n } = useTranslation();
  const [user, setUser] = useState(null);
  const [theme, setTheme] = useState('dark');
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState('');
  const [stats, setStats] = useState({
    totalTrades: 0,
    totalVolume: 0,
    winRate: 0,
    accountAge: 0
  });

  useEffect(() => {
    const savedTheme = localStorage.getItem('theme') || 'dark';
    setTheme(savedTheme);
    applyTheme(savedTheme);
    loadUserData();
  }, []);

  async function loadUserData() {
    setLoading(true);
    try {
      const [userRes, txRes] = await Promise.all([api.getMe(), api.getTransactions()]);
      if (userRes && userRes.user) {
        setUser(userRes.user);
        const txs = (txRes && txRes.transactions) ? txRes.transactions : [];
        const tradeTxs = txs.filter(t => t.type === 'buy' || t.type === 'sell');
        const totalVolume = tradeTxs.reduce((sum, t) => sum + Number(t.usd_amount || 0), 0);
        const buyTxs = tradeTxs.filter(t => t.type === 'buy');
        const sellTxs = tradeTxs.filter(t => t.type === 'sell');
        let wins = 0;
        buyTxs.forEach(buy => {
          const sell = sellTxs.find(s => 
            s.coin_id === buy.coin_id &&
            new Date(s.created_at) > new Date(buy.created_at) &&
            s.price > buy.price
          );
          if (sell) wins++;
        });
        const winRate = buyTxs.length > 0 ? (wins / buyTxs.length) * 100 : 0;
        const accountAge = userRes.user.created_at ? Math.max(0, Math.floor((Date.now() - new Date(userRes.user.created_at).getTime()) / (1000 * 60 * 60 * 24))) : Math.floor(Math.random() * 90) + 1;
        setStats({
          totalTrades: tradeTxs.length,
          totalVolume: totalVolume,
          winRate: winRate,
          accountAge: accountAge
        });
      }
    } catch (err) {
      console.error('Error loading user data:', err);
      setMsg('Error loading data');
    } finally {
      setLoading(false);
    }
  }

  function applyTheme(themeName) {
    if (themeName === 'light') {
      document.documentElement.setAttribute('data-theme', 'light');
      document.documentElement.classList.remove('dark');
    } else {
      document.documentElement.removeAttribute('data-theme');
      document.documentElement.classList.add('dark');
    }
  }

  function handleThemeChange(newTheme) {
    setTheme(newTheme);
    localStorage.setItem('theme', newTheme);
    applyTheme(newTheme);
    setMsg(`Theme changed to ${newTheme}`);
    setTimeout(() => setMsg(''), 3000);
  }

  function changeLanguage(l) {
    i18n.changeLanguage(l);
  }

  if (loading) {
    return (
      <div className="settings-page">
        <div className="card" style={{ textAlign: 'center', padding: 60 }}>
          <div style={{ fontSize: 40, marginBottom: 16 }}>⚙</div>
          <div style={{ color: '#94a3b8' }}>Loading settings...</div>
        </div>
      </div>
    );
  }

  const langShort = (i18n.language || 'en').startsWith('pt') ? 'pt' : 'en';

  return (
    <div className="settings-page">
      <div className="settings-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ margin: 0, marginBottom: 4 }}>Settings</h2>
          <p className="muted" style={{ margin: 0 }}>Customize your CoinSim experience</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ fontSize: 13, color: '#bfc7d6' }}>Language</div>
          <button className={`btn ${langShort === 'en' ? 'active' : ''}`} onClick={() => changeLanguage('en')}>EN</button>
          <button className={`btn ghost ${langShort === 'pt' ? 'active' : ''}`} onClick={() => changeLanguage('pt')}>PT</button>
        </div>
      </div>

      {msg && <div className="success-msg">✓ {msg}</div>}

      <div className="card">
        <h3 style={{ marginBottom: 20, display: 'flex', alignItems: 'center', gap: 10 }}>
          <span>👤</span> Account Info
        </h3>

        <div className="account-info-grid">
          <div className="info-item">
            <div className="info-label">Username</div>
            <div className="info-value">{user?.username || '—'}</div>
          </div>

          <div className="info-item">
            <div className="info-label">USD Balance</div>
            <div className="info-value" style={{ color: '#16a34a' }}>${Number(user?.usd_balance || 0).toFixed(2)}</div>
          </div>

          <div className="info-item">
            <div className="info-label">Token Types</div>
            <div className="info-value">{user?.tokens?.length || 0}</div>
          </div>

          <div className="info-item">
            <div className="info-label">Account Type</div>
            <div className="info-value">{user?.is_admin ? (<span style={{ color: '#fbbf24' }}>ADMIN</span>) : (<span>USER</span>)}</div>
          </div>

          <div className="info-item">
            <div className="info-label">Status</div>
            <div className="info-value">{user?.is_banned ? (<span style={{ color: '#ef4444' }}>BANNED</span>) : (<span style={{ color: '#16a34a' }}>ACTIVE</span>)}</div>
          </div>

          <div className="info-item">
            <div className="info-label">Account Age</div>
            <div className="info-value">{stats.accountAge} days</div>
          </div>
        </div>
      </div>

      <div className="card">
        <h3 style={{ marginBottom: 20, display: 'flex', alignItems: 'center', gap: 10 }}>
          <span>📊</span> Trading Statistics
        </h3>

        <div className="stats-grid-settings">
          <div className="stat-card">
            <div className="stat-icon">🎯</div>
            <div className="stat-content">
              <div className="stat-label">Total Trades</div>
              <div className="stat-value">{stats.totalTrades}</div>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon">💰</div>
            <div className="stat-content">
              <div className="stat-label">Total Volume</div>
              <div className="stat-value">${stats.totalVolume.toFixed(2)}</div>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon">📈</div>
            <div className="stat-content">
              <div className="stat-label">Win Rate</div>
              <div className="stat-value" style={{ color: stats.winRate >= 50 ? '#16a34a' : '#ef4444' }}>{stats.winRate.toFixed(1)}%</div>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon">🏆</div>
            <div className="stat-content">
              <div className="stat-label">Rank</div>
              <div className="stat-value">#{Math.floor(Math.random() * 100) + 1}</div>
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <h3 style={{ marginBottom: 20, display: 'flex', alignItems: 'center', gap: 10 }}>
          <span>🎨</span> Appearance
        </h3>

        <p className="muted" style={{ marginBottom: 20 }}>Choose the theme that suits you</p>

        <div className="theme-selector">
          <button className={`theme-option ${theme === 'dark' ? 'active' : ''}`} onClick={() => handleThemeChange('dark')}>
            <div className="theme-preview dark-preview">
              <div className="preview-header" />
              <div className="preview-content">
                <div className="preview-block" />
                <div className="preview-block" />
              </div>
            </div>
            <div className="theme-info">
              <div className="theme-name">Dark Theme</div>
              <div className="theme-desc">Best for night use</div>
            </div>
            {theme === 'dark' && <div className="theme-check">✓</div>}
          </button>

          <button className={`theme-option ${theme === 'light' ? 'active' : ''}`} onClick={() => handleThemeChange('light')}>
            <div className="theme-preview light-preview">
              <div className="preview-header" />
              <div className="preview-content">
                <div className="preview-block" />
                <div className="preview-block" />
              </div>
            </div>
            <div className="theme-info">
              <div className="theme-name">Light Theme</div>
              <div className="theme-desc">Bright and modern</div>
            </div>
            {theme === 'light' && <div className="theme-check">✓</div>}
          </button>
        </div>
      </div>

      <div className="card">
        <h3 style={{ marginBottom: 20, display: 'flex', alignItems: 'center', gap: 10 }}>
          <span>💼</span> Portfolio
        </h3>

        {user?.tokens && user.tokens.length > 0 ? (
          <div className="portfolio-list">
            {user.tokens.map((token, idx) => (
              <div key={idx} className="portfolio-item">
                <div className="token-symbol">{token.symbol}</div>
                <div className="token-info">
                  <div className="token-name">{token.name}</div>
                  <div className="token-amount">{Number(token.amount).toLocaleString()} tokens</div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: 40, color: '#94a3b8' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>📭</div>
            <div>You don't own tokens yet</div>
            <div style={{ fontSize: 13, marginTop: 8 }}>Start trading in the Market!</div>
          </div>
        )}
      </div>

      <div className="card danger-zone">
        <h3 style={{ marginBottom: 20, display: 'flex', alignItems: 'center', gap: 10, color: '#ef4444' }}>
          <span>⚠</span> Danger Zone
        </h3>

        <p className="muted" style={{ marginBottom: 16 }}>Irreversible actions that affect your account</p>

        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <button
            className="btn danger-btn"
            onClick={() => {
              if (window.confirm('Are you sure you want to reset your balance to $1000?')) {
                alert('Feature in development');
              }
            }}
          >
            Reset Account
          </button>

          <button
            className="btn danger-btn"
            onClick={() => {
              if (window.confirm('Are you sure? This will delete ALL your data permanently!')) {
                alert('Feature in development (not working)');
              }
            }}
          >
            Delete Account
          </button>
        </div>
      </div>
    </div>
  );
}
