import React, { useEffect, useRef, useState } from 'react';
import * as api from '../api';
import PriceChart from './PriceChart';
import { useTranslation } from 'react-i18next';
import DOMPurify from 'dompurify';

function sanitizeText(text) {
  return DOMPurify.sanitize(text, {
    ALLOWED_TAGS: [],
    ALLOWED_ATTR: [],
    KEEP_CONTENT: true
  });
}

export default function CoinDetail({ symbol, onBack, onActionComplete }) {
  const { t } = useTranslation();
  const [coin, setCoin] = useState(null);
  const [buyUsd, setBuyUsd] = useState('');
  const [sellAmt, setSellAmt] = useState('');
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState([]);
  const [loadingCoin, setLoadingCoin] = useState(true);
  const [userBalance, setUserBalance] = useState(0);
  const [userTokenAmount, setUserTokenAmount] = useState(0);
  const [estimatedTokens, setEstimatedTokens] = useState(null);
  const [estimatedUsd, setEstimatedUsd] = useState(null);
  const [topHolders, setTopHolders] = useState([]);
  const [loadingHolders, setLoadingHolders] = useState(false);
  const [comments, setComments] = useState([]);
  const [loadingComments, setLoadingComments] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [postingComment, setPostingComment] = useState(false);
  const [confirmSettings, setConfirmSettings] = useState({
    enabled: false,
    usd_threshold: 1000,
    percentage_threshold: 10,
    token_count_threshold: 100000
  });
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [pendingSale, setPendingSale] = useState(null);
  const prevPriceRef = useRef(null);
  const priceElRef = useRef(null);
  const wsRef = useRef(null);

  async function loadUserData() {
    try {
      const r = await api.getMe();
      if (r && r.user) {
        setUserBalance(Number(r.user.usd_balance || 0));
        const userToken = r.user.tokens?.find(t => t.symbol === symbol);
        setUserTokenAmount(userToken ? Number(userToken.amount || 0) : 0);
      }
    } catch (e) { console.error(e); }

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

  async function loadTopHolders() {
    setLoadingHolders(true);
    try {
      const r = await api.getCoinHolders(symbol);
      setTopHolders(r?.holders || []);
    } catch { setTopHolders([]); }
    finally { setLoadingHolders(false); }
  }

  async function loadComments() {
    setLoadingComments(true);
    try {
      const r = await api.getCoinComments(symbol);
      const sanitizedComments = (r?.comments || []).map(c => ({
        ...c,
        text: sanitizeText(c.text),
        username: sanitizeText(c.username)
      }));
      setComments(sanitizedComments);
    } catch { setComments([]); }
    finally { setLoadingComments(false); }
  }

  async function load() {
    setLoadingCoin(true);
    setMsg('');
    try {
      const r = await api.getCoin(symbol);
      if (r?.coin) setCoin(r.coin);
      else {
        setCoin(null);
        setMsg(r?.error || t('coinNotFound'));
      }
    } catch (e) {
      setCoin(null);
      setMsg(t('coinLoadError'));
      console.error(e);
    } finally { setLoadingCoin(false); }
  }

  async function loadHistory() {
    try {
      const h = await api.getCoinHistory(symbol, 24);
      setHistory(h?.series || []);
    } catch { setHistory([]); }
  }

  useEffect(() => {
    load();
    loadHistory();
    loadUserData();
    loadTopHolders();
    loadComments();
  }, [symbol]);

  useEffect(() => {
    const wsUrl = "wss://api-ztdev-rugplicate0193.shardweb.app";
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;
    ws.onopen = () => {
      console.log('WebSocket connected for real-time updates');
    };
    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'trade' && data.coin === symbol) {
          const newCandle = {
            time: data.created_at,
            open: Number(data.price),
            high: Number(data.price),
            low: Number(data.price),
            close: Number(data.price)
          };
          setHistory(prev => {
            const updated = [...prev];
            if (updated.length > 0) {
              const lastCandle = updated[updated.length - 1];
              const timeDiff = new Date(newCandle.time).getTime() - new Date(lastCandle.time).getTime();
              if (timeDiff < 5 * 60 * 1000) {
                lastCandle.close = newCandle.close;
                lastCandle.high = Math.max(lastCandle.high, newCandle.close);
                lastCandle.low = Math.min(lastCandle.low, newCandle.close);
              } else {
                updated.push(newCandle);
              }
            } else {
              updated.push(newCandle);
            }
            if (updated.length > 150) {
              return updated.slice(-150);
            }
            return updated;
          });
          setCoin(prev => {
            if (!prev) return prev;
            return {
              ...prev,
              price: data.price,
              pool_base: data.pool_base,
              pool_token: data.pool_token,
              volume24h: data.volume24h,
              change24h: data.change24h
            };
          });
        }
      } catch (err) {
        console.error('WebSocket message error:', err);
      }
    };
    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };
    ws.onclose = () => {
      console.log('WebSocket disconnected');
    };
    return () => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
    };
  }, [symbol]);

  useEffect(() => {
    if (!coin) return;
    const prev = prevPriceRef.current;
    const curr = coin.price;
    if (prev != null && curr != null && prev !== curr) {
      const el = priceElRef.current;
      if (el) {
        el.classList.remove('flash-up', 'flash-down');
        if (curr > prev) el.classList.add('flash-up');
        else if (curr < prev) el.classList.add('flash-down');
        setTimeout(() => el.classList.remove('flash-up','flash-down'), 900);
      }
    }
    prevPriceRef.current = curr;
  }, [coin]);

  useEffect(() => {
    if (!coin || !buyUsd || Number(buyUsd) <= 0) { setEstimatedTokens(null); return; }
    const usdIn = Number(buyUsd);
    const poolBase = Number(coin.pool_base || 0);
    const poolToken = Number(coin.pool_token || 0);
    if (poolBase <= 0 || poolToken <= 0) { setEstimatedTokens(null); return; }
    const FEE = 0.003;
    const effectiveUsd = usdIn * (1 - FEE);
    const k = poolBase * poolToken;
    const newPoolBase = poolBase + effectiveUsd;
    const newPoolToken = k / newPoolBase;
    const tokensReceived = poolToken - newPoolToken;
    setEstimatedTokens(tokensReceived > 0 ? tokensReceived : 0);
  }, [buyUsd, coin]);

  useEffect(() => {
    if (!coin || !sellAmt || Number(sellAmt) <= 0) { setEstimatedUsd(null); return; }
    const tAmount = Number(sellAmt);
    const poolBase = Number(coin.pool_base || 0);
    const poolToken = Number(coin.pool_token || 0);
    if (poolBase <= 0 || poolToken <= 0) { setEstimatedUsd(null); return; }
    const FEE = 0.003;
    const k = poolBase * poolToken;
    const newPoolToken = poolToken + tAmount;
    const newPoolBase = k / newPoolToken;
    const usdOut = (poolBase - newPoolBase) * (1 - FEE);
    setEstimatedUsd(usdOut > 0 ? usdOut : 0);
  }, [sellAmt, coin]);

  async function buy() {
    setMsg('');
    const usd = Number(buyUsd);
    if (!usd || usd <= 0) { setMsg(t('invalidUsd')); return; }
    setLoading(true);
    try {
      const res = await api.buyCoin(symbol, usd);
      if (res?.ok) {
        setMsg(t('boughtMsg', { amount: Number(res.bought.tokenAmount).toFixed(6), symbol }));
        await loadUserData();
        await loadTopHolders();
        onActionComplete?.({ keepView: true, animate: { amount: Number(res.bought.usdSpent || usd), type: 'down' } });
        setBuyUsd('');
        setEstimatedTokens(null);
      } else setMsg(res?.error || t('buyError'));
    } catch { setMsg(t('buyError')); }
    finally { setLoading(false); }
  }

  function shouldShowConfirmation(amount) {
    if (!confirmSettings.enabled || !coin) return false;
    const sellAmount = Number(amount);
    const usdValue = estimatedUsd || 0;
    const percentage = userTokenAmount > 0 ? (sellAmount / userTokenAmount) * 100 : 0;
    return (
      usdValue >= confirmSettings.usd_threshold ||
      percentage >= confirmSettings.percentage_threshold ||
      sellAmount >= confirmSettings.token_count_threshold
    );
  }

  async function sell() {
    setMsg('');
    const amt = Number(sellAmt);
    if (!amt || amt <= 0) { setMsg(t('invalidUsd')); return; }
    if (shouldShowConfirmation(amt)) {
      setPendingSale({ amount: amt });
      setShowConfirmModal(true);
      return;
    }
    await executeSell(amt);
  }

  async function executeSell(amt) {
    setLoading(true);
    try {
      const res = await api.sellCoin(symbol, amt);
      if (res?.ok) {
        setMsg(t('soldMsg', { amount: Number(res.sold.tokenAmount).toFixed(6), symbol }));
        await loadUserData();
        await loadTopHolders();
        onActionComplete?.({ keepView: true, animate: { amount: Number(res.sold.usdGained || 0), type: 'up' } });
        setSellAmt('');
        setEstimatedUsd(null);
      } else setMsg(res?.error || t('sellError'));
    } catch { setMsg(t('sellError')); }
    finally { setLoading(false); }
  }

  function handleConfirmSale() {
    if (pendingSale) {
      setShowConfirmModal(false);
      executeSell(pendingSale.amount);
      setPendingSale(null);
    }
  }

  function handleCancelSale() {
    setShowConfirmModal(false);
    setPendingSale(null);
  }

  async function postComment() {
    const sanitized = commentText.trim();
    if (!sanitized) return;
    if (sanitized.length > 500) {
      setMsg('Comment too long (max 500 characters)');
      return;
    }
    setPostingComment(true);
    try {
      const res = await api.postCoinComment(symbol, sanitized);
      if (res?.ok) {
        setCommentText('');
        await loadComments();
      } else {
        setMsg(res?.error || 'Failed to post comment');
      }
    } catch (e) {
      console.error(e);
      setMsg('Failed to post comment');
    } finally {
      setPostingComment(false);
    }
  }

  async function deleteComment(commentId) {
    try {
      const res = await api.deleteCoinComment(commentId);
      if (res?.ok) {
        await loadComments();
      }
    } catch (e) {
      console.error(e);
    }
  }

  function handleMaxBuy() { if (userBalance > 0) setBuyUsd(userBalance.toString()); }
  function handleMaxSell() { if (userTokenAmount > 0) setSellAmt(userTokenAmount.toString()); }

  function formatTimeAgo(isoString) {
    const now = new Date();
    const past = new Date(isoString);
    const diffMs = now - past;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  }

  return (
    <div className="page">
      <button className="back-btn" onClick={onBack}>{t('back')}</button>
      <h2>{t('coinTitle', { symbol })}</h2>

      {loadingCoin && <div className="card">{t('loadingCoin')}</div>}
      {!loadingCoin && msg && <div className="card" style={{color:'#ffd2d2'}}>{msg}</div>}

      {!loadingCoin && coin && (
        <>
          <div className="card">
            <strong>{coin.name}</strong>
            <div className="row" style={{marginTop:8}}>
              <div>{t('price')}: <strong ref={priceElRef}>{coin.price===null?'—':`$${Number(coin.price).toFixed(8)}`}</strong></div>
              <div className="muted">{t('poolBase')}: {Number(coin.pool_base).toFixed(6)}</div>
              <div className="muted">{t('poolToken')}: {Number(coin.pool_token).toLocaleString()}</div>
              <div style={{marginLeft:12}}>
                <div className={coin.change24h>0?'flash-up':coin.change24h<0?'flash-down':''} style={{fontWeight:700}}>
                  {coin.change24h==null?'—':`${coin.change24h.toFixed(2)}%`}
                </div>
                <div className="small muted">{t('volume24h')}: {coin.volume24h!=null?`$${Number(coin.volume24h).toFixed(2)}`:'—'}</div>
              </div>
            </div>
          </div>

          <div className="card">
            <h3>{t('price24hTitle')}</h3>
            <PriceChart series={history}/>
          </div>

          <div className="card">
            <h3>{t('buyTitle')}</h3>
            <div style={{display:'flex', gap:'8px', alignItems:'center'}}>
              <input
                className="full"
                placeholder={t('usdPlaceholder')}
                value={buyUsd}
                onChange={e=>setBuyUsd(e.target.value)}
                inputMode="decimal"
                style={{flex:1}}
              />
              <button className="btn" onClick={handleMaxBuy} disabled={loading||userBalance<=0}>{t('max')}</button>
            </div>
            {estimatedTokens!==null && <div style={{marginTop:8,fontSize:'.9em',color:'#aaa'}}>
              {t('estimatedTokens', { tokens: estimatedTokens.toFixed(6), symbol })}
            </div>}
            <button className="btn" onClick={buy} disabled={loading} style={{marginTop:8}}>
              {loading?t('processingShort'):t('buyBtn')}
            </button>
          </div>

          <div className="card">
            <h3>{t('sellTitle')}</h3>
            <div style={{display:'flex', gap:'8px', alignItems:'center'}}>
              <input
                className="full"
                placeholder={t('tokenPlaceholder')}
                value={sellAmt}
                onChange={e=>setSellAmt(e.target.value)}
                inputMode="decimal"
                style={{flex:1}}
              />
              <button className="btn" onClick={handleMaxSell} disabled={loading||userTokenAmount<=0}>{t('max')}</button>
            </div>
            {estimatedUsd!==null && <div style={{marginTop:8,fontSize:'.9em',color:'#aaa'}}>
              {t('estimatedUsd', { usd: estimatedUsd.toFixed(6) })}
            </div>}
            <button className="btn" onClick={sell} disabled={loading} style={{marginTop:8}}>
              {loading?t('processingShort'):t('sellBtn')}
            </button>
          </div>

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
                    {Number(pendingSale.amount).toLocaleString()} {symbol}
                  </div>
                  <div style={{fontSize:14, color:'#94a3b8'}}>
                    Estimated value: ${(estimatedUsd || 0).toFixed(2)}
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

          <div className="card">
            <h3>{t('topHolders')}</h3>
            {loadingHolders && <div style={{color:'#aaa', fontSize:'.9em'}}>{t('loadingHolders')}</div>}
            {!loadingHolders && topHolders.length===0 && <div style={{color:'#aaa', fontSize:'.9em'}}>{t('noHolders')}</div>}
            {!loadingHolders && topHolders.length>0 && (
              <div style={{marginTop:12}}>
                {topHolders.map((holder, idx)=>(
                  <div key={idx} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'8px 0',borderBottom: idx<topHolders.length-1?'1px solid #333':'none'}}>
                    <div style={{display:'flex',alignItems:'center',gap:'8px'}}>
                      <span style={{
                        color: idx===0?'#FFD700':idx===1?'#C0C0C0':idx===2?'#CD7F32':'#888',
                        fontWeight: idx<3?'bold':'normal',
                        minWidth:'25px'
                      }}>#{idx+1}</span>
                      <span style={{fontWeight:idx<3?'600':'normal'}}>{holder.username}</span>
                    </div>
                    <div style={{textAlign:'right'}}>
                      <div style={{fontWeight:600}}>{Number(holder.amount).toLocaleString()} {symbol}</div>
                      <div style={{fontSize:'.85em', color:'#aaa'}}>
                        {holder.percentage?`${holder.percentage.toFixed(2)}%`:'—'}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="card">
            <h3>Comments</h3>
            <div style={{marginBottom:16}}>
              <textarea
                placeholder="Share your thoughts..."
                value={commentText}
                onChange={e=>setCommentText(e.target.value)}
                disabled={postingComment}
                style={{
                  width:'100%',
                  minHeight:'80px',
                  padding:'12px',
                  background:'#1a1a1a',
                  border:'1px solid #333',
                  borderRadius:'8px',
                  color:'#fff',
                  fontSize:'14px',
                  resize:'vertical',
                  fontFamily:'inherit'
                }}
                maxLength={500}
              />
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginTop:8}}>
                <span style={{fontSize:'.85em',color:'#666'}}>{commentText.length}/500</span>
                <button
                  className="btn"
                  onClick={postComment}
                  disabled={postingComment || !commentText.trim()}
                  style={{padding:'8px 16px'}}
                >
                  {postingComment ? 'Posting...' : 'Post Comment'}
                </button>
              </div>
            </div>

            {loadingComments && <div style={{color:'#aaa',fontSize:'.9em',textAlign:'center',padding:'20px'}}>Loading comments...</div>}

            {!loadingComments && comments.length === 0 && (
              <div style={{color:'#666',fontSize:'.9em',textAlign:'center',padding:'20px'}}>
                No comments yet. Be the first to share your thoughts!
              </div>
            )}

            {!loadingComments && comments.length > 0 && (
              <div style={{display:'flex',flexDirection:'column',gap:'12px'}}>
                {comments.map(comment => (
                  <div
                    key={comment.id}
                    style={{
                      background:'#1a1a1a',
                      padding:'12px',
                      borderRadius:'8px',
                      border:'1px solid #333'
                    }}
                  >
                    <div style={{display:'flex',justifyContent:'space-between',alignItems:'start',marginBottom:8}}>
                      <div>
                        <span style={{fontWeight:600,color:'#4CAF50'}}>{comment.username}</span>
                        <span style={{marginLeft:8,fontSize:'.85em',color:'#666'}}>
                          {formatTimeAgo(comment.created_at)}
                        </span>
                      </div>
                      {comment.can_delete && (
                        <button
                          onClick={() => deleteComment(comment.id)}
                          style={{
                            background:'none',
                            border:'none',
                            color:'#ff4444',
                            cursor:'pointer',
                            fontSize:'.85em',
                            padding:'4px 8px'
                          }}
                        >
                          Delete
                        </button>
                      )}
                    </div>
                    <div style={{color:'#ddd',fontSize:'.95em',whiteSpace:'pre-wrap',wordBreak:'break-word'}}>
                      {comment.text}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {msg && <p className="msg">{msg}</p>}
        </>
      )}
    </div>
  );
}
