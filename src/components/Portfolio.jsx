import React, { useEffect, useState } from 'react';
import * as api from '../api';
import { useTranslation } from 'react-i18next';

export default function Portfolio({ onActionComplete }) {
  const { t } = useTranslation();

  const [me, setMe] = useState(null);
  const [txs, setTxs] = useState([]);
  const [pnlData, setPnlData] = useState(null);
  const [sellAmounts, setSellAmounts] = useState({});
  const [msg, setMsg] = useState('');
  const [loadingSell, setLoadingSell] = useState(null);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [transferType, setTransferType] = useState('usd');
  const [transferAmount, setTransferAmount] = useState('');
  const [transferRecipient, setTransferRecipient] = useState('');
  const [transferSymbol, setTransferSymbol] = useState('');
  const [loadingTransfer, setLoadingTransfer] = useState(false);
  const [confirmSettings, setConfirmSettings] = useState({
    enabled: false,
    usd_threshold: 1000,
    percentage_threshold: 10,
    token_count_threshold: 100000
  });
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [pendingSale, setPendingSale] = useState(null);

  async function load() {
    setMsg('');
    try {
      const r = await api.getMe();
      if (r && r.user) setMe(r.user);
    } catch (e) {
      setMsg(t('errorGeneric'));
    }

    try {
      const tr = await api.getTransactions();
      setTxs(tr.transactions || []);
    } catch (_) {
      setTxs([]);
    }

    try {
      const pnl = await api.getPortfolioPnL();
      if (pnl && !pnl.error) {
        setPnlData(pnl);
      }
    } catch (_) {
      setPnlData(null);
    }

    try {
      const settingsRes = await api.getUserSettings();
      if (settingsRes && settingsRes.settings) {
        setConfirmSettings({
          enabled: settingsRes.settings.double_confirm_enabled || false,
          usd_threshold: settingsRes.settings.double_confirm_usd_threshold || 1000,
          percentage_threshold: settingsRes.settings.double_confirm_percentage_threshold || 10,
          token_count_threshold: settingsRes.settings.double_confirm_token_count_threshold || 100000
        });
      }
    } catch (_) {
      setConfirmSettings({
        enabled: false,
        usd_threshold: 1000,
        percentage_threshold: 10,
        token_count_threshold: 100000
      });
    }
  }

  useEffect(() => { load(); }, []);

  function shouldShowConfirmation(symbol, amount, tokenPrice) {
    if (!confirmSettings.enabled) return false;

    const token = me?.tokens?.find(t => t.symbol === symbol);
    if (!token) return false;

    const totalHoldings = Number(token.amount || 0);
    const sellAmount = Number(amount);
    const usdValue = sellAmount * tokenPrice;
    const percentage = (sellAmount / totalHoldings) * 100;

    return (
      usdValue >= confirmSettings.usd_threshold ||
      percentage >= confirmSettings.percentage_threshold ||
      sellAmount >= confirmSettings.token_count_threshold
    );
  }

  async function sell(symbol) {
    setMsg('');
    const amt = Number(sellAmounts[symbol] || 0);
    if (!amt || amt <= 0) {
      setMsg(t('invalidValue'));
      return;
    }

    const token = me?.tokens?.find(t => t.symbol === symbol);
    if (!token) {
      setMsg('Token not found');
      return;
    }

    const coinRes = await api.getCoin(symbol);
    const tokenPrice = coinRes?.coin?.price || 0;

    if (shouldShowConfirmation(symbol, amt, tokenPrice)) {
      setPendingSale({ symbol, amount: amt, tokenPrice });
      setShowConfirmModal(true);
      return;
    }

    await executeSell(symbol, amt);
  }

  async function executeSell(symbol, amt) {
    setLoadingSell(symbol);

    try {
      const res = await api.sellCoin(symbol, amt);

      if (res.ok) {
        setMsg(t('soldMsg', {
          amount: Number(res.sold.tokenAmount).toFixed(6),
          symbol
        }));

        await load();

        if (onActionComplete) {
          onActionComplete({
            keepView: true,
            animate: {
              amount: Number(res.sold.usdGained || 0),
              type: 'up'
            }
          });
        }

        setSellAmounts(s => ({ ...s, [symbol]: '' }));
      } else {
        setMsg(res.error || t('sellError'));
      }
    } catch (err) {
      setMsg(t('errorGeneric'));
    } finally {
      setLoadingSell(null);
    }
  }

  function handleConfirmSale() {
    if (pendingSale) {
      setShowConfirmModal(false);
      executeSell(pendingSale.symbol, pendingSale.amount);
      setPendingSale(null);
    }
  }

  function handleCancelSale() {
    setShowConfirmModal(false);
    setPendingSale(null);
  }

  async function handleTransfer() {
    setMsg('');
    
    const amount = Number(transferAmount);
    if (!amount || amount <= 0) {
      setMsg('Enter a valid amount');
      return;
    }
    
    if (!transferRecipient.trim()) {
      setMsg('Enter recipient username');
      return;
    }
    
    if (transferType === 'token' && !transferSymbol) {
      setMsg('Select a token to transfer');
      return;
    }

    if (transferType === 'usd' && amount < 10) {
      setMsg('Minimum transfer amount is $10');
      return;
    }

    setLoadingTransfer(true);

    try {
      const res = await api.transferAssets({
        type: transferType,
        amount: amount,
        recipient: transferRecipient.trim(),
        symbol: transferType === 'token' ? transferSymbol : undefined
      });

      if (res.ok) {
        setMsg(`Successfully transferred ${transferType === 'usd' ? '$' + amount.toFixed(2) : amount + ' ' + transferSymbol} to ${transferRecipient}`);
        setShowTransferModal(false);
        setTransferAmount('');
        setTransferRecipient('');
        setTransferSymbol('');
        await load();

        if (onActionComplete) {
          onActionComplete({
            keepView: true,
            animate: {
              amount: transferType === 'usd' ? amount : 0,
              type: 'down'
            }
          });
        }
      } else {
        setMsg(res.error || 'Transfer failed');
      }
    } catch (err) {
      setMsg('Transfer failed');
    } finally {
      setLoadingTransfer(false);
    }
  }

  const totalPnL = pnlData ? pnlData.total_realized + pnlData.total_unrealized : 0;
  const pnlColor = totalPnL >= 0 ? '#10b981' : '#ef4444';

  return (
    <div>
      <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10}}>
        <h2 style={{margin:0}}>{t('portfolioTitle')}</h2>
        <div style={{fontSize:13, color:'#bfc7d6'}}>{me ? me.username : ''}</div>
      </div>

      {msg && <p className="msg">{msg}</p>}

      <div className="card">
        <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12}}>
          <div>
            <div className="small muted">{t('usdBalance')}</div>
            <div style={{fontWeight:800, fontSize:20}}>
              {me ? `$${Number(me.usd_balance).toFixed(2)}` : '—'}
            </div>
          </div>

          <div style={{textAlign:'right'}}>
            <div className="small muted">{t('tokensCountLabel')}</div>
            <div style={{fontWeight:700}}>
              {me ? me.tokens.length : 0}
            </div>
          </div>
        </div>

        {pnlData && (
          <div style={{
            padding:12, 
            background:'rgba(0,0,0,0.2)', 
            borderRadius:6, 
            marginBottom:12,
            border:`1px solid ${totalPnL >= 0 ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)'}`
          }}>
            <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8}}>
              <div className="small muted">Total P&L</div>
              <div style={{fontSize:18, fontWeight:800, color:pnlColor}}>
                {totalPnL >= 0 ? '+' : ''}{totalPnL.toFixed(2)} USD
              </div>
            </div>
            <div style={{display:'flex', gap:16, fontSize:12}}>
              <div>
                <span className="muted">Realized: </span>
                <span style={{color: pnlData.total_realized >= 0 ? '#10b981' : '#ef4444', fontWeight:600}}>
                  {pnlData.total_realized >= 0 ? '+' : ''}{pnlData.total_realized.toFixed(2)}
                </span>
              </div>
              <div>
                <span className="muted">Unrealized: </span>
                <span style={{color: pnlData.total_unrealized >= 0 ? '#10b981' : '#ef4444', fontWeight:600}}>
                  {pnlData.total_unrealized >= 0 ? '+' : ''}{pnlData.total_unrealized.toFixed(2)}
                </span>
              </div>
            </div>
          </div>
        )}
        
        <button 
          className="btn" 
          style={{width:'100%'}}
          onClick={() => setShowTransferModal(true)}
        >
          Transfer Assets
        </button>
      </div>

      {showTransferModal && (
        <div style={{
          position:'fixed', 
          top:0, 
          left:0, 
          right:0, 
          bottom:0, 
          background:'rgba(0,0,0,0.7)', 
          display:'flex', 
          alignItems:'center', 
          justifyContent:'center',
          zIndex:1000
        }}>
          <div className="card" style={{maxWidth:400, width:'90%'}}>
            <h3 style={{marginTop:0}}>Transfer Assets</h3>
            
            <div style={{marginBottom:12}}>
              <label className="small muted" style={{display:'block', marginBottom:4}}>Type</label>
              <select 
                value={transferType} 
                onChange={e => {
                  setTransferType(e.target.value);
                  setTransferSymbol('');
                }}
                style={{
                  width:'100%',
                  padding:8,
                  background:'#1a1d29',
                  border:'1px solid #2d3348',
                  borderRadius:6,
                  color:'#fff'
                }}
              >
                <option value="usd">USD Balance</option>
                <option value="token">Token</option>
              </select>
            </div>

            {transferType === 'token' && (
              <div style={{marginBottom:12}}>
                <label className="small muted" style={{display:'block', marginBottom:4}}>Select Token</label>
                <select 
                  value={transferSymbol} 
                  onChange={e => setTransferSymbol(e.target.value)}
                  style={{
                    width:'100%',
                    padding:8,
                    background:'#1a1d29',
                    border:'1px solid #2d3348',
                    borderRadius:6,
                    color:'#fff'
                  }}
                >
                  <option value="">Choose token...</option>
                  {me && me.tokens.map(tk => (
                    <option key={tk.symbol} value={tk.symbol}>
                      {tk.symbol} ({Number(tk.amount).toLocaleString()})
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div style={{marginBottom:12}}>
              <label className="small muted" style={{display:'block', marginBottom:4}}>
                {transferType === 'usd' ? 'Amount (min: $10)' : 'Token Amount (min value: $10)'}
              </label>
              <input
                type="number"
                className="small-input"
                placeholder="Amount"
                value={transferAmount}
                onChange={e => setTransferAmount(e.target.value)}
                min="0"
                step={transferType === 'usd' ? '0.01' : '1'}
                style={{width:'100%'}}
              />
            </div>

            <div style={{marginBottom:16}}>
              <label className="small muted" style={{display:'block', marginBottom:4}}>Recipient Username</label>
              <input
                type="text"
                className="small-input"
                placeholder="username"
                value={transferRecipient}
                onChange={e => setTransferRecipient(e.target.value)}
                style={{width:'100%'}}
              />
            </div>

            <div style={{display:'flex', gap:8}}>
              <button 
                className="btn" 
                onClick={handleTransfer}
                disabled={loadingTransfer}
                style={{flex:1}}
              >
                {loadingTransfer ? 'Sending...' : 'Send'}
              </button>
              <button 
                className="btn" 
                onClick={() => {
                  setShowTransferModal(false);
                  setTransferAmount('');
                  setTransferRecipient('');
                  setTransferSymbol('');
                }}
                disabled={loadingTransfer}
                style={{flex:1, background:'#2d3348'}}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {showConfirmModal && pendingSale && (
        <div style={{
          position:'fixed', 
          top:0, 
          left:0, 
          right:0, 
          bottom:0, 
          background:'rgba(0,0,0,0.8)', 
          display:'flex', 
          alignItems:'center', 
          justifyContent:'center',
          zIndex:1001
        }}>
          <div className="card" style={{maxWidth:500, width:'90%', border:'2px solid #ef4444'}}>
            <h3 style={{marginTop:0, color:'#ef4444', display:'flex', alignItems:'center', gap:8}}>
              <span>⚠️</span> Confirm Large Sale
            </h3>
            
            <div style={{
              padding:16,
              background:'rgba(239,68,68,0.06)',
              borderRadius:8,
              marginBottom:16
            }}>
              <div style={{fontSize:15, marginBottom:12, fontWeight:600}}>
                You are about to sell:
              </div>
              <div style={{fontSize:18, fontWeight:800, marginBottom:8}}>
                {Number(pendingSale.amount).toLocaleString()} {pendingSale.symbol}
              </div>
              <div style={{fontSize:14, color:'#94a3b8'}}>
                Estimated value: ${(pendingSale.amount * pendingSale.tokenPrice).toFixed(2)}
              </div>
            </div>

            <p style={{fontSize:14, color:'#94a3b8', lineHeight:1.6, marginBottom:20}}>
              This sale exceeds your configured thresholds. Please confirm that you want to proceed with this transaction.
            </p>

            <div style={{display:'flex', gap:8}}>
              <button 
                className="btn" 
                onClick={handleConfirmSale}
                style={{flex:1, background:'#ef4444', border:'1px solid #ef4444'}}
              >
                Confirm Sale
              </button>
              <button 
                className="btn ghost" 
                onClick={handleCancelSale}
                style={{flex:1}}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <div style={{marginTop:8}}>
        <h3>{t('holdings')}</h3>

        {me && me.tokens.length === 0 && (
          <div className="card muted">{t('noHoldings')}</div>
        )}

        {me && me.tokens.map(tk => {
          const tokenPnL = pnlData?.tokens?.find(t => t.symbol === tk.symbol);
          const unrealizedPnL = tokenPnL ? tokenPnL.unrealized_pnl : 0;
          const realizedPnL = tokenPnL ? tokenPnL.realized_pnl : 0;
          const totalTokenPnL = unrealizedPnL + realizedPnL;
          const pnlTokenColor = totalTokenPnL >= 0 ? '#10b981' : '#ef4444';

          return (
            <div key={tk.symbol} className="card" style={{marginBottom:8}}>
              <div style={{display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:8}}>
                <div>
                  <div style={{fontWeight:800}}>{tk.symbol}</div>
                  <div className="muted">{tk.name}</div>
                  <div className="muted">
                    {t('amountLabel')}: {Number(tk.amount).toLocaleString()}
                  </div>
                  {tokenPnL && (
                    <div style={{fontSize:11, marginTop:4}}>
                      <div style={{color:pnlTokenColor, fontWeight:600}}>
                        P&L: {totalTokenPnL >= 0 ? '+' : ''}{totalTokenPnL.toFixed(2)} USD
                      </div>
                      {tokenPnL.current_value > 0 && (
                        <div className="muted">
                          Value: ${tokenPnL.current_value.toFixed(2)} • 
                          Cost: ${tokenPnL.avg_cost.toFixed(2)}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div style={{display:'flex', flexDirection:'column', gap:8, alignItems:'flex-end'}}>
                  <div style={{display:'flex', gap:8, alignItems:'center'}}>
                    <input
                      className="small-input"
                      placeholder={t('tokenPlaceholder')}
                      value={sellAmounts[tk.symbol] || ''}
                      onChange={e=>setSellAmounts({...sellAmounts, [tk.symbol]: e.target.value})}
                      style={{width:80}}
                    />
                    <button
                      className="btn"
                      onClick={()=>sell(tk.symbol)}
                      disabled={loadingSell && loadingSell !== tk.symbol}
                    >
                      {loadingSell === tk.symbol ? t('selling') : t('sellBtn')}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div style={{marginTop:14}}>
        <h3>{t('transactionsLabel2')}</h3>

        {txs.length === 0 && (
          <div className="card muted">{t('noTransactionsYet')}</div>
        )}

        {txs.map(tx => (
          <div key={tx.id} className="card" style={{marginBottom:8}}>
            <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
              <div>
                <div style={{fontWeight:800}}>{tx.type.toUpperCase()}</div>
                <div className="muted">{tx.symbol} • {new Date(tx.created_at).toLocaleString()}</div>
              </div>

              <div style={{textAlign:'right'}}>
                <div>{tx.usd_amount ? `$${Number(tx.usd_amount).toFixed(4)}` : ''}</div>
                <div className="muted">
                  {tx.token_amount ? t('tokensText', { amount: Number(tx.token_amount).toLocaleString() }) : ''}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
