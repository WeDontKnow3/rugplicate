import React, { useEffect, useState } from 'react';
import * as api from '../api';
import { useTranslation } from 'react-i18next';

export default function Settings() {
  const { t, i18n } = useTranslation();
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
  const [confirmSettings, setConfirmSettings] = useState({
    enabled: false,
    usd_threshold: 1000,
    percentage_threshold: 10,
    token_count_threshold: 100000
  });
  const [savingSettings, setSavingSettings] = useState(false);

  useEffect(() => {
    const savedTheme = localStorage.getItem('theme') || 'dark';
    setTheme(savedTheme);
    applyTheme(savedTheme);
    loadUserData();
  }, []);

  async function loadUserData() {
    setLoading(true);
    try {
      const [userRes, txRes, settingsRes] = await Promise.all([
        api.getMe(), 
        api.getTransactions(),
        api.getUserSettings()
      ]);
      
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

      if (settingsRes && settingsRes.settings) {
        setConfirmSettings({
          enabled: settingsRes.settings.double_confirm_enabled || false,
          usd_threshold: settingsRes.settings.double_confirm_usd_threshold || 1000,
          percentage_threshold: settingsRes.settings.double_confirm_percentage_threshold || 10,
          token_count_threshold: settingsRes.settings.double_confirm_token_count_threshold || 100000
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

  async function saveConfirmSettings() {
    setSavingSettings(true);
    setMsg('');
    try {
      const res = await api.updateUserSettings({
        double_confirm_enabled: confirmSettings.enabled,
        double_confirm_usd_threshold: Number(confirmSettings.usd_threshold),
        double_confirm_percentage_threshold: Number(confirmSettings.percentage_threshold),
        double_confirm_token_count_threshold: Number(confirmSettings.token_count_threshold)
      });
      
      if (res && res.ok) {
        setMsg('Confirmation settings saved successfully');
        setTimeout(() => setMsg(''), 3000);
      } else {
        setMsg(res?.error || 'Failed to save settings');
      }
    } catch (err) {
      console.error('Error saving settings:', err);
      setMsg('Error saving settings');
    } finally {
      setSavingSettings(false);
    }
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
          <span>⚠️</span> Trade Confirmation Settings
        </h3>
        
        <p className="muted" style={{ marginBottom: 20 }}>
          Configure when you want to see a double confirmation dialog before selling coins
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <label style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: 12, 
            padding: 16, 
            background: 'var(--glass)', 
            borderRadius: 8,
            cursor: 'pointer'
          }}>
            <input
              type="checkbox"
              checked={confirmSettings.enabled}
              onChange={e => setConfirmSettings({ ...confirmSettings, enabled: e.target.checked })}
              style={{ width: 20, height: 20, cursor: 'pointer' }}
            />
            <div>
              <div style={{ fontWeight: 700, marginBottom: 4 }}>Enable Double Confirmation</div>
              <div className="muted" style={{ fontSize: 13 }}>
                Show confirmation dialog when selling large amounts
              </div>
            </div>
          </label>

          {confirmSettings.enabled && (
            <div style={{ 
              padding: 20, 
              background: 'var(--glass)', 
              border: '1px solid var(--border)', 
              borderRadius: 10,
              display: 'flex',
              flexDirection: 'column',
              gap: 16
            }}>
              <div>
                <label style={{ 
                  display: 'block', 
                  fontWeight: 600, 
                  marginBottom: 8,
                  fontSize: 14
                }}>
                  USD Value Threshold
                </label>
                <input
                  type="number"
                  value={confirmSettings.usd_threshold}
                  onChange={e => setConfirmSettings({ 
                    ...confirmSettings, 
                    usd_threshold: Math.max(0, Number(e.target.value)) 
                  })}
                  min="0"
                  step="100"
                  style={{ width: '100%' }}
                />
                <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
                  Show confirmation when selling coins worth more than ${confirmSettings.usd_threshold}
                </div>
              </div>

              <div>
                <label style={{ 
                  display: 'block', 
                  fontWeight: 600, 
                  marginBottom: 8,
                  fontSize: 14
                }}>
                  Percentage of Holdings Threshold (%)
                </label>
                <input
                  type="number"
                  value={confirmSettings.percentage_threshold}
                  onChange={e => setConfirmSettings({ 
                    ...confirmSettings, 
                    percentage_threshold: Math.max(0, Math.min(100, Number(e.target.value)))
                  })}
                  min="0"
                  max="100"
                  step="1"
                  style={{ width: '100%' }}
                />
                <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
                  Show confirmation when selling more than {confirmSettings.percentage_threshold}% of your holdings
                </div>
              </div>

              <div>
                <label style={{ 
                  display: 'block', 
                  fontWeight: 600, 
                  marginBottom: 8,
                  fontSize: 14
                }}>
                  Token Count Threshold
                </label>
                <input
                  type="number"
                  value={confirmSettings.token_count_threshold}
                  onChange={e => setConfirmSettings({ 
                    ...confirmSettings, 
                    token_count_threshold: Math.max(0, Number(e.target.value))
                  })}
                  min="0"
                  step="1000"
                  style={{ width: '100%' }}
                />
                <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
                  Show confirmation when selling more than {confirmSettings.token_count_threshold.toLocaleString()} tokens
                </div>
              </div>

              <button 
                className="btn" 
                onClick={saveConfirmSettings}
                disabled={savingSettings}
                style={{ marginTop: 8 }}
              >
                {savingSettings ? 'Saving...' : 'Save Confirmation Settings'}
              </button>
            </div>
          )}
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
