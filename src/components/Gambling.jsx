// components/Gambling.jsx
import React, { useState } from 'react';
import * as api from '../api';

const MIN_BET = 1;
const MAX_BET = 1000000;

export default function Gambling({ onBack, onActionComplete }) {
  const [bet, setBet] = useState('');
  const [side, setSide] = useState('heads');
  const [processing, setProcessing] = useState(false);
  const [message, setMessage] = useState(null);
  const [result, setResult] = useState(null);

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
    setProcessing(true);
    try {
      const data = await api.coinFlip(nBet, side);
      if (data && data.ok) {
        const net = Number(data.net || 0);
        const won = net > 0;
        setResult({ server: true, win: won, net, message: data.message || null });
        setMessage(won ? `You won $${Math.abs(net).toFixed(2)}` : `You lost $${Math.abs(net).toFixed(2)}`);
        if (onActionComplete && typeof onActionComplete === 'function') {
          onActionComplete({ animate: { amount: Math.abs(net), type: won ? 'up' : 'down' } });
        }
      } else {
        const localWin = Math.random() < 0.5;
        const net = localWin ? nBet : -nBet;
        setResult({ server: false, win: localWin, net, message: (data && data.error) ? String(data.error) : 'simulated result' });
        setMessage(localWin ? `You won $${nBet.toFixed(2)} (simulated)` : `You lost $${nBet.toFixed(2)} (simulated)`);
        if (onActionComplete && typeof onActionComplete === 'function') {
          onActionComplete({ animate: { amount: Math.abs(net), type: net > 0 ? 'up' : 'down' } });
        }
      }
    } catch (err) {
      const localWin = Math.random() < 0.5;
      const net = localWin ? nBet : -nBet;
      setResult({ server: false, win: localWin, net, message: 'network error, simulated result' });
      setMessage(localWin ? `You won $${nBet.toFixed(2)} (simulated)` : `You lost $${nBet.toFixed(2)} (simulated)`);
      if (onActionComplete && typeof onActionComplete === 'function') {
        onActionComplete({ animate: { amount: Math.abs(net), type: net > 0 ? 'up' : 'down' } });
      }
    } finally {
      setProcessing(false);
    }
  }

  return (
    <div className="card danger-zone">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <h2 style={{ margin: 0 }}>Coin Flip — IMPORTANT</h2>
        <div>
          <button className="btn ghost" onClick={onBack}>Back</button>
        </div>
      </div>

      <p style={{ marginBottom: 12 }}>
        Flip a fair coin. Minimum bet {MIN_BET}, maximum bet {MAX_BET}. This is high-risk; play responsibly.
      </p>

      <div style={{ display: 'flex', gap: 8, marginBottom: 12, alignItems: 'center' }}>
        <input
          type="number"
          className="small-input"
          value={bet}
          min={MIN_BET}
          max={MAX_BET}
          onChange={(e) => setBet(clampBet(e.target.value))}
          placeholder={`${MIN_BET}`}
          aria-label="Bet amount"
        />
        <div style={{ display: 'flex', gap: 6 }}>
          <button
            className={side === 'heads' ? 'btn' : 'btn ghost'}
            onClick={() => setSide('heads')}
            disabled={processing}
          >
            Heads
          </button>
          <button
            className={side === 'tails' ? 'btn' : 'btn ghost'}
            onClick={() => setSide('tails')}
            disabled={processing}
          >
            Tails
          </button>
        </div>
        <button className="btn" onClick={handleFlip} disabled={processing}>
          {processing ? 'Flipping...' : 'Flip'}
        </button>
      </div>

      {message && (
        <div className={result && result.win ? 'success-msg' : 'msg'}>
          {message}
        </div>
      )}

      {result && (
        <div style={{ marginTop: 12, display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
            {result.server ? 'Result from server' : 'Simulated result'}
          </div>
          <div style={{ fontWeight: 800 }}>
            {result.win ? `+ $${Math.abs(result.net).toFixed(2)}` : `- $${Math.abs(result.net).toFixed(2)}`}
          </div>
        </div>
      )}
    </div>
  );
}
