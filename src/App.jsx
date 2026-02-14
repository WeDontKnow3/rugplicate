import React, { useEffect, useState } from 'react';
import * as api from './api';
import Auth from './components/Auth';
import Dashboard from './components/Dashboard';
import Market from './components/Market';
import CreateCoin from './components/CreateCoin';
import CoinDetail from './components/CoinDetail';
import Portfolio from './components/Portfolio';
import AdminPanel from './components/AdminPanel';
import Leaderboard from './components/Leaderboard';
import Sidebar from './components/Sidebar';
import Settings from './components/Settings';
import Notifications from './components/Notifications';
import Gambling from './components/Gambling';
import Treemap from './components/Treemap';
import Promocodes from './components/Promocodes';
import ApiKeyPanel from './components/ApiKeyPanel';
import Hopium from './components/Hopium';
import News from './components/News';
import { useTranslation } from 'react-i18next';

let animId = 1;

function getCookie(name) {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop().split(';').shift();
  return null;
}

function setCookie(name, value, days = 30) {
  const expires = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toUTCString();
  document.cookie = `${name}=${value}; expires=${expires}; path=/; SameSite=Strict`;
}

function deleteCookie(name) {
  document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; SameSite=Strict`;
}

export default function App() {
  const { t } = useTranslation();

  const [user, setUser] = useState(null);
  const [view, setView] = useState('market');
  const [selectedCoin, setSelectedCoin] = useState(null);
  const [balance, setBalance] = useState(null);
  const [moneyAnims, setMoneyAnims] = useState([]);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [dailyStatus, setDailyStatus] = useState(null);
  const [claimingDaily, setClaimingDaily] = useState(false);
  const [initializing, setInitializing] = useState(true);
  const [timeRemaining, setTimeRemaining] = useState(null);

  // Unlock date: March 14, 2026 at 12:00 PM Brasília Time (UTC-3)
  const UNLOCK_DATE = new Date('2026-03-14T12:00:00-03:00');

  useEffect(() => {
    const updateCountdown = () => {
      const now = new Date();
      const diff = UNLOCK_DATE - now;
      
      if (diff <= 0) {
        setTimeRemaining(null);
      } else {
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((diff % (1000 * 60)) / 1000);
        
        setTimeRemaining({ days, hours, minutes, seconds });
      }
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    
    return () => clearInterval(interval);
  }, []);

  async function loadMe() {
    try {
      const res = await api.getMe();
      if (res && res.user) {
        setUser(res.user);
        setBalance(Number(res.user.usd_balance));
        return true;
      } else {
        setUser(null);
        setBalance(null);
        return false;
      }
    } catch (err) {
      setUser(null);
      setBalance(null);
      return false;
    }
  }

  async function loadDailyStatus() {
    try {
      const res = await api.getDailyStatus();
      setDailyStatus(res);
    } catch (err) {
      setDailyStatus(null);
    }
  }

  useEffect(() => {
    const token = getCookie('token');
    if (token) {
      loadMe().finally(() => {
        setInitializing(false);
      });
    } else {
      setInitializing(false);
    }
  }, []);

  useEffect(() => {
    if (user) {
      loadDailyStatus();
    }
  }, [user]);

  function onLogin(token) {
    if (token) {
      setCookie('token', token, 30);
      loadMe();
    }
  }

  function onLogout() {
    fetch(`${import.meta.env.VITE_API_BASE || 'https://devsite-backend-production.up.railway.app'}/api/logout`, {
      method: 'POST',
      credentials: 'include',
      headers: { Authorization: `Bearer ${getCookie('token')}` }
    }).then(() => {
      deleteCookie('token');
      setUser(null);
      setBalance(null);
      setView('market');
      window.location.reload();
    }).catch(() => {
      deleteCookie('token');
      setUser(null);
      setBalance(null);
      setView('market');
      window.location.reload();
    });
  }

  function triggerMoneyAnimation(amount = 0, type = 'down') {
    const id = animId++;
    const entry = { id, amount: Number(amount), type };
    setMoneyAnims(a => [...a, entry]);
    setTimeout(() => {
      setMoneyAnims(a => a.filter(x => x.id !== id));
    }, 1100);
  }

  async function handleActionComplete(opts = {}) {
    if (opts.animate) {
      triggerMoneyAnimation(opts.animate.amount, opts.animate.type);
    }
    await loadMe();
    if (!opts.keepView) setView('market');
  }

  function handleNavigate(v) {
    setView(v);
    if (window.innerWidth < 900) setSidebarOpen(false);
  }

  async function handleClaimDaily() {
    if (claimingDaily || !dailyStatus?.can_claim) return;
    setClaimingDaily(true);
    try {
      const res = await api.claimDailyReward();
      if (res.ok) {
        triggerMoneyAnimation(res.amount, 'up');
        await loadMe();
        await loadDailyStatus();
      }
    } catch (err) {
      console.error('Failed to claim daily:', err);
    } finally {
      setClaimingDaily(false);
    }
  }

  function formatTimeRemaining(seconds) {
    if (!seconds || seconds <= 0) return t('ready');
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  }

  // Show maintenance screen if site is still locked
  if (timeRemaining !== null) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
        color: '#e2e8f0',
        padding: '20px'
      }}>
        <div style={{
          maxWidth: '600px',
          width: '100%',
          textAlign: 'center'
        }}>
          <div style={{
            fontSize: '72px',
            marginBottom: '24px',
            animation: 'float 3s ease-in-out infinite'
          }}>
            🚧
          </div>

          <h1 style={{
            fontSize: '32px',
            fontWeight: '800',
            marginBottom: '16px',
            color: '#f1f5f9'
          }}>
            Site Under Maintenance
          </h1>

          <p style={{
            fontSize: '18px',
            color: '#94a3b8',
            marginBottom: '48px',
            lineHeight: '1.6'
          }}>
            We're working on a massive update to bring you an even better experience. The site will be back online soon!
          </p>

          <div style={{
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: '16px',
            padding: '32px',
            marginBottom: '24px'
          }}>
            <div style={{
              fontSize: '14px',
              fontWeight: '600',
              color: '#94a3b8',
              marginBottom: '20px',
              letterSpacing: '0.5px',
              textTransform: 'uppercase'
            }}>
              Back Online In
            </div>

            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              gap: '16px',
              marginBottom: '8px'
            }}>
              <CountdownUnit value={timeRemaining.days} label="Days" />
              <CountdownUnit value={timeRemaining.hours} label="Hours" />
              <CountdownUnit value={timeRemaining.minutes} label="Minutes" />
              <CountdownUnit value={timeRemaining.seconds} label="Seconds" />
            </div>

            <div style={{
              fontSize: '13px',
              color: '#64748b',
              marginTop: '16px'
            }}>
              March 14, 2026 • 12:00 PM (Brasília Time)
            </div>
          </div>

          <div style={{
            padding: '16px',
            background: 'rgba(59, 130, 246, 0.08)',
            border: '1px solid rgba(59, 130, 246, 0.2)',
            borderRadius: '12px'
          }}>
            <p style={{
              fontSize: '14px',
              color: '#94a3b8',
              margin: 0,
              lineHeight: '1.5'
            }}>
              💡 <strong style={{ color: '#bfc7d6' }}>What's coming:</strong> New features, improved performance, enhanced user experience, and much more!
            </p>
          </div>

          <style>{`
            @keyframes float {
              0%, 100% { transform: translateY(0px); }
              50% { transform: translateY(-10px); }
            }
            @keyframes pulse {
              0%, 100% { opacity: 1; transform: scale(1); }
              50% { opacity: 0.8; transform: scale(0.98); }
            }
          `}</style>
        </div>
      </div>
    );
  }

  if (initializing) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        background: 'var(--bg-primary, #0f172a)',
        color: 'var(--text-primary, #e2e8f0)'
      }}>
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '1rem'
        }}>
          <div style={{
            width: '48px',
            height: '48px',
            border: '4px solid rgba(226, 232, 240, 0.1)',
            borderTopColor: '#3b82f6',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite'
          }}></div>
          <style>{`
            @keyframes spin {
              to { transform: rotate(360deg); }
            }
          `}</style>
        </div>
      </div>
    );
  }

  return (
    <div className="app-wrapper">
      <Sidebar
        view={view}
        onNavigate={handleNavigate}
        onLogout={onLogout}
        open={sidebarOpen}
        setOpen={setSidebarOpen}
      />

      <div className="main-content">
        <header className="topbar">
          <button
            className={`hamburger ${sidebarOpen ? 'open' : ''}`}
            onClick={() => setSidebarOpen(s => !s)}
            aria-label={t('toggleMenu')}
          >
            <span></span>
            <span></span>
            <span></span>
          </button>

          <div className="topbar-center">
            <h1 className="page-title">
              {view === 'market' && t('market')}
              {view === 'portfolio' && t('portfolio')}
              {view === 'dashboard' && t('dashboard')}
              {view === 'create' && t('createCoin')}
              {view === 'detail' &&
                (selectedCoin
                  ? t('coinPrefix', { selectedCoin })
                  : t('coin'))}
              {view === 'leaderboard' && t('leaderboard')}
              {view === 'settings' && t('settings')}
              {view === 'admin' && t('adminPanel')}
              {view === 'gambling' && t('gambling')}
              {view === 'promos' && 'Promocodes'}
              {view === 'notifications' && 'Notifications'}
              {view === 'apikeys' && 'API Keys'}
              {view === 'hopium' && 'Hopium'}
              {view === 'news' && 'News'}
              {view === 'treemap' && 'Market Treemap'}
            </h1>
          </div>

          <div className="topbar-right">
            {user && dailyStatus && (
              <button
                className={`daily-reward-btn ${dailyStatus.can_claim ? 'ready' : 'waiting'}`}
                onClick={handleClaimDaily}
                disabled={!dailyStatus.can_claim || claimingDaily}
                title={
                  dailyStatus.can_claim
                    ? t('dailyReadyTitle')
                    : t('dailyWaitingTitle', {
                        time: formatTimeRemaining(dailyStatus.seconds_until_next)
                      })
                }
              >
                <span className="daily-icon">🎁</span>
                <span className="daily-text">
                  {dailyStatus.can_claim
                    ? t('claimDaily')
                    : formatTimeRemaining(dailyStatus.seconds_until_next)}
                </span>
              </button>
            )}

            {user && (
              <button
                className="logout-btn-topbar"
                onClick={onLogout}
                title={t('logout')}
              >
                <span className="logout-icon">⎋</span>
                <span className="logout-text">{t('logout')}</span>
              </button>
            )}

            <div className="money-anim-container">
              {moneyAnims.map(a => (
                <MoneyAnim key={a.id} amount={a.amount} type={a.type} />
              ))}
            </div>
          </div>
        </header>

        <main className="page-content">
          {!user && <Auth onLogin={onLogin} />}

          {user && view === 'market' && (
            <Market
              onOpenCoin={(s) => { setSelectedCoin(s); setView('detail'); }}
              onActionComplete={handleActionComplete}
            />
          )}

          {user && view === 'dashboard' && (
            <Dashboard onActionComplete={handleActionComplete} />
          )}

          {user && view === 'create' && (
            <CreateCoin
              onCreated={(opts) => {
                setView('market');
                handleActionComplete({ keepView: true, ...opts });
              }}
            />
          )}

          {user && view === 'detail' && selectedCoin && (
            <CoinDetail
              symbol={selectedCoin}
              onBack={() => setView('market')}
              onActionComplete={handleActionComplete}
            />
          )}

          {user && view === 'portfolio' && (
            <Portfolio onActionComplete={handleActionComplete} />
          )}

          {user && view === 'leaderboard' && (
            <Leaderboard />
          )}

          {user && view === 'settings' && (
            <Settings />
          )}

          {user && user.is_admin && view === 'admin' && (
            <AdminPanel onActionComplete={handleActionComplete} />
          )}

          {user && view === 'promos' && (
            <Promocodes onActionComplete={handleActionComplete} />
          )}

          {user && view === 'gambling' && (
            <Gambling onBack={() => setView('market')} onActionComplete={handleActionComplete} />
          )}

          {user && view === 'hopium' && (
            <Hopium onActionComplete={handleActionComplete} />
          )}

          {user && view === 'news' && (
            <News />
          )}

          {user && view === 'treemap' && (
            <Treemap />
          )}

          {user && view === 'notifications' && (
            <Notifications />
          )}

          {user && view === 'apikeys' && (
            <ApiKeyPanel />
          )}
        </main>

        <footer className="app-footer">
          <small>{t('footer')}</small>
        </footer>
      </div>
    </div>
  );
}

function CountdownUnit({ value, label }) {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: '8px'
    }}>
      <div style={{
        fontSize: '36px',
        fontWeight: '800',
        color: '#f1f5f9',
        padding: '16px',
        background: 'rgba(255,255,255,0.05)',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: '12px',
        minWidth: '80px',
        animation: 'pulse 2s ease-in-out infinite'
      }}>
        {String(value).padStart(2, '0')}
      </div>
      <div style={{
        fontSize: '12px',
        fontWeight: '600',
        color: '#64748b',
        textTransform: 'uppercase',
        letterSpacing: '0.5px'
      }}>
        {label}
      </div>
    </div>
  );
}

function MoneyAnim({ amount = 0, type = 'down' }) {
  const sign = type === 'up' ? '+' : '-';
  const cls = type === 'up' ? 'money-up' : 'money-down';
  return (
    <div className={`money-anim ${cls}`}>
      {sign}${Number(Math.abs(amount)).toFixed(2)}
    </div>
  );
}
