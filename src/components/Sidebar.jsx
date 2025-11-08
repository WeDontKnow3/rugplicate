import React, { useEffect, useState, useRef } from 'react';
import * as api from '../api';

/**
 * Sidebar.jsx
 *
 * Props:
 * - view: current view string (e.g. 'market', 'portfolio', 'leaderboard', 'admin', 'create')
 * - onNavigate(view) : function called when a nav item is clicked
 * - onLogout() : optional callback when user logs out
 */
export default function Sidebar({ view, onNavigate, onLogout, open, setOpen }) {
  const [me, setMe] = useState(null);
  const [loadingMe, setLoadingMe] = useState(false);
  const [balanceAnim, setBalanceAnim] = useState(null); // 'up'|'down'|null
  const prevBalanceRef = useRef(null);
  const pollRef = useRef(null);

  // helper navigate fallback
  function navigate(to) {
    if (onNavigate && typeof onNavigate === 'function') {
      onNavigate(to);
    } else {
      window.location.hash = '#' + to;
    }
    // close on mobile
    if (window.innerWidth < 900) {
      setOpen(false);
    }
  }

  // fetch profile once and then poll
  async function fetchMe() {
    setLoadingMe(true);
    try {
      const r = await api.getMe();
      if (r && r.user) {
        const prev = prevBalanceRef.current;
        const nowBal = Number(r.user.usd_balance || 0);
        if (prev != null && nowBal !== prev) {
          setBalanceAnim(nowBal > prev ? 'up' : 'down');
          // remove animation after 1.2s
          setTimeout(() => setBalanceAnim(null), 1200);
        }
        prevBalanceRef.current = nowBal;
        setMe(r.user);
      } else {
        setMe(null);
      }
    } catch (e) {
      // ignore network errors silently
    } finally {
      setLoadingMe(false);
    }
  }

  useEffect(() => {
    // initial load
    fetchMe();
    
    // poll only when tab is visible
    function handleVisibility() {
      if (pollRef.current) clearInterval(pollRef.current);
      
      if (!document.hidden) {
        pollRef.current = setInterval(fetchMe, 5000); // 5 segundos
      }
    }
    
    document.addEventListener('visibilitychange', handleVisibility);
    handleVisibility(); // start polling
    
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // compute total tokens count
  const tokensCount = (me && Array.isArray(me.tokens)) ? me.tokens.reduce((s,t)=>s+Number(t.amount||0), 0) : 0;

  // small helper to format money
  function fmtUSD(n) {
    try {
      return Number(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    } catch (e) {
      return Number(n).toFixed(2);
    }
  }

  // logout handler: clears token and calls optional prop
  function handleLogout() {
    localStorage.removeItem('token');
    if (onLogout && typeof onLogout === 'function') onLogout();
    else window.location.reload();
  }

  return (
    <>
      {/* Overlay shown on mobile when sidebar open */}
      <div 
        className={`sidebar-overlay ${open ? 'visible' : ''}`} 
        onClick={()=>setOpen(false)} 
        style={{ display: window.innerWidth < 900 && open ? 'block' : 'none' }}
      />

      <aside className={`sidebar ${open ? 'open' : 'closed'}`} aria-expanded={open}>
        <div className="sidebar-top">
          <div className="logo">CS</div>
          <div className="sidebar-title">
            <div className="header-title">Rugplicate</div>
            <div className="header-sub">by zt01</div>
          </div>
        </div>

        <nav className="sidebar-nav">
          <NavItem active={view==='market'} label="Market" onClick={()=>navigate('market')} icon="📈" />
          <NavItem active={view==='portfolio'} label="Portfolio" onClick={()=>navigate('portfolio')} icon="💼" />
          <NavItem active={view==='dashboard'} label="Dashboard" onClick={()=>navigate('dashboard')} icon="📊" />
          <NavItem active={view==='create'} label="Create Coin" onClick={()=>navigate('create')} icon="➕" />
          <NavItem active={view==='leaderboard'} label="Leaderboard" onClick={()=>navigate('leaderboard')} icon="🏆" />
          <NavItem active={view==='settings'} label="Settings" onClick={()=>navigate('settings')} icon="⚙️" />
          
          {/* Admin Panel - só aparece se is_admin = true */}
          {me && me.is_admin && (
            <NavItem 
              active={view==='admin'} 
              label="Admin Panel" 
              onClick={()=>navigate('admin')} 
              icon="👑"
              className="admin-item"
            />
          )}
        </nav>

        <div className="sidebar-bottom">
          {me ? (
            <>
              {/* LOGOUT ACIMA DO USER - ordem invertida */}
              <button className="logout-btn" onClick={handleLogout}>
                <span className="nav-icon">🚪</span>
                <span className="nav-label">Logout</span>
              </button>

              <div className="sidebar-user">
                <div className="user-avatar">{me.username ? me.username[0].toUpperCase() : '?'}</div>
                <div className="user-info">
                  <div className="user-name">{me.username}</div>
                  <div className="user-balance">
                    <span className={balanceAnim ? `balance-anim anim-${balanceAnim}` : ''}>
                      ${me ? fmtUSD(me.usd_balance || 0) : '0.00'}
                    </span>
                  </div>
                  {me.is_admin && <div className="user-badge">👑 Admin</div>}
                </div>
              </div>

              <div className="tokens-info">
                <div className="tokens-label">Tokens</div>
                <div className="tokens-value">{ Intl.NumberFormat().format(tokensCount) }</div>
              </div>
            </>
          ) : (
            <div className="sidebar-login-msg">
              <p>{loadingMe ? 'Carregando...' : 'Login to trade and create coins'}</p>
            </div>
          )}
        </div>
      </aside>
    </>
  );
}

/* ---------- NavItem component ---------- */
function NavItem({ active, label, onClick, icon, className = '' }) {
  return (
    <button
      className={`nav-item ${active ? 'active' : ''} ${className}`}
      onClick={onClick}
    >
      <span className="nav-icon">{icon}</span>
      <span className="nav-label">{label}</span>
    </button>
  );
}
