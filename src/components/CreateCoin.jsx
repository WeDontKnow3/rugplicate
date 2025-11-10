import React, { useEffect, useState } from 'react';
import * as api from '../api';

export default function CreateCoin({ onCreated }) {
  const [symbol, setSymbol] = useState('');
  const [name, setName] = useState('');
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(false);
  const [myBalance, setMyBalance] = useState(null);
  const [logoData, setLogoData] = useState(null); // data URL
  const [logoPreview, setLogoPreview] = useState(null);
  const REQUIRED = 1100.0;

  async function loadMe() {
    try {
      const r = await api.getMe();
      if (r && r.user) setMyBalance(Number(r.user.usd_balance));
      else {
        setMyBalance(null);
        console.warn('getMe returned invalid:', r);
      }
    } catch (e) {
      setMyBalance(null);
      console.error('getMe threw:', e);
    }
  }

  useEffect(() => { loadMe(); }, []);

  function handleFileChange(e) {
    const file = e.target.files && e.target.files[0];
    if (!file) {
      setLogoData(null);
      setLogoPreview(null);
      return;
    }
    // limit file size client-side (e.g. 1.5MB)
    if (file.size > 1.6 * 1024 * 1024) {
      setMsg('Arquivo muito grande. Tamanho máximo: 1.6MB');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setLogoData(reader.result); // data URL
      setLogoPreview(reader.result);
    };
    reader.onerror = (err) => {
      console.error('file read error', err);
      setMsg('Erro ao ler arquivo');
    };
    reader.readAsDataURL(file);
  }

  async function submit(e) {
    e.preventDefault();
    setMsg('');
    if (!symbol || !name) { setMsg('Preencha symbol e name'); return; }
    if (myBalance === null) { setMsg('Saldo desconhecido — recarregue (Refresh Balance) ou faça login de novo'); return; }
    if (myBalance < REQUIRED) { setMsg(`Saldo insuficiente: é necessário $${REQUIRED.toFixed(2)} para criar uma coin`); return; }

    setLoading(true);
    try {
      const payload = { symbol, name };
      if (logoData) payload.logoData = logoData;
      const res = await api.createCoin(payload);
      if (res && res.ok) {
        setMsg('Coin criada com preço inicial 0.000001 e 1,000,000,000 tokens na pool');
        setSymbol(''); setName(''); setLogoData(null); setLogoPreview(null);
        await loadMe();
        if (onCreated) onCreated({ animate: { amount: 1100.0, type: 'down' } });
      } else {
        console.error('createCoin error:', res);
        setMsg(res && res.error ? res.error : 'Erro ao criar coin (ver console)');
      }
    } catch (err) {
      console.error('createCoin threw:', err);
      setMsg('Erro de rede ao criar coin (ver console)');
    } finally {
      setLoading(false);
    }
  }

  const disabled = loading || (myBalance !== null && myBalance < REQUIRED);

  return (
    <div className="card">
      <h2>Create Coin</h2>
      <form onSubmit={submit}>
        <input placeholder="Symbol (e.g. ABC)" value={symbol} onChange={e=>setSymbol(e.target.value.toUpperCase())} required />
        <input placeholder="Name" value={name} onChange={e=>setName(e.target.value)} required />

        <div style={{marginTop:10, marginBottom:8}}>
          <label style={{fontSize:13, color:'#bfc7d6', display:'block', marginBottom:6}}>Logo (opcional — PNG/JPG/GIF/WebP, max ~1.6MB)</label>
          <div style={{display:'flex', gap:8, alignItems:'center'}}>
            <input type="file" accept="image/*" onChange={handleFileChange} />
            {logoPreview && (
              <img src={logoPreview} alt="preview" style={{width:48,height:48,objectFit:'cover',borderRadius:8,border:'1px solid rgba(255,255,255,0.06)'}} />
            )}
          </div>
        </div>

        <p style={{fontSize:12, color:'#bfc7d6'}}>
          All coins start at price <strong>0.000001</strong> and full supply (<strong>1,000,000,000</strong>) goes to the pool.
          Creating a coin costs <strong>$1,100</strong>.
        </p>

        <div style={{display:'flex', gap:8, alignItems:'center', marginTop:8}}>
          <button className="btn" type="submit" disabled={disabled}>{loading ? 'Creating...' : 'Create ($1,100)'}</button>
          <button type="button" className="btn ghost" onClick={loadMe}>Refresh Balance</button>
          <div style={{marginLeft:'auto', color:'#cbd5e1', fontSize:13}}>
            Balance: {myBalance === null ? '—' : `$${Number(myBalance).toFixed(2)}`}
          </div>
        </div>
      </form>
      {msg && <p className="msg">{msg}</p>}
      {myBalance !== null && myBalance < REQUIRED && <p className="msg">Saldo insuficiente: precisa de $1,100 para criar.</p>}
    </div>
  );
}
