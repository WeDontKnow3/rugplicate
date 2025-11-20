import React, { useEffect, useState } from 'react';
import * as api from '../api';
import { useTranslation } from 'react-i18next';

export default function AdminPanel() {
  const { t } = useTranslation();
  const [me, setMe] = useState(null);
  const [tab, setTab] = useState('users');
  const [promoForm, setPromoForm] = useState({ code: '', amount: '', maxUses: 0, perUserLimit: 1, expiresAt: '' });
  const [adminPromos, setAdminPromos] = useState([]);
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
      setDbText('// ' + t('errorFetchingDB') + ': ' + (r && r.error ? r.error : 'unknown'));
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

  if (!me) return <div className="page"><div className="card">{t('loading')}</div></div>;
  if (!me.is_admin) return <div className="page"><div className="card" style={{color:'#fda4af'}}>{t('accessDenied')}</div></div>;

  async function toggleBan(user) {
    const confirmMsg = user.is_banned ? t('unbanUser', { user: user.username }) : t('banUser', { user: user.username });
    if (!window.confirm(confirmMsg)) return;
    setLoading(true); setMsg('');
    const r = await api.adminBanUser(user.id, !user.is_banned);
    if (r && r.ok) {
      setMsg(t('userUpdated', { user: user.username }));
      await loadUsers();
    } else setMsg(r && r.error ? r.error : t('error'));
    setLoading(false);
  }

  async function editUserBalance(user) {
    const newBalance = window.prompt(t('enterNewBalance', { user: user.username }), String(user.usd_balance || 0));
    if (newBalance === null) return;
    const balance = Number(newBalance);
    if (isNaN(balance) || balance < 0) {
      setMsg(t('invalidBalance'));
      return;
    }
    setLoading(true); setMsg('');
    const r = await api.adminUpdateUserBalance(user.id, balance);
    if (r && r.ok) {
      setMsg(t('balanceUpdated', { user: user.username }));
      await loadUsers();
    } else setMsg(r && r.error ? r.error : t('error'));
    setLoading(false);
  }

  async function deleteUser(user) {
    if (!window.confirm(t('deleteUserConfirm', { user: user.username }))) return;
    setLoading(true); setMsg('');
    const r = await api.adminDeleteUser(user.id);
    if (r && r.ok) {
      setMsg(t('userDeleted', { user: user.username }));
      await loadUsers();
    } else setMsg(r && r.error ? r.error : t('error'));
    setLoading(false);
  }

  async function deleteCoin(coin) {
    if (!window.confirm(t('deleteCoinConfirm', { symbol: coin.symbol }))) return;
    setLoading(true); setMsg('');
    const r = await api.adminDeleteCoin(coin.id);
    if (r && r.ok) {
      setMsg(t('coinDeleted', { symbol: coin.symbol }));
      await loadCoins();
    } else setMsg(r && r.error ? r.error : t('error'));
    setLoading(false);
  }

  async function editCoin(coin) {
    const newName = window.prompt(t('newCoinName', { symbol: coin.symbol }), coin.name || '');
    if (newName === null) return;
    const newPoolBase = window.prompt(t('enterPoolBase'), String(coin.pool_base || 0));
    if (newPoolBase === null) return;

    setLoading(true); setMsg('');
    const patch = { name: newName, pool_base: Number(newPoolBase) };
    const r = await api.adminUpdateCoin(coin.id, patch);

    if (r && r.ok) {
      setMsg(t('coinUpdated', { symbol: coin.symbol }));
      await loadCoins();
    } else setMsg(r && r.error ? r.error : t('error'));
    setLoading(false);
  }

  async function saveDb() {
    if (!window.confirm(t('replaceDBConfirm'))) return;
    setLoading(true); setMsg('');
    let payload;
    try {
      payload = JSON.parse(dbText);
    } catch (e) {
      setMsg(t('invalidJSON') + ': ' + e.message);
      setLoading(false);
      return;
    }
    const r = await api.adminReplaceDB(payload);

    if (r && r.ok) {
      setMsg(t('dbReplaced'));
      await loadUsers();
      await loadCoins();
      await loadDB();
    } else setMsg(r && r.error ? r.error : t('error'));
    setLoading(false);
  }

  return (
    <div className="page">
      <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10}}>
        <h2 style={{margin:0}}>{t('adminPanel')}</h2>
        <div style={{fontSize:13, color:'#bfc7d6'}}>{t('admin')}: {me.username}</div>
      </div>

      <div style={{display:'flex', gap:8, marginBottom:10}}>
        <button className={`nav-btn ${tab==='users'?'active':''}`} onClick={()=>setTab('users')}>{t('users')}</button>
        <button className={`nav-btn ${tab==='coins'?'active':''}`} onClick={()=>setTab('coins')}>{t('coins')}</button>
        <button className={`nav-btn ${tab==='db'?'active':''}`} onClick={()=>setTab('db')}>{t('dbEditor')}</button>
      </div>

      {msg && <div className="msg" style={{marginBottom:12}}>{msg}</div>}
      {loading && <div className="muted" style={{marginBottom:12}}>{t('processing')}</div>}

      {tab === 'users' && (
        <div className="card">
          <h3>{t('users')} ({users.length})</h3>
          <div style={{display:'flex', flexDirection:'column', gap:8}}>
            {users.map(u => (
              <div key={u.id} style={{display:'flex', alignItems:'center', justifyContent:'space-between', gap:12, padding:'8px 0', borderBottom:'1px solid rgba(255,255,255,0.02)'}}>
                <div>
                  <div style={{fontWeight:800}}>
                    {u.username} {u.is_admin ? <span className="muted" style={{fontSize:12}}> ({t('admin')})</span> : null}
                  </div>
                  <div className="muted" style={{fontSize:13}}>
                    id: {u.id} • $ {Number(u.usd_balance).toFixed(2)} • {t('banned')}: {u.is_banned ? t('yes') : t('no')}
                  </div>
                </div>
                <div style={{display:'flex', gap:8}}>
                  <button className="btn" onClick={()=>editUserBalance(u)}>{t('editBalance')}</button>
                  <button className="btn" onClick={()=>toggleBan(u)}>{u.is_banned ? t('unban') : t('ban')}</button>
                  <button className="btn ghost" onClick={()=>deleteUser(u)}>{t('delete')}</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 'coins' && (
        <div className="card">
          <h3>{t('coins')} ({coins.length})</h3>
          <div style={{display:'flex', flexDirection:'column', gap:8}}>
            {coins.map(c => (
              <div key={c.id} style={{display:'flex', alignItems:'center', justifyContent:'space-between', gap:12, padding:'8px 0', borderBottom:'1px solid rgba(255,255,255,0.02)'}}>
                <div>
                  <div style={{fontWeight:800}}>{c.symbol} • {c.name}</div>
                  <div className="muted" style={{fontSize:13}}>id: {c.id} • {t('price')}: {c.pool_token ? (c.pool_base / c.pool_token).toFixed(8) : '—'}</div>
                </div>
                <div style={{display:'flex', gap:8}}>
                  <button className="btn" onClick={()=>editCoin(c)}>{t('edit')}</button>
                  <button className="btn ghost" onClick={()=>deleteCoin(c)}>{t('delete')}</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 'db' && (
        <div className="card">
          <h3>{t('dbEditor')}</h3>
          <p className="muted">{t('editingRawDBWarning')}</p>
          <textarea value={dbText} onChange={e=>setDbText(e.target.value)} style={{width:'100%', height:360, fontFamily:'monospace', fontSize:13, marginTop:8}} />
          <div style={{display:'flex', gap:8, marginTop:8}}>
            <button className="btn" onClick={saveDb} disabled={loading}>{t('saveDB')}</button>
            <button className="btn ghost" onClick={loadDB} disabled={loading}>{t('reload')}</button>
          </div>
        </div>
      )}
    </div>
  );
}
