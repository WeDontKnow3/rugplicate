import React, { useState, useRef, useEffect } from 'react';
import * as api from '../api';

const COIN_MIN_BET = 1;
const COIN_MAX_BET = 1000000;
const SLOTS_MIN_BET = 0.01;
const SLOTS_MAX_BET = 1000000;
const ANIM_DURATION = 1100;
const SLOT_SPIN_DURATION = 2000;

const HEAD_IMG_URL = 'https://ibb.co/yBZW24Hz';
const TAIL_IMG_URL = 'https://ibb.co/XZLtkB1F';

const SLOT_SPIN_AUDIO = '/assets/slot-spin.mp3';
const SLOT_WIN_AUDIO = '/assets/slot-win.mp3';
const SLOT_LOSE_AUDIO = '/assets/slot-lose.mp3';

const SLOT_SYMBOLS = ['🍒', '🍋', '🍊', '🍇', '💎', '7️⃣', '⭐'];
const SLOT_PAYOUTS = {
  '🍒🍒🍒': 2,
  '🍋🍋🍋': 3,
  '🍊🍊🍊': 5,
  '🍇🍇🍇': 8,
  '💎💎💎': 15,
  '7️⃣7️⃣7️⃣': 50,
  '⭐⭐⭐': 100
};
const TWO_MATCH_MULT = 2;

export default function Gambling({ onBack, onActionComplete }) {
  const [gameMode, setGameMode] = useState('coinflip');
  const [bet, setBet] = useState('');
  const [side, setSide] = useState('heads');
  const [processing, setProcessing] = useState(false);
  const [message, setMessage] = useState(null);
  const [result, setResult] = useState(null);
  const [animName, setAnimName] = useState('');
  const [flipping, setFlipping] = useState(false);
  const [landSide, setLandSide] = useState(null);
  const [slotReels, setSlotReels] = useState([SLOT_SYMBOLS[0], SLOT_SYMBOLS[0], SLOT_SYMBOLS[0]]);
  const [displayReels, setDisplayReels] = useState([SLOT_SYMBOLS[0], SLOT_SYMBOLS[0], SLOT_SYMBOLS[0]]);
  const [spinning, setSpinning] = useState(false);
  const [balance, setBalance] = useState(null);
  const animTimerRef = useRef(null);
  const reelIntervalRef = useRef(null);
  const spinAudioRef = useRef(null);
  const winAudioRef = useRef(null);
  const loseAudioRef = useRef(null);

  useEffect(() => {
    async function fetchBalance() {
      const me = await api.getMe();
      if (me && typeof me.balance !== 'undefined') setBalance(Number(me.balance));
    }
    fetchBalance();
    return () => {
      if (animTimerRef.current) clearTimeout(animTimerRef.current);
      if (reelIntervalRef.current) clearInterval(reelIntervalRef.current);
      if (spinAudioRef.current) try { spinAudioRef.current.pause(); spinAudioRef.current.currentTime = 0; } catch (e) {}
      if (winAudioRef.current) try { winAudioRef.current.pause(); winAudioRef.current.currentTime = 0; } catch (e) {}
      if (loseAudioRef.current) try { loseAudioRef.current.pause(); loseAudioRef.current.currentTime = 0; } catch (e) {}
    };
  }, []);

  useEffect(() => {
    if (spinning) {
      reelIntervalRef.current = setInterval(() => {
        setDisplayReels([
          SLOT_SYMBOLS[Math.floor(Math.random() * SLOT_SYMBOLS.length)],
          SLOT_SYMBOLS[Math.floor(Math.random() * SLOT_SYMBOLS.length)],
          SLOT_SYMBOLS[Math.floor(Math.random() * SLOT_SYMBOLS.length)]
        ]);
      }, 70);
    } else {
      if (reelIntervalRef.current) {
        clearInterval(reelIntervalRef.current);
        reelIntervalRef.current = null;
      }
      setDisplayReels(slotReels);
    }
    return () => {
      if (reelIntervalRef.current) {
        clearInterval(reelIntervalRef.current);
        reelIntervalRef.current = null;
      }
    };
  }, [spinning, slotReels]);

  const currentMinBet = gameMode === 'coinflip' ? COIN_MIN_BET : SLOTS_MIN_BET;
  const currentMaxBet = gameMode === 'coinflip' ? COIN_MAX_BET : SLOTS_MAX_BET;

  function clampBet(v) {
    const n = Number(v || 0);
    if (!Number.isFinite(n)) return '';
    const minBet = gameMode === 'coinflip' ? COIN_MIN_BET : SLOTS_MIN_BET;
    const maxBet = gameMode === 'coinflip' ? COIN_MAX_BET : SLOTS_MAX_BET;
    if (n < minBet) return minBet.toString();
    if (n > maxBet) return maxBet.toString();
    return n.toString();
  }

  function switchGame(direction) {
    if (processing || flipping || spinning) return;
    setMessage(null);
    setResult(null);
    setBet('');
    if (direction === 'next') {
      setGameMode(gameMode === 'coinflip' ? 'slots' : 'coinflip');
    } else {
      setGameMode(gameMode === 'slots' ? 'coinflip' : 'slots');
    }
  }

  function normalizeReels(reels) {
    if (Array.isArray(reels)) return reels;
    if (typeof reels === 'string') return [...reels];
    return [];
  }

  function computeNetFromReels(nBet, reels) {
    const arr = normalizeReels(reels);
    if (arr.length !== 3) return -nBet;
    const counts = {};
    for (const s of arr) {
      counts[s] = (counts[s] || 0) + 1;
    }
    for (const sym in counts) {
      if (counts[sym] === 3) {
        const combo = `${sym}${sym}${sym}`;
        const mult = SLOT_PAYOUTS[combo] || 0;
        return nBet * mult;
      }
    }
    for (const sym in counts) {
      if (counts[sym] === 2) {
        return nBet * TWO_MATCH_MULT;
      }
    }
    return -nBet;
  }

  async function refreshBalance() {
    const me = await api.getMe();
    if (me && typeof me.balance !== 'undefined') setBalance(Number(me.balance));
  }

  async function handleFlip() {
    setMessage(null);
    setResult(null);
    const nBet = Number(bet);
    if (!nBet || nBet < COIN_MIN_BET || nBet > COIN_MAX_BET) {
      setMessage(`Bet must be between ${COIN_MIN_BET} and ${COIN_MAX_BET}`);
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
      animTimerRef.current = setTimeout(async () => {
        setFlipping(false);
        setLandSide(finalSide);
        setAnimName('');
        setResult({ server: serverOk, win, net, message: data && data.message ? data.message : null });
        setMessage(win ? `You won $${Math.abs(net).toFixed(2)}` : `You lost $${Math.abs(net).toFixed(2)}`);
        if (onActionComplete && typeof onActionComplete === 'function') {
          onActionComplete({ animate: { amount: Math.abs(net), type: win ? 'up' : 'down' }, keepView: true });
        }
        await refreshBalance();
        setProcessing(false);
      }, ANIM_DURATION + 60);
    } catch (err) {
      const localWin = Math.random() < 0.5;
      const net = localWin ? nBet : -nBet;
      const finalSide = localWin ? side : (side === 'heads' ? 'tails' : 'heads');
      const animToUse = finalSide === 'heads' ? 'spinToHead' : 'spinToTail';
      setAnimName(animToUse);
      animTimerRef.current = setTimeout(async () => {
        setFlipping(false);
        setLandSide(finalSide);
        setAnimName('');
        setResult({ server: false, win: localWin, net, message: 'network error, simulated result' });
        setMessage(localWin ? `You won $${nBet.toFixed(2)} (simulated)` : `You lost $${nBet.toFixed(2)} (simulated)`);
        if (onActionComplete && typeof onActionComplete === 'function') {
          onActionComplete({ animate: { amount: Math.abs(net), type: net > 0 ? 'up' : 'down' }, keepView: true });
        }
        await refreshBalance();
        setProcessing(false);
      }, ANIM_DURATION + 60);
    }
  }

  async function handleSlotSpin() {
    setMessage(null);
    setResult(null);
    const nBet = Number(bet);
    if (!nBet || nBet < SLOTS_MIN_BET || nBet > SLOTS_MAX_BET) {
      setMessage(`Bet must be between $${SLOTS_MIN_BET} and $${SLOTS_MAX_BET.toLocaleString()}`);
      return;
    }
    setProcessing(true);
    setSpinning(true);
    if (winAudioRef.current) try { winAudioRef.current.pause(); winAudioRef.current.currentTime = 0; } catch(e) {}
    if (loseAudioRef.current) try { loseAudioRef.current.pause(); loseAudioRef.current.currentTime = 0; } catch(e) {}
    if (spinAudioRef.current) try { spinAudioRef.current.pause(); spinAudioRef.current.currentTime = 0; } catch(e) {}
    try {
      try {
        spinAudioRef.current = new Audio(SLOT_SPIN_AUDIO);
        spinAudioRef.current.loop = true;
        const p = spinAudioRef.current.play();
        if (p && p.catch) p.catch(() => {});
      } catch (e) {
        spinAudioRef.current = null;
      }
      const data = await api.playSlots(nBet);
      let win = false;
      let net = 0;
      let serverOk = false;
      let finalReels = [SLOT_SYMBOLS[0], SLOT_SYMBOLS[0], SLOT_SYMBOLS[0]];
      if (data && data.ok) {
        serverOk = true;
        if (Array.isArray(data.reels) && data.reels.length === 3) {
          finalReels = data.reels;
        } else if (typeof data.reels === 'string' && data.reels.length > 0) {
          finalReels = normalizeReels(data.reels);
        } else {
          finalReels = [
            SLOT_SYMBOLS[Math.floor(Math.random() * SLOT_SYMBOLS.length)],
            SLOT_SYMBOLS[Math.floor(Math.random() * SLOT_SYMBOLS.length)],
            SLOT_SYMBOLS[Math.floor(Math.random() * SLOT_SYMBOLS.length)]
          ];
        }
        if (typeof data.net !== 'undefined') {
          net = Number(data.net);
        } else {
          net = computeNetFromReels(nBet, finalReels);
        }
        win = net > 0;
      } else {
        const rand = Math.random();
        if (rand < 0.05) {
          const sym = SLOT_SYMBOLS[Math.floor(Math.random() * SLOT_SYMBOLS.length)];
          finalReels = [sym, sym, sym];
          const combo = `${sym}${sym}${sym}`;
          const multiplier = SLOT_PAYOUTS[combo] || 0;
          net = nBet * multiplier;
          win = true;
        } else {
          finalReels = [
            SLOT_SYMBOLS[Math.floor(Math.random() * SLOT_SYMBOLS.length)],
            SLOT_SYMBOLS[Math.floor(Math.random() * SLOT_SYMBOLS.length)],
            SLOT_SYMBOLS[Math.floor(Math.random() * SLOT_SYMBOLS.length)]
          ];
          net = computeNetFromReels(nBet, finalReels);
          win = net > 0;
        }
      }
      animTimerRef.current = setTimeout(async () => {
        if (spinAudioRef.current) try { spinAudioRef.current.pause(); spinAudioRef.current.currentTime = 0; } catch(e) {}
        if (win) {
          try {
            winAudioRef.current = new Audio(SLOT_WIN_AUDIO);
            winAudioRef.current.loop = false;
            const p = winAudioRef.current.play();
            if (p && p.catch) p.catch(() => {});
          } catch (e) {
            winAudioRef.current = null;
          }
        } else {
          try {
            loseAudioRef.current = new Audio(SLOT_LOSE_AUDIO);
            loseAudioRef.current.loop = false;
            const p = loseAudioRef.current.play();
            if (p && p.catch) p.catch(() => {});
          } catch (e) {
            loseAudioRef.current = null;
          }
        }
        setSlotReels(finalReels);
        setSpinning(false);
        setResult({ server: serverOk, win, net, message: data && data.message ? data.message : null });
        setMessage(win ? `You won $${Math.abs(net).toFixed(2)}` : `You lost $${Math.abs(net).toFixed(2)}`);
        if (onActionComplete && typeof onActionComplete === 'function') {
          onActionComplete({ animate: { amount: Math.abs(net), type: win ? 'up' : 'down' }, keepView: true });
        }
        await refreshBalance();
        setProcessing(false);
      }, SLOT_SPIN_DURATION);
    } catch (err) {
      const rand = Math.random();
      let finalReels = [SLOT_SYMBOLS[0], SLOT_SYMBOLS[0], SLOT_SYMBOLS[0]];
      let net = -nBet;
      let win = false;
      if (rand < 0.05) {
        const sym = SLOT_SYMBOLS[Math.floor(Math.random() * SLOT_SYMBOLS.length)];
        finalReels = [sym, sym, sym];
        const combo = `${sym}${sym}${sym}`;
        const multiplier = SLOT_PAYOUTS[combo] || 0;
        net = nBet * multiplier;
        win = true;
      } else {
        finalReels = [
          SLOT_SYMBOLS[Math.floor(Math.random() * SLOT_SYMBOLS.length)],
          SLOT_SYMBOLS[Math.floor(Math.random() * SLOT_SYMBOLS.length)],
          SLOT_SYMBOLS[Math.floor(Math.random() * SLOT_SYMBOLS.length)]
        ];
        net = computeNetFromReels(nBet, finalReels);
        win = net > 0;
      }
      animTimerRef.current = setTimeout(async () => {
        if (spinAudioRef.current) try { spinAudioRef.current.pause(); spinAudioRef.current.currentTime = 0; } catch(e) {}
        if (win) {
          try {
            winAudioRef.current = new Audio(SLOT_WIN_AUDIO);
            winAudioRef.current.loop = false;
            const p = winAudioRef.current.play();
            if (p && p.catch) p.catch(() => {});
          } catch (e) {
            winAudioRef.current = null;
          }
        } else {
          try {
            loseAudioRef.current = new Audio(SLOT_LOSE_AUDIO);
            loseAudioRef.current.loop = false;
            const p = loseAudioRef.current.play();
            if (p && p.catch) p.catch(() => {});
          } catch (e) {
            loseAudioRef.current = null;
          }
        }
        setSlotReels(finalReels);
        setSpinning(false);
        setResult({ server: false, win, net, message: 'network error, simulated result' });
        setMessage(win ? `You won $${Math.abs(net).toFixed(2)} (simulated)` : `You lost $${Math.abs(net).toFixed(2)} (simulated)`);
        if (onActionComplete && typeof onActionComplete === 'function') {
          onActionComplete({ animate: { amount: Math.abs(net), type: net > 0 ? 'up' : 'down' }, keepView: true });
        }
        await refreshBalance();
        setProcessing(false);
      }, SLOT_SPIN_DURATION);
    }
  }

  const coinSize = 220;

  return (
    <div className="gambling-container">
      <style>{`
        .gambling-container{max-width:680px;margin:0 auto}
        .gambling-header{display:flex;justify-content:space-between;align-items:center;margin-bottom:24px}
        .gambling-title-wrapper{display:flex;align-items:center;gap:16px}
        .game-switch-btn{background:var(--glass);border:2px solid var(--border);border-radius:10px;width:44px;height:44px;display:flex;align-items:center;justify-content:center;font-size:20px;transition:all 0.2s;cursor:pointer}
        .game-switch-btn:hover:not(:disabled){background:var(--card);border-color:var(--danger);transform:scale(1.05)}
        .game-switch-btn:disabled{opacity:0.3;cursor:not-allowed;transform:none!important}
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
        .slots-display{display:flex;flex-direction:column;align-items:center;margin:40px 0}
        .slots-machine{display:flex;gap:16px;margin-bottom:32px;perspective:1000px}
        .slot-reel{width:120px;height:140px;background:linear-gradient(135deg,var(--glass) 0%,var(--card) 100%);border:3px solid var(--border);border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:72px;box-shadow:inset 0 4px 12px rgba(0,0,0,0.1),0 8px 24px rgba(0,0,0,0.15);position:relative;overflow:hidden;transition:transform 160ms ease}
        .slot-reel.spinning{animation:slotSpin ${SLOT_SPIN_DURATION}ms cubic-bezier(0.25,0.46,0.45,0.94)}
        .slot-reel.spinning::before{content:'';position:absolute;inset:0;background:linear-gradient(180deg,transparent 0%,rgba(255,255,255,0.1) 50%,transparent 100%);animation:slotBlur ${SLOT_SPIN_DURATION}ms linear infinite}
        .slot-reel .symbol{display:block;will-change:transform;transition:transform 120ms ease}
        .slot-reel.spinning .symbol{transform:translateY(-6px) scale(1.02)}
        @keyframes slotSpin{
          0%,100%{transform:translateY(0) rotateX(0deg)}
          25%{transform:translateY(-10px) rotateX(-5deg)}
          50%{transform:translateY(0) rotateX(0deg)}
          75%{transform:translateY(10px) rotateX(5deg)}
        }
        @keyframes slotBlur{
          0%,100%{opacity:0}
          50%{opacity:1}
        }
        .slots-paytable{background:var(--glass);border:1px solid var(--border);border-radius:10px;padding:16px;margin-top:24px;width:100%}
        .paytable-title{font-size:13px;font-weight:700;color:var(--text-secondary);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:12px;text-align:center}
        .paytable-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:8px}
        .paytable-item{display:flex;justify-content:space-between;align-items:center;padding:8px 12px;background:var(--card);border-radius:6px;font-size:14px}
        .paytable-symbols{font-size:18px}
        .paytable-multiplier{font-weight:700;color:var(--success)}
        .result-display{text-align:center;width:100%}
        .result-label{font-size:13px;font-weight:700;color:var(--text-secondary);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:8px}
        .result-value{font-size:36px;font-weight:900;color:var(--text-primary);min-height:45px;display:flex;align-items:center;justify-content:center}
        .result-value.win{color:var(--success)}
        .result-value.loss{color:var(--danger)}
        .message-box{padding:16px 20px;border-radius:10px;text-align:center;font-weight:600;font-size:15px;margin-top:24px;border:1px solid.transparent}
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
          .slot-reel{width:90px;height:110px;font-size:56px}
          .result-value{font-size:28px}
          .paytable-grid{grid-template-columns:1fr}
        }
        @media (max-width:480px){
          .gambling-card{padding:20px 16px}
          .controls-section{padding:20px 16px}
          .gambling-title{font-size:22px}
          .coin-wrapper{width:160px;height:160px}
          .coin{width:146px;height:146px}
          .coin-shadow{width:80px}
          .slot-reel{width:80px;height:100px;font-size:48px;gap:12px}
          .result-value{font-size:24px}
        }
      `}</style>

      <div className="gambling-header">
        <div className="gambling-title-wrapper">
          <button 
            className="game-switch-btn"
            onClick={() => switchGame('prev')}
            disabled={processing || flipping || spinning}
          >
            ←
          </button>
          <h1 className="gambling-title">
            <span className="gambling-title-icon">{gameMode === 'coinflip' ? '🎰' : '🎰'}</span>
            {gameMode === 'coinflip' ? 'Coin Flip' : 'Slots'}
          </h1>
          <button 
            className="game-switch-btn"
            onClick={() => switchGame('next')}
            disabled={processing || flipping || spinning}
          >
            →
          </button>
        </div>
        <div style={{display: 'flex', alignItems: 'center', gap: 12}}>
          <div style={{fontWeight:800}}>Balance</div>
          <div style={{minWidth:120, textAlign:'right', fontWeight:800}}>${balance !== null ? balance.toFixed(2) : '—'}</div>
          <button className="btn ghost" onClick={onBack}>Back</button>
        </div>
      </div>

      <div className="gambling-card">
        <div className="gambling-warning">
          <span className="gambling-warning-icon">⚠️</span>
          <p className="gambling-warning-text">
            High-risk gambling game. Bet between ${currentMinBet.toLocaleString()} and ${currentMaxBet.toLocaleString()}. Play responsibly and never bet more than you can afford to lose.
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
                min={currentMinBet}
                max={currentMaxBet}
                step={gameMode === 'slots' ? '0.01' : '1'}
                onChange={(e) => setBet(clampBet(e.target.value))}
                placeholder={`${currentMinBet.toLocaleString()}`}
                disabled={processing || flipping || spinning}
              />
            </div>
          </div>

          {gameMode === 'coinflip' && (
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
          )}

          <div className="control-group">
            <button 
              className="flip-btn"
              onClick={gameMode === 'coinflip' ? handleFlip : handleSlotSpin}
              disabled={processing || flipping || spinning}
            >
              {gameMode === 'coinflip' 
                ? (processing || flipping ? '🎲 Flipping...' : '🎲 Flip Coin')
                : (processing || spinning ? '🎰 Spinning...' : '🎰 Spin Slots')}
            </button>
          </div>
        </div>

        {gameMode === 'coinflip' ? (
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
        ) : (
          <div className="slots-display">
            <div className="slots-machine">
              {displayReels.map((symbol, idx) => (
                <div key={idx} className={`slot-reel ${spinning ? 'spinning' : ''}`}>
                  <span className="symbol">{symbol}</span>
                </div>
              ))}
            </div>

            <div className="result-display">
              <div className="result-label">Result</div>
              <div className={`result-value ${result ? (result.win ? 'win' : 'loss') : ''}`}>
                {result ? (result.win ? `+$${Math.abs(result.net).toFixed(2)}` : `-$${Math.abs(result.net).toFixed(2)}`) : '—'}
              </div>
            </div>

            <div className="slots-paytable">
              <div className="paytable-title">Paytable</div>
              <div className="paytable-grid">
                {Object.entries(SLOT_PAYOUTS).map(([combo, mult]) => (
                  <div key={combo} className="paytable-item">
                    <span className="paytable-symbols">{combo}</span>
                    <span className="paytable-multiplier">{mult}x</span>
                  </div>
                ))}
                <div className="paytable-item">
                  <span className="paytable-symbols">Any two same</span>
                  <span className="paytable-multiplier">{TWO_MATCH_MULT}x</span>
                </div>
              </div>
            </div>
          </div>
        )}

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
