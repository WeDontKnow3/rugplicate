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

let animId = 1;

export default function App() {
  const [user, setUser] = useState(null);
  const [view, setView] = useState('market'); // market | dashboard | create | detail | portfolio | leaderboard | admin
  const [selectedCoin, setSelectedCoin] = useState(null);
  const [balance, setBalance] = useState(null);
  const [moneyAnims, setMoneyAnims] = useState([]); // {id, amount, type}
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // Carrega perfil (user + balance)
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

  useEffect(() => { loadMe(); }, []);

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

  // trigger money animation: type = 'up' (gain) | 'down' (spend)
  function triggerMoneyAnimation(amount = 0, type = 'down') {
    const id = animId++;
    const entry = { id, amount: Number(amount), type };
    setMoneyAnims(a => [...a, entry]);
    // remove after 1100ms
    setTimeout(() => {
      setMoneyAnims(a => a.filter(x => x.id !== id));
    }, 1100);
  }

  // função passada para filhos — quando eles fazem trade/ações, chamam essa função
  // accepts { keepView, animate: { amount, type } }
  async function handleActionComplete(opts = {}) {
    if (opts.animate) {
      triggerMoneyAnimation(opts.animate.amount, opts.animate.type);
    }
    await loadMe();
    if (!opts.keepView) setView('market');
  }

  // navigation helper
  function handleNavigate(v) {
    setView(v);
    if (window.innerWidth < 900) setSidebarOpen(false); // auto-close on mobile
  }

  return (
    <div className="app-wrapper">
      {/* SIDEBAR usando componente separado */}
      <Sidebar 
        view={view} 
        onNavigate={handleNavigate} 
        onLogout={onLogout}
        open={sidebarOpen}
        setOpen={setSidebarOpen}
      />

      {/* MAIN CONTENT */}
      <div className="main-content">
        {/* TOPBAR */}
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
              {view === 'market' && '📈 Market'}
              {view === 'portfolio' && '💼 Portfolio'}
              {view === 'dashboard' && '📊 Dashboard'}
              {view === 'create' && '➕ Create Coin'}
              {view === 'detail' && `🪙 ${selectedCoin}`}
              {view === 'leaderboard' && '🏆 Leaderboard'}
              {view === 'settings' && '⚙️ Settings'}
              {view === 'admin' && '⚙️ Admin Panel'}
              {view === 'promos' && '🎁 Promos'}
            </h1>
          </div>

          <div className="topbar-right">
            <div className="header-balance">
              {user ? `${Number(balance || 0).toFixed(2)}` : '—'}
            </div>

            {/* Botão de Logout */}
            {user && (
              <button className="logout-btn-topbar" onClick={onLogout} title="Logout">
                <span className="logout-icon">🚪</span>
                <span className="logout-text">Logout</span>
              </button>
            )}

            {/* Money animation container */}
            <div className="money-anim-container">
              {moneyAnims.map(a => (
                <MoneyAnim key={a.id} amount={a.amount} type={a.type} />
              ))}
            </div>
          </div>
        </header>

        {/* PAGE CONTENT */}
        <main className="page-content">
          {!user && <Auth onLogin={onLogin} />}
          
          {user && view === 'market' && (
            <Market
              onOpenCoin={(s)=>{ setSelectedCoin(s); setView('detail'); }}
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
        </main>

        {/* FOOTER */}
        <footer className="app-footer">
          <small>Simulador educacional — não use com dinheiro real.</small>
        </footer>
      </div>
    </div>
  );
}

// Money animation component
function MoneyAnim({ amount = 0, type = 'down' }) {
  const sign = type === 'up' ? '+' : '-';
  const cls = type === 'up' ? 'money-up' : 'money-down';
  return (
    <div className={`money-anim ${cls}`}>
      {sign}${Number(Math.abs(amount)).toFixed(2)}
    </div>
  );
}
