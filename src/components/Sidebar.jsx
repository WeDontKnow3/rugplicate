/* ---------- inline SVG icons ---------- */
function MarketIcon(){ return (<svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M3 3v18h18" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"></path><path d="M7 13l3-4 4 6 3-8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"></path></svg>); }
function PortfolioIcon(){ return (<svg width="18" height="18" viewBox="0 0 24 24" fill="none"><rect x="3" y="7" width="18" height="13" rx="2" stroke="currentColor" strokeWidth="1.5"/><path d="M7 7V5a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>); }
function DashboardIcon(){ return (<svg width="18" height="18" viewBox="0 0 24 24" fill="none"><rect x="3" y="3" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="1.5"/><rect x="14" y="3" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="1.5"/><rect x="3" y="14" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="1.5"/><rect x="14" y="14" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="1.5"/></svg>); }
function CreateIcon(){ return (<svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>); }
function LeaderboardIcon(){ return (<svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M8 21V11M12 21V3M16 21v-7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>); }
function SettingsIcon(){ return (<svg width="18" height="18" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.5"/><path d="M12 2v2m0 16v2M4.93import React, { useEffect, useState, useRef } from 'react';
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
            <div className="header-title">CoinSim</div>
            <div className="header-sub">AMM Simulator</div>
          </div>
        </div>

        <nav className="sidebar-nav">
          <NavItem active={view==='market'} label="Market" onClick={()=>navigate('market')} icon={MarketIcon} />
          <NavItem active={view==='portfolio'} label="Portfolio" onClick={()=>navigate('portfolio')} icon={PortfolioIcon} />
          <NavItem active={view==='dashboard'} label="Dashboard" onClick={()=>navigate('dashboard')} icon={DashboardIcon} />
          <NavItem active={view==='create'} label="Create Coin" onClick={()=>navigate('create')} icon={CreateIcon} />
          <NavItem active={view==='leaderboard'} label="Leaderboard" onClick={()=>navigate('leaderboard')} icon={LeaderboardIcon} />
          <NavItem active={view==='settings'} label="Settings" onClick={()=>navigate('settings')} icon={SettingsIcon} />
          
          {/* Admin Panel - só aparece se is_admin = true */}
          {me && me.is_admin && (
            <NavItem 
              active={view==='admin'} 
              label="Admin Panel" 
              onClick={()=>navigate('admin')} 
              icon={AdminIcon}
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

/* ---------- small components & icons ---------- */

function NavItem({ active, label, onClick, icon: Icon, className = '' }) {
  return (
    <button
      className={`nav-item ${active ? 'active' : ''} ${className}`}
      onClick={onClick}
    >
      <span className="nav-icon">{ Icon ? <Icon /> : null }</span>
      <span className="nav-label">{label}</span>
    </button>
  );
}

/* ---------- inline SVG icons ---------- */
function MarketIcon(){ return (<svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M3 3v18h18" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"></path><path d="M7 13l3-4 4 6 3-8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"></path></svg>); }
function PortfolioIcon(){ return (<svg width="18" height="18" viewBox="0 0 24 24" fill="none"><rect x="3" y="7" width="18" height="13" rx="2" stroke="currentColor" strokeWidth="1.5"/><path d="M7 7V5a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>); }
function DashboardIcon(){ return (<svg width="18" height="18" viewBox="0 0 24 24" fill="none"><rect x="3" y="3" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="1.5"/><rect x="14" y="3" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="1.5"/><rect x="3" y="14" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="1.5"/><rect x="14" y="14" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="1.5"/></svg>); }
function CreateIcon(){ return (<svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>); }
function LeaderboardIcon(){ return (<svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M8 21V11M12 21V3M16 21v-7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>); }
function GiftIcon(){ return (<svg width="18" height="18" viewBox="0 0 24 24" fill="none"><rect x="3" y="7" width="18" height="5" stroke="currentColor" strokeWidth="1.4"/><path d="M12 7v10" stroke="currentColor" strokeWidth="1.4"/><path d="M7 7a3 3 0 0 1 5-2 3 3 0 0 1 5 2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg>); }
function SettingsIcon(){ return (<svg width="18" height="18" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.5"/><path d="M12 2v2m0 16v2M4.93 4.93l1.41 1.41m11.32 11.32l1.41 1.41M2 12h2m16 0h2M4.93 19.07l1.41-1.41m11.32-11.32l1.41-1.41" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>); }
function AdminIcon(){ return (<svg width="18" height="18" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.5"/><path d="M12 2v2m0 16v2M4.93 4.93l1.41 1.41m11.32 11.32l1.41 1.41M2 12h2m16 0h2M4.93 19.07l1.41-1.41m11.32-11.32l1.41-1.41" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>); }
