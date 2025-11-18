import React, { useState, useRef, useEffect } from 'react';
import * as api from '../api';

const MIN_BET = 1;
const MAX_BET = 1000000;
const ANIM_DURATION = 1100;

const HEAD_IMG_URL = 'https://cdn.discordapp.com/attachments/1434987028562448589/1436397093521592350/10_20251107164843.png?ex=691d4c4a&is=691bfaca&hm=0c7dae9d2ec448be41631f015c8fbb5845219222cfe90072fdbf1097905461f0&';
const TAIL_IMG_URL = 'https://cdn.discordapp.com/attachments/1434987028562448589/1436397093869715609/10_20251107164835.png?ex=691d4c4a&is=691bfaca&hm=8edaa8682c2cff43594fe38bd12757490b8e4cd4a009fe548ee3f2660d3cbaeb&';

export default function Gambling({ onBack, onActionComplete }) {
  const [bet, setBet] = useState('');
  const [side, setSide] = useState('heads');
  const [processing, setProcessing] = useState(false);
  const [message, setMessage] = useState(null);
  const [result, setResult] = useState(null);
  const [animName, setAnimName] = useState('');
  const [flipping, setFlipping] = useState(false);
  const [landSide, setLandSide] = useState(null);
  const animTimerRef = useRef(null);

  useEffect(() => {
    return () => {
      if (animTimerRef.current) clearTimeout(animTimerRef.current);
    };
  }, []);

  function clampBet(v) {
    const n = Number(v || 0);
    if (!Number.isFinite(n)) return '';
    const floored = Math.floor(n);
    if (floored < MIN_BET) return MIN_BET.toString();
    if (floored > MAX_BET) return MAX_BET.toString();
    return floored.toString();
  }

  async function handleFlip() {
    setMessage(null);
    setResult(null);
    const nBet = Number(bet);
    if (!nBet || nBet < MIN_BET || nBet > MAX_BET) {
      setMessage(`Bet must be between ${MIN_BET} and ${MAX_BET}`);
      return;
    }
    const token = localStorage.getItem('token');
    if (!token) {
      setMessage('You must be logged in to play');
      return;
    }
    setProcessing(true);
    setFlipping(true);
    setAnimName('');
    setLandSide(null);
    try {
      const data = await api.coinFlip(nBet, side);
      let win = false;
      let net = 0;
      let serverOk = false;
      if (data && data.ok) {
        serverOk = true;
        net = Number(data.net || 0);
        win = net > 0;
      } else {
        win = Math.random() < 0.5;
        net = win ? nBet : -nBet;
      }
      const finalSide = win ? side : (side === 'heads' ? 'tails' : 'heads');
      const animToUse = finalSide === 'heads' ? 'spinToHead' : 'spinToTail';
      setAnimName(animToUse);
      animTimerRef.current = setTimeout(() => {
        setFlipping(false);
        setLandSide(finalSide);
        setAnimName('');
        setResult({ server: serverOk, win, net, message: data && data.message ? data.message : null });
        setMessage(win ? `You won $${Math.abs(net).toFixed(2)}` : `You lost $${Math.abs(net).toFixed(2)}`);
        if (onActionComplete && typeof onActionComplete === 'function') {
          onActionComplete({ animate: { amount: Math.abs(net), type: win ? 'up' : 'down' }, keepView: true });
        }
        setProcessing(false);
      }, ANIM_DURATION + 60);
    } catch (err) {
      const localWin = Math.random() < 0.5;
      const net = localWin ? nBet : -nBet;
      const finalSide = localWin ? side : (side === 'heads' ? 'tails' : 'heads');
      const animToUse = finalSide === 'heads' ? 'spinToHead' : 'spinToTail';
      setAnimName(animToUse);
      animTimerRef.current = setTimeout(() => {
        setFlipping(false);
        setLandSide(finalSide);
        setAnimName('');
        setResult({ server: false, win: localWin, net, message: 'network error, simulated result' });
        setMessage(localWin ? `You won $${nBet.toFixed(2)} (simulated)` : `You lost $${nBet.toFixed(2)} (simulated)`);
        if (onActionComplete && typeof onActionComplete === 'function') {
          onActionComplete({ animate: { amount: Math.abs(net), type: net > 0 ? 'up' : 'down' }, keepView: true });
        }
        setProcessing(false);
      }, ANIM_DURATION + 60);
    }
  }

  const coinSize = 220;

  return (
    <div className="gambling-container">
      <style>{`
        .gambling-container{max-width:680px;margin:0 auto}
        .gambling-header{display:flex;justify-content:space-between;align-items:center;margin-bottom:24px}
        .gambling-title{font-size:28px;font-weight:800;color:var(--text-primary);margin:0;display:flex;align-items:center;gap:12px}
        .gambling-title-icon{font-size:32px}
        .gambling-card{background:var(--card);padding:32px;border-radius:var(--radius);border:1px solid var(--border);box-shadow:0 4px 20px rgba(0,0,0,0.08)}
        .gambling-warning{background:rgba(239,68,68,0.06);border:1px solid rgba(239,68,68,0.2);padding:16px;border-radius:10px;margin-bottom:24px;display:flex;align-items:center;gap:12px}
        .gambling-warning-icon{font-size:20px;color:var(--danger)}
        .gambling-warning-text{font-size:13px;color:var(--text-secondary);line-height:1.6}
        .controls-section{background:var(--glass);padding:24px;border-radius:12px;border:1px solid var(--border);margin-bottom:32px}
        .control-group{margin-bottom:20px}
        .control-group:last-child{margin-bottom:0}
        .control-label{font-size:13px;font-weight:700;color:var(--text-secondary);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:10px;display:block}
        .bet-input-wrapper{position:relative}
        .bet-input-prefix{position:absolute;left:16px;top:50%;transform:translateY(-50%);font-size:16px;font-weight:700;color:var(--text-secondary);pointer-events:none}
        .bet-input{width:100%;padding:14px 16px 14px 36px;font-size:18px;font-weight:700;background:var(--card);border:2px solid var(--border);border-radius:10px;color:var(--text-primary);transition:all 0.2s}
        .bet-input:focus{border-color:var(--danger);background:var(--card);outline:none}
        .side-buttons{display:grid;grid-template-columns:1fr 1fr;gap:12px}
        .side-btn{padding:16px;font-size:16px;font-weight:700;border-radius:10px;border:2px solid var(--border);background:var(--card);color:var(--text-secondary);transition:all 0.2s;display:flex;align-items:center;justify-content:center;gap:8px}
        .side-btn:hover:not(:disabled){background:var(--glass);border-color:var(--danger);transform:translateY(-2px)}
        .side-btn.active{background:var(--card);border-color:var(--danger);color:var(--text-primary)}
        .side-btn:disabled{opacity:0.5;cursor:not-allowed;transform:none!important}
        .flip-btn{width:100%;padding:18px;font-size:18px;font-weight:800;border-radius:12px;background:var(--card);color:var(--text-primary);border:2px solid var(--danger);transition:all 0.2s;text-transform:uppercase;letter-spacing:1px}
        .flip-btn:hover:not(:disabled){transform:translateY(-3px);box-shadow:0 8px 24px rgba(239,68,68,0.2)}
        .flip-btn:disabled{opacity:0.6;cursor:not-allowed;transform:none!important}
        .coin-display{display:flex;flex-direction:column;align-items:center;margin:40px 0}
        .coin-wrapper{width:${coinSize}px;height:${coinSize}px;display:flex;align-items:center;justify-content:center;overflow:visible;margin-bottom:32px}
        .coin{width:${Math.floor(coinSize * 0.92)}px;height:${Math.floor(coinSize * 0.92)}px;border-radius:50%;position:relative;transform-style:preserve-3d;box-shadow:0 20px 50px rgba(0,0,0,0.35);overflow:visible;border:6px solid rgba(0,0,0,0.08);background:transparent}
        .coin-face{position:absolute;left:6px;top:6px;right:6px;bottom:6px;display:flex;align-items:center;justify-content:center;border-radius:50%;backface-visibility:hidden;background-size:contain;background-position:center center;background-repeat:no-repeat;overflow:hidden}
        .coin-face.back{transform:rotateY(180deg)}
        .coin.spinToHead{animation:spinToHead ${ANIM_DURATION}ms cubic-bezier(.22,.9,.3,1) forwards}
        .coin.spinToTail{animation:spinToTail ${ANIM_DURATION}ms cubic-bezier(.22,.9,.3,1) forwards}
        @keyframes spinToHead{
          0%{transform:rotateY(0deg) rotateX(8deg) translateY(0) scale(1)}
          30%{transform:rotateY(540deg) rotateX(6deg) translateY(-15px) scale(1.05)}
          60%{transform:rotateY(1080deg) rotateX(3deg) translateY(-8px) scale(1.02)}
          100%{transform:rotateY(0deg) rotateX(0deg) translateY(0) scale(1)}
        }
        @keyframes spinToTail{
          0%{transform:rotateY(0deg) rotateX(8deg) translateY(0) scale(1)}
          30%{transform:rotateY(540deg) rotateX(6deg) translateY(-15px) scale(1.05)}
          60%{transform:rotateY(1080deg) rotateX(3deg) translateY(-8px) scale(1.02)}
          100%{transform:rotateY(180deg) rotateX(0deg) translateY(0) scale(1)}
        }
        .coin.land-head{transform:rotateY(0deg) rotateX(0deg) translateY(0) scale(1)}
        .coin.land-tail{transform:rotateY(180deg) rotateX(0deg) translateY(0) scale(1)}
        .coin-shadow{width:${Math.floor(coinSize * 0.5)}px;height:${Math.floor(coinSize * 0.1)}px;border-radius:50%;background:rgba(0,0,0,0.25);transition:all ${ANIM_DURATION}ms ease;position:absolute;bottom:-20px}
        .coin.spinToHead + .coin-shadow,.coin.spinToTail + .coin-shadow{transform:scale(0.7);opacity:0.5}
        .result-display{text-align:center;width:100%}
        .result-label{font-size:13px;font-weight:700;color:var(--text-secondary);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:8px}
        .result-value{font-size:36px;font-weight:900;color:var(--text-primary);min-height:45px;display:flex;align-items:center;justify-content:center}
        .result-value.win{color:var(--success)}
        .result-value.loss{color:var(--danger)}
        .message-box{padding:16px 20px;border-radius:10px;text-align:center;font-weight:600;font-size:15px;margin-top:24px;border:1px solid transparent}
        .message-box.success{background:rgba(16,185,129,0.1);border-color:rgba(16,185,129,0.3);color:var(--success)}
        .message-box.error{background:rgba(239,68,68,0.08);border-color:rgba(239,68,68,0.2);color:var(--danger)}
        .result-footer{display:flex;justify-content:space-between;align-items:center;padding:16px 20px;background:var(--glass);border-radius:10px;margin-top:16px;border:1px solid var(--border)}
        .result-footer-label{font-size:12px;color:var(--text-secondary);font-weight:600}
        .result-footer-value{font-size:16px;font-weight:800;color:var(--text-primary)}
        .result-footer-value.win{color:var(--success)}
        .result-footer-value.loss{color:var(--danger)}
        @media (max-width:768px){
          .gambling-card{padding:24px 20px}
          .gambling-title{font-size:24px}
          .coin-wrapper{width:180px;height:180px}
          .coin{width:165px;height:165px}
          .coin-shadow{width:90px}
          .result-value{font-size:28px}
        }
        @media (max-width:480px){
          .gambling-card{padding:20px 16px}
          .controls-section{padding:20px 16px}
          .gambling-title{font-size:22px}
          .coin-wrapper{width:160px;height:160px}
          .coin{width:146px;height:146px}
          .coin-shadow{width:80px}
          .result-value{font-size:24px}
        }
      `}</style>

      <div className="gambling-header">
        <h1 className="gambling-title">
          <span className="gambling-title-icon">🎰</span>
          Coin Flip
        </h1>
        <button className="btn ghost" onClick={onBack}>Back</button>
      </div>

      <div className="gambling-card">
        <div className="gambling-warning">
          <span className="gambling-warning-icon">⚠️</span>
          <p className="gambling-warning-text">
            High-risk gambling game. Bet between ${MIN_BET.toLocaleString()} and ${MAX_BET.toLocaleString()}. Play responsibly and never bet more than you can afford to lose.
          </p>
        </div>

        <div className="controls-section">
          <div className="control-group">
            <label className="control-label">Bet Amount</label>
            <div className="bet-input-wrapper">
              <span className="bet-input-prefix">$</span>
              <input
                type="number"
                className="bet-input"
                value={bet}
                min={MIN_BET}
                max={MAX_BET}
                onChange={(e) => setBet(clampBet(e.target.value))}
                placeholder={`${MIN_BET.toLocaleString()}`}
                disabled={processing || flipping}
              />
            </div>
          </div>

          <div className="control-group">
            <label className="control-label">Choose Side</label>
            <div className="side-buttons">
              <button 
                className={`side-btn ${side === 'heads' ? 'active' : ''}`}
                onClick={() => setSide('heads')}
                disabled={processing || flipping}
              >
                <span>👑</span> Heads
              </button>
              <button 
                className={`side-btn ${side === 'tails' ? 'active' : ''}`}
                onClick={() => setSide('tails')}
                disabled={processing || flipping}
              >
                <span>⚡</span> Tails
              </button>
            </div>
          </div>

          <div className="control-group">
            <button 
              className="flip-btn"
              onClick={handleFlip}
              disabled={processing || flipping}
            >
              {processing || flipping ? '🎲 Flipping...' : '🎲 Flip Coin'}
            </button>
          </div>
        </div>

        <div className="coin-display">
          <div className="coin-wrapper">
            <div
              className={`coin ${animName ? animName : (landSide === 'tails' ? 'land-tail' : landSide === 'heads' ? 'land-head' : '')}`}
            >
              <div className="coin-face front" style={{ backgroundImage: `url(${HEAD_IMG_URL})` }} />
              <div className="coin-face back" style={{ backgroundImage: `url(${TAIL_IMG_URL})` }} />
            </div>
            <div className="coin-shadow" />
          </div>

          <div className="result-display">
            <div className="result-label">Result</div>
            <div className={`result-value ${result ? (result.win ? 'win' : 'loss') : ''}`}>
              {result ? (result.win ? `+$${Math.abs(result.net).toFixed(2)}` : `-$${Math.abs(result.net).toFixed(2)}`) : '—'}
            </div>
          </div>
        </div>

        {message && (
          <div className={`message-box ${result && result.win ? 'success' : 'error'}`}>
            {message}
          </div>
        )}

        {result && (
          <div className="result-footer">
            <span className="result-footer-label">
              {result.server ? '✓ Server Result' : '⚠ Simulated Result'}
            </span>
            <span className={`result-footer-value ${result.win ? 'win' : 'loss'}`}>
              {result.win ? `+$${Math.abs(result.net).toFixed(2)}` : `-$${Math.abs(result.net).toFixed(2)}`}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
