import React, { useEffect, useState } from 'react';
import * as api from '../api';
import { useTranslation } from 'react-i18next';

export default function AdminPanel() {
  const { t } = useTranslation();
  const [me, setMe] = useState(null);
  const [tab, setTab] = useState('users'); 
  const [users, setUsers] = useState([]);
  const [coins, setCoins] = useState([]);
  const [dbText, setDbText] = useState('');
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(false);
  const [promoForm, setPromoForm] = useState({ code: '', amount: '', maxUses: 0, perUserLimit: 1, expiresAt: '', showPublic: true });
  const [adminPromos, setAdminPromos] = useState([]);
  const [notifForm, setNotifForm] = useState({ title: '', message: '', type: 'admin' });

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

  async function loadAdminPromos() {
    const r = await api.adminListPromoCodes();
    if (r && r.promos) setAdminPromos(r.promos);
    else setAdminPromos([]);
  }

  useEffect(() => {
    loadMe();
    loadUsers();
    loadCoins();
    loadAdminPromos();
  }, []);

  useEffect(() => {
    if (tab === 'db') loadDB();
  }, [tab]);

  useEffect(() => {
    if (tab === 'promos') loadAdminPromos();
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

  async function createPromo(e) {
    e.preventDefault();
    if (!promoForm.code || !promoForm.amount) {
      setMsg('Code and amount are required');
      return;
    }
    setLoading(true);
    setMsg('');
    const payload = {
      code: promoForm.code,
      amount: Number(promoForm.amount),
      maxUses: Number(promoForm.maxUses) || 0,
      perUserLimit: Number(promoForm.perUserLimit) || 1,
      expiresAt: promoForm.expiresAt || null,
      showPublic: !!promoForm.showPublic
    };
    const r = await api.createPromoCode(payload);
    if (r && r.ok) {
      setMsg('Promocode created successfully');
      setPromoForm({ code: '', amount: '', maxUses: 0, perUserLimit: 1, expiresAt: '', showPublic: true });
      await loadAdminPromos();
    } else {
      setMsg(r && r.error ? r.error : 'Failed to create promocode');
    }
    setLoading(false);
  }

  async function togglePromoVisibility(promo) {
    setLoading(true);
    setMsg('');
    const r = await api.adminUpdatePromoCode(promo.id, { show_public: !promo.show_public });
    if (r && r.ok) {
      setMsg(`Promocode ${promo.code} visibility updated`);
      await loadAdminPromos();
    } else {
      setMsg(r && r.error ? r.error : 'Failed to update promocode');
    }
    setLoading(false);
  }

  async function sendNotification(e) {
    e.preventDefault();
    if (!notifForm.title || !notifForm.message) {
      setMsg('Title and message are required');
      return;
    }
    setLoading(true);
    setMsg('');
    const r = await api.adminSendGlobalNotification(notifForm);
    if (r && r.ok) {
      setMsg(`Global notification sent to ${r.sent_count || 0} users`);
      setNotifForm({ title: '', message: '', type: 'admin' });
    } else {
      setMsg(r && r.error ? r.error : 'Failed to send notification');
    }
    setLoading(false);
  }

  return (
    <div className="page">
      <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10}}>
        <h2 style={{margin:0}}>{t('adminPanel')}</h2>
        <div style={{fontSize:13, color:'#bfc7d6'}}>{t('admin')}: {me.username}</div>
      </div>

      <div style={{display:'flex', gap:8, marginBottom:10, flexWrap:'wrap'}}>
        <button className={`nav-btn ${tab==='users'?'active':''}`} onClick={()=>setTab('users')}>{t('users')}</button>
        <button className={`nav-btn ${tab==='coins'?'active':''}`} onClick={()=>setTab('coins')}>{t('coins')}</button>
        <button className={`nav-btn ${tab==='db'?'active':''}`} onClick={()=>setTab('db')}>{t('dbEditor')}</button>
        <button className={`nav-btn ${tab==='promos'?'active':''}`} onClick={()=>setTab('promos')}>Promocodes</button>
        <button className={`nav-btn ${tab==='notifications'?'active':''}`} onClick={()=>setTab('notifications')}>Notifications</button>
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

      {tab === 'promos' && (
        <div className="card">
          <h3>Create Promocode</h3>
          <form onSubmit={createPromo} style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 12 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <input
                type="text"
                placeholder="Code (e.g., WELCOME100)"
                value={promoForm.code}
                onChange={e => setPromoForm({ ...promoForm, code: e.target.value.toUpperCase() })}
                style={{ padding: '8px 12px' }}
                required
              />
              <input
                type="number"
                placeholder="Amount ($)"
                value={promoForm.amount}
                onChange={e => setPromoForm({ ...promoForm, amount: e.target.value })}
                style={{ padding: '8px 12px' }}
                min="0.01"
                step="0.01"
                required
              />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <input
                type="number"
                placeholder="Max uses (0 = unlimited)"
                value={promoForm.maxUses}
                onChange={e => setPromoForm({ ...promoForm, maxUses: e.target.value })}
                style={{ padding: '8px 12px' }}
                min="0"
              />
              <input
                type="number"
                placeholder="Per user limit"
                value={promoForm.perUserLimit}
                onChange={e => setPromoForm({ ...promoForm, perUserLimit: e.target.value })}
                style={{ padding: '8px 12px' }}
                min="1"
              />
            </div>
            <input
              type="datetime-local"
              placeholder="Expires at (optional)"
              value={promoForm.expiresAt}
              onChange={e => setPromoForm({ ...promoForm, expiresAt: e.target.value })}
              style={{ padding: '8px 12px' }}
            />
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={promoForm.showPublic}
                onChange={e => setPromoForm({ ...promoForm, showPublic: e.target.checked })}
                style={{ width: 18, height: 18, cursor: 'pointer' }}
              />
              <span>Show in public promocodes page</span>
            </label>
            <button type="submit" className="btn" disabled={loading}>
              Create Promocode
            </button>
          </form>

          <div style={{ marginTop: 32 }}>
            <h3>All Promocodes ({adminPromos.length})</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 12 }}>
              {adminPromos.map(p => (
                <div key={p.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.02)' }}>
                  <div>
                    <div style={{ fontWeight: 800 }}>
                      {p.code}
                      {!p.active && <span className="muted" style={{ fontSize: 12 }}> (inactive)</span>}
                      {p.show_public && <span style={{ fontSize: 12, color: '#86efac', marginLeft: 8 }}>👁 Public</span>}
                      {!p.show_public && <span style={{ fontSize: 12, color: '#94a3b8', marginLeft: 8 }}>🔒 Hidden</span>}
                    </div>
                    <div className="muted" style={{ fontSize: 13 }}>
                      ${p.amount} • {p.used_count}/{p.max_uses || '∞'} used • {p.per_user_limit}/user
                      {p.expires_at && ` • expires ${new Date(p.expires_at).toLocaleDateString()}`}
                    </div>
                  </div>
                  <button 
                    className="btn" 
                    onClick={() => togglePromoVisibility(p)}
                    disabled={loading}
                  >
                    {p.show_public ? 'Hide' : 'Show'}
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {tab === 'notifications' && (
        <div className="card">
          <h3>Send Global Notification</h3>
          <p className="muted" style={{ marginBottom: 12 }}>
            Send a notification to all users. This will appear in their notifications page.
          </p>
          <form onSubmit={sendNotification} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <input
              type="text"
              placeholder="Notification Title"
              value={notifForm.title}
              onChange={e => setNotifForm({ ...notifForm, title: e.target.value })}
              style={{ padding: '10px 12px' }}
              maxLength={100}
              required
            />
            <textarea
              placeholder="Notification Message"
              value={notifForm.message}
              onChange={e => setNotifForm({ ...notifForm, message: e.target.value })}
              style={{ padding: '10px 12px', minHeight: 120, fontFamily: 'inherit', resize: 'vertical' }}
              maxLength={500}
              required
            />
            <select
              value={notifForm.type}
              onChange={e => setNotifForm({ ...notifForm, type: e.target.value })}
              style={{ padding: '10px 12px' }}
            >
              <option value="admin">Admin Announcement 📢</option>
              <option value="system">System Update ⚙️</option>
              <option value="promo">Promotion 🎁</option>
            </select>
            <button type="submit" className="btn" disabled={loading}>
              Send to All Users
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
