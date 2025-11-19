import React, { useEffect, useState } from 'react';
import * as api from '../api';
import { useTranslation } from 'react-i18next';

export default function AdminPanel() {
  const { t } = useTranslation();
  const [me, setMe] = useState(null);
  const [tab, setTab] = useState('users'); // 'users' | 'coins' | 'db'
  const [users, setUsers] = useState([]);
  const [coins, setCoins] = useState([]);
  const [dbText, setDbText] = useState('');
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(false);

  async function loadMe() {
    const r = await api.getMe();
    if (r && r.user) setMe(r.user);
    else setMe(null);
  }

  async function loadUsers() {
    const r = await api.adminListUsers();
    if (r && r.users) setUsers(r.users);
    else setUsers([]);
  }

  async function loadCoins() {
    const r = await api.adminListCoins();
    if (r && r.coins) setCoins(r.coins);
    else setCoins([]);
  }

  async function loadDB() {
    const r = await api.adminGetDB();
    if (r && r.db) {
      setDbText(JSON.stringify(r.db, null, 2));
    } else {
      setDbText('// erro ao buscar DB: ' + (r && r.error ? r.error : 'unknown'));
    }
  }

  useEffect(() => {
    loadMe();
    loadUsers();
    loadCoins();
  }, []);

  useEffect(() => {
    if (tab === 'db') loadDB();
  }, [tab]);

  if (!me) return <div className="page"><div className="card">Loading...</div></div>;
  if (!me.is_admin) return <div className="page"><div className="card" style={{color:'#fda4af'}}>Access denied — admin only.</div></div>;

  async function toggleBan(user) {
    const confirmMsg = user.is_banned ? `Unban ${user.username}?` : `Ban ${user.username}?`;
    if (!window.confirm(confirmMsg)) return;
    setLoading(true); setMsg('');
    const r = await api.adminBanUser(user.id, !user.is_banned);
    if (r && r.ok) {
      setMsg(`User ${user.username} updated.`);
      await loadUsers();
    } else setMsg(r && r.error ? r.error : 'Erro');
    setLoading(false);
  }

  async function deleteUser(user) {
    if (!window.confirm(`Delete user ${user.username} and all their data? This cannot be undone.`)) return;
    setLoading(true); setMsg('');
    const r = await api.adminDeleteUser(user.id);
    if (r && r.ok) {
      setMsg(`User ${user.username} deleted.`);
      await loadUsers();
    } else setMsg(r && r.error ? r.error : 'Erro');
    setLoading(false);
  }

  async function deleteCoin(coin) {
    if (!window.confirm(`Delete coin ${coin.symbol}? This removes its transactions and user balances.`)) return;
    setLoading(true); setMsg('');
    const r = await api.adminDeleteCoin(coin.id);
    if (r && r.ok) {
      setMsg(`Coin ${coin.symbol} deleted.`);
      await loadCoins();
    } else setMsg(r && r.error ? r.error : 'Erro');
    setLoading(false);
  }

  async function editCoin(coin) {
    const newName = window.prompt('New name for coin ' + coin.symbol, coin.name || '');
    if (newName === null) return;
    const newPoolBase = window.prompt('pool_base (number)', String(coin.pool_base || 0));
    if (newPoolBase === null) return;
    setLoading(true); setMsg('');
    const patch = { name: newName, pool_base: Number(newPoolBase) };
    const r = await api.adminUpdateCoin(coin.id, patch);
    if (r && r.ok) {
      setMsg(`Coin ${coin.symbol} updated.`);
      await loadCoins();
    } else setMsg(r && r.error ? r.error : 'Erro');
    setLoading(false);
  }

  async function saveDb() {
    if (!window.confirm('Replace entire DB with this content? A backup will be created before replacing.')) return;
    setLoading(true); setMsg('');
    let payload;
    try {
      payload = JSON.parse(dbText);
    } catch (e) {
      setMsg('JSON inválido: ' + e.message);
      setLoading(false);
      return;
    }
    const r = await api.adminReplaceDB(payload);
    if (r && r.ok) {
      setMsg('DB replaced. Reloading lists...');
      await loadUsers();
      await loadCoins();
      await loadDB();
    } else setMsg(r && r.error ? r.error : 'Erro');
    setLoading(false);
  }

  return (
    <div className="page">
      <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10}}>
        <h2 style={{margin:0}}>Admin Panel</h2>
        <div style={{fontSize:13, color:'#bfc7d6'}}>Admin: {me.username}</div>
      </div>

      <div style={{display:'flex', gap:8, marginBottom:10}}>
        <button className={`nav-btn ${tab==='users'?'active':''}`} onClick={()=>setTab('users')}>Users</button>
        <button className={`nav-btn ${tab==='coins'?'active':''}`} onClick={()=>setTab('coins')}>Coins</button>
        <button className={`nav-btn ${tab==='db'?'active':''}`} onClick={()=>setTab('db')}>DB Editor</button>
      </div>

      {msg && <div className="msg" style={{marginBottom:12}}>{msg}</div>}
      {loading && <div className="muted" style={{marginBottom:12}}>Processing...</div>}

      {tab === 'users' && (
        <div className="card">
          <h3>Users ({users.length})</h3>
          <div style={{display:'flex', flexDirection:'column', gap:8}}>
            {users.map(u => (
              <div key={u.id} style={{display:'flex', alignItems:'center', justifyContent:'space-between', gap:12, padding:'8px 0', borderBottom:'1px solid rgba(255,255,255,0.02)'}}>
                <div>
                  <div style={{fontWeight:800}}>{u.username} {u.is_admin ? <span className="muted" style={{fontSize:12}}> (admin)</span> : null}</div>
                  <div className="muted" style={{fontSize:13}}>id: {u.id} • $ {Number(u.usd_balance).toFixed(2)} • banned: {u.is_banned ? 'yes' : 'no'}</div>
                </div>
                <div style={{display:'flex', gap:8}}>
                  <button className="btn" onClick={()=>toggleBan(u)}>{u.is_banned ? 'Unban' : 'Ban'}</button>
                  <button className="btn ghost" onClick={()=>deleteUser(u)}>Delete</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 'coins' && (
        <div className="card">
          <h3>Coins ({coins.length})</h3>
          <div style={{display:'flex', flexDirection:'column', gap:8}}>
            {coins.map(c => (
              <div key={c.id} style={{display:'flex', alignItems:'center', justifyContent:'space-between', gap:12, padding:'8px 0', borderBottom:'1px solid rgba(255,255,255,0.02)'}}>
                <div>
                  <div style={{fontWeight:800}}>{c.symbol} • {c.name}</div>
                  <div className="muted" style={{fontSize:13}}>id: {c.id} • price: {c.pool_token ? (c.pool_base / c.pool_token).toFixed(8) : '—'}</div>
                </div>
                <div style={{display:'flex', gap:8}}>
                  <button className="btn" onClick={()=>editCoin(c)}>Edit</button>
                  <button className="btn ghost" onClick={()=>deleteCoin(c)}>Delete</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 'db' && (
        <div className="card">
          <h3>DB Editor</h3>
          <p className="muted">Editing raw DB. Backup will be created automatically when you Save. Use with caution.</p>
          <textarea value={dbText} onChange={e=>setDbText(e.target.value)} style={{width:'100%', height:360, fontFamily:'monospace', fontSize:13, marginTop:8}} />
          <div style={{display:'flex', gap:8, marginTop:8}}>
            <button className="btn" onClick={saveDb} disabled={loading}>Save DB (backup)</button>
            <button className="btn ghost" onClick={loadDB} disabled={loading}>Reload</button>
          </div>
        </div>
      )}
    </div>
  );
}
