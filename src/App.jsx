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
import Gambling from './components/Gambling';

let animId = 1;

export default function App() {
  const [user, setUser] = useState(null);
  const [view, setView] = useState('market');
  const [selectedCoin, setSelectedCoin] = useState(null);
  const [balance, setBalance] = useState(null);
  const [moneyAnims, setMoneyAnims] = useState([]);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [dailyStatus, setDailyStatus] = useState(null);
  const [claimingDaily, setClaimingDaily] = useState(false);

  async function loadMe() {
    try {
      const res = await api.getMe();
      if (res && res.user) {
        setUser(res.user);
        setBalance(Number(res.user.usd_balance));
      } else {
        setUser(null);
        setBalance(null);
      }
    } catch (err) {
      setUser(null);
      setBalance(null);
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
    loadMe();
  }, []);

  useEffect(() => {
    if (user) {
      loadDailyStatus();
    }
  }, [user]);

  function onLogin(token) {
    if (token) {
      localStorage.setItem('token', token);
      loadMe();
    }
  }

  function onLogout() {
    localStorage.removeItem('token');
    setUser(null);
    setBalance(null);
    setView('market');
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
    if (!seconds || seconds <= 0) return 'Ready!';
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
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
            aria-label="Toggle menu"
          >
            <span></span>
            <span></span>
            <span></span>
          </button>

          <div className="topbar-center">
            <h1 className="page-title">
              {view === 'market' && 'Market'}
              {view === 'portfolio' && 'Portfolio'}
              {view === 'dashboard' && 'Dashboard'}
              {view === 'create' && 'Create Coin'}
              {view === 'detail' && (selectedCoin ? `Coin: ${selectedCoin}` : 'Coin')}
              {view === 'leaderboard' && 'Leaderboard'}
              {view === 'settings' && 'Settings'}
              {view === 'admin' && 'Admin Panel'}
              {view === 'promos' && 'Promos'}
              {view === 'gambling' && 'Gambling — IMPORTANT'}
            </h1>
          </div>

          <div className="topbar-right">
            {user && dailyStatus && (
              <button
                className={`daily-reward-btn ${dailyStatus.can_claim ? 'ready' : 'waiting'}`}
                onClick={handleClaimDaily}
                disabled={!dailyStatus.can_claim || claimingDaily}
                title={dailyStatus.can_claim ? 'Claim your daily reward!' : `Next reward in ${formatTimeRemaining(dailyStatus.seconds_until_next)}`}
              >
                <span className="daily-icon">🎁</span>
                <span className="daily-text">
                  {dailyStatus.can_claim ? 'Claim Daily' : formatTimeRemaining(dailyStatus.seconds_until_next)}
                </span>
              </button>
            )}

            {user && (
              <button className="logout-btn-topbar" onClick={onLogout} title="Logout">
                <span className="logout-icon">⎋</span>
                <span className="logout-text">Logout</span>
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

          {user && view === 'gambling' && (
            <Gambling onBack={() => setView('market')} onActionComplete={handleActionComplete} />
          )}
        </main>

        <footer className="app-footer">
          <small>by zt01 - discord community soon.</small>
        </footer>
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
