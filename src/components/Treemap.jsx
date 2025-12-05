import React, { useEffect, useRef, useState } from 'react';
import * as api from '../api';

export default function Treemap({ onSelectCoin }) {
  const containerRef = useRef(null);
  const wsRef = useRef(null);
  const [coins, setCoins] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState(new Date());
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [tooltip, setTooltip] = useState({ visible: false, x: 0, y: 0, content: null });

  useEffect(() => {
    loadCoins();
    connectWebSocket();
    const interval = setInterval(loadCoins, 30000);
    return () => {
      clearInterval(interval);
      if (wsRef.current) wsRef.current.close();
    };
  }, []);

  useEffect(() => {
    const setFromRect = (rect) => {
      const maxWidth = Math.min(1400, Math.round(rect.width || window.innerWidth * 0.95));
      const height = Math.min(900, Math.max(420, window.innerHeight - 220));
      setDimensions({ width: Math.max(300, maxWidth), height });
    };

    if (typeof ResizeObserver !== 'undefined' && containerRef.current) {
      const ro = new ResizeObserver((entries) => {
        for (const entry of entries) setFromRect(entry.contentRect);
      });
      ro.observe(containerRef.current);
      setFromRect(containerRef.current.getBoundingClientRect());
      return () => ro.disconnect();
    }

    const update = () => {
      if (containerRef.current) setFromRect(containerRef.current.getBoundingClientRect());
      else setFromRect({ width: Math.max(300, window.innerWidth * 0.95) });
    };

    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  function connectWebSocket() {
    try {
      const wsUrl = `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}`;
      const ws = new WebSocket(wsUrl);
      ws.onopen = () => {};
      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'trade') {
            setLastUpdate(new Date());
            loadCoins();
          }
        } catch (e) {}
      };
      ws.onerror = () => {};
      ws.onclose = () => {
        setTimeout(connectWebSocket, 5000);
      };
      wsRef.current = ws;
    } catch (e) {}
  }

  async function loadCoins() {
    try {
      const res = await api.listCoins();
      if (res && res.coins) {
        const filtered = res.coins
          .filter(c => c.symbol !== 'COMMUNITY')
          .map(c => ({
            symbol: c.symbol,
            name: c.name,
            price: c.price || 0,
            change24h: c.change24h || 0,
            volume24h: c.volume24h || 0.01,
            marketCap: (c.price || 0) * Math.max(0, (c.circulating_supply || 0) - (c.pool_token || 0))
          }))
          .map(c => ({ ...c, volume24h: Math.max(0.01, c.volume24h) }))
          .sort((a, b) => b.marketCap - a.marketCap);
        setCoins(filtered);
      }
    } catch (e) {}
    finally {
      setLoading(false);
    }
  }

  function squarify(data, x, y, width, height) {
    if (!data || data.length === 0) return [];
    const total = data.reduce((s, i) => s + (i.volume24h || 0), 0);
    if (total === 0 || width <= 0 || height <= 0) return [];
    const normalized = data.map(item => ({ ...item, normalizedValue: (item.volume24h / total) * width * height }));
    const out = [];
    let rem = [...normalized];
    let cx = x;
    let cy = y;
    let rw = width;
    let rh = height;
    while (rem.length > 0) {
      const slice = getOptimalSlice(rem, rw, rh);
      const sliceValue = slice.reduce((s, it) => s + it.normalizedValue, 0);
      if (sliceValue === 0) break;
      if (rw >= rh) {
        const sliceW = (sliceValue / (rw * rh)) * rw;
        let sy = cy;
        slice.forEach(it => {
          const hItem = (it.normalizedValue / sliceValue) * rh;
          out.push({ ...it, x: cx, y: sy, width: sliceW, height: hItem });
          sy += hItem;
        });
        cx += sliceW;
        rw -= sliceW;
      } else {
        const sliceH = (sliceValue / (rw * rh)) * rh;
        let sx = cx;
        slice.forEach(it => {
          const wItem = (it.normalizedValue / sliceValue) * rw;
          out.push({ ...it, x: sx, y: cy, width: wItem, height: sliceH });
          sx += wItem;
        });
        cy += sliceH;
        rh -= sliceH;
      }
      rem = rem.slice(slice.length);
    }
    return out;
  }

  function getOptimalSlice(data, width, height) {
    if (!data || data.length === 0) return [];
    if (data.length === 1) return [data[0]];
    let best = [data[0]];
    let bestRatio = worstRatio([data[0]], width, height);
    for (let i = 2; i <= Math.min(data.length, 30); i++) {
      const slice = data.slice(0, i);
      const r = worstRatio(slice, width, height);
      if (r < bestRatio) { bestRatio = r; best = slice; } else break;
    }
    return best;
  }

  function worstRatio(slice, width, height) {
    const total = slice.reduce((s, it) => s + (it.normalizedValue || 0), 0);
    if (total === 0) return Infinity;
    const sliceLen = width >= height ? (total / (width * height)) * width : (total / (width * height)) * height;
    return Math.max(...slice.map(item => {
      const itemLen = width >= height ? (item.normalizedValue / total) * height : (item.normalizedValue / total) * width;
      if (!itemLen) return Infinity;
      const ratio = sliceLen / itemLen;
      return Math.max(ratio, 1 / ratio);
    }));
  }

  function getColor(change) {
    if (change > 0) {
      const i = Math.min(Math.abs(change) / 15, 1);
      const r = Math.floor(34 + i * 60);
      const g = Math.floor(197 - i * 80);
      const b = Math.floor(94 - i * 40);
      return `rgb(${r}, ${g}, ${b})`;
    } else if (change < 0) {
      const i = Math.min(Math.abs(change) / 15, 1);
      const r = Math.floor(220 - i * 60);
      const g = Math.floor(38 + i * 30);
      const b = Math.floor(38 + i * 30);
      return `rgb(${r}, ${g}, ${b})`;
    }
    return '#475569';
  }

  function handleClick(symbol) {
    if (typeof onSelectCoin === 'function') onSelectCoin(symbol);
  }

  function showTip(e, item) {
    const rect = containerRef.current?.getBoundingClientRect();
    const offsetX = rect ? rect.left : 0;
    const offsetY = rect ? rect.top : 0;
    setTooltip({
      visible: true,
      x: (e.clientX - offsetX) + 12,
      y: (e.clientY - offsetY) + 12,
      content: item
    });
  }

  function moveTip(e) {
    const rect = containerRef.current?.getBoundingClientRect();
    const offsetX = rect ? rect.left : 0;
    const offsetY = rect ? rect.top : 0;
    setTooltip(t => ({ ...t, x: (e.clientX - offsetX) + 12, y: (e.clientY - offsetY) + 12 }));
  }

  function hideTip() {
    setTooltip({ visible: false, x: 0, y: 0, content: null });
  }

  if (loading) {
    return (
      <div style={{ width: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center', height: 420, color: '#94a3b8' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: 48, height: 48, border: '4px solid rgba(226,232,240,0.06)', borderTopColor: '#3b82f6', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 12px' }} />
          <div>Loading market data...</div>
        </div>
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    );
  }

  const layout = (dimensions.width > 0 && dimensions.height > 0) ? squarify(coins, 0, 0, dimensions.width, dimensions.height) : [];

  return (
    <div style={{ width: '100%', maxWidth: 1400, margin: '0 auto', fontFamily: 'Inter, system-ui, -apple-system, "Helvetica Neue", Arial' }}>
      <div style={{ marginBottom: 18, padding: 18, borderRadius: 12, background: 'linear-gradient(180deg, rgba(15,23,42,0.66), rgba(10,14,20,0.6))', border: '1px solid rgba(255,255,255,0.03)', boxShadow: '0 6px 18px rgba(2,6,23,0.6)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <div style={{ width: 46, height: 46, borderRadius: 10, background: 'linear-gradient(135deg,#0ea5a0,#06b6d4)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#001' }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" style={{ display: 'block' }}>
                <rect x="2" y="6" width="6" height="12" rx="1" fill="#001"/>
                <rect x="9" y="3" width="6" height="15" rx="1" fill="#001"/>
                <rect x="16" y="9" width="6" height="9" rx="1" fill="#001"/>
              </svg>
            </div>
            <div>
              <div style={{ fontSize: 18, fontWeight: 700, color: '#e6f0ff' }}>Market Treemap</div>
              <div style={{ fontSize: 12, color: '#9fb0c8', marginTop: 4 }}>Size = 24h volume · Color = price change · {coins.length} coins</div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '6px 10px', background: 'rgba(34,197,94,0.08)', borderRadius: 999, color: '#9fe7b4', fontSize: 12, fontWeight: 600 }}>
              <div style={{ width: 8, height: 8, background: '#22c55e', borderRadius: 999 }} />
              Positive
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '6px 10px', background: 'rgba(239,68,68,0.06)', borderRadius: 999, color: '#f4a6a6', fontSize: 12, fontWeight: 600 }}>
              <div style={{ width: 8, height: 8, background: '#ef4444', borderRadius: 999 }} />
              Negative
            </div>
          </div>
        </div>
      </div>

      <div ref={containerRef} style={{ width: '100%', height: dimensions.height, position: 'relative', borderRadius: 12, overflow: 'hidden', background: 'linear-gradient(180deg, rgba(6,8,15,0.6), rgba(12,14,20,0.6))', border: '1px solid rgba(255,255,255,0.02)' }}>
        {dimensions.width < 300 || dimensions.height < 200 ? (
          <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8' }}>Calculating layout...</div>
        ) : (
          <svg width="100%" height="100%" viewBox={`0 0 ${dimensions.width} ${dimensions.height}`} preserveAspectRatio="xMidYMid meet" style={{ display: 'block' }}>
            <defs>
              <filter id="softShadow">
                <feDropShadow dx="0" dy="6" stdDeviation="10" floodOpacity="0.15"/>
              </filter>
            </defs>

            {layout.map((it, i) => {
              const pad = Math.min(8, Math.round(Math.min(it.width, it.height) * 0.04));
              const rx = Math.min(12, Math.round(Math.min(it.width, it.height) * 0.12));
              const tx = it.x + pad + (it.width - pad * 2) / 2;
              const ty = it.y + pad + 18;
              const small = it.width < 70 || it.height < 50;
              const color = getColor(it.change24h);
              return (
                <g key={i}>
                  <rect
                    x={it.x + 1}
                    y={it.y + 1}
                    width={Math.max(1, it.width - 2)}
                    height={Math.max(1, it.height - 2)}
                    rx={rx}
                    fill={color}
                    stroke="rgba(0,0,0,0.25)"
                    strokeWidth={1}
                    style={{ filter: 'url(#softShadow)', transition: 'all 240ms cubic-bezier(.2,.9,.2,1)' }}
                    onMouseEnter={(e) => showTip(e, it)}
                    onMouseMove={moveTip}
                    onMouseLeave={hideTip}
                    onClick={() => handleClick(it.symbol)}
                    role={typeof onSelectCoin === 'function' ? 'button' : undefined}
                    tabIndex={typeof onSelectCoin === 'function' ? 0 : -1}
                    onKeyDown={(e) => { if (e.key === 'Enter' && typeof onSelectCoin === 'function') onSelectCoin(it.symbol); }}
                  />
                  {!small && (
                    <>
                      <text x={it.x + pad + 6} y={it.y + pad + 18} fill="#ffffff" fontSize={Math.min(14, Math.max(11, it.width / 7))} fontWeight="700" style={{ pointerEvents: 'none', textShadow: '0 1px 2px rgba(0,0,0,0.45)' }}>
                        {it.symbol}
                      </text>
                      <text x={it.x + pad + 6} y={it.y + pad + 36} fill="rgba(255,255,255,0.85)" fontSize={Math.min(12, Math.max(10, it.width / 10))} fontWeight="600" style={{ pointerEvents: 'none', textShadow: '0 1px 1px rgba(0,0,0,0.35)' }}>
                        {it.change24h >= 0 ? '+' : ''}{Number(it.change24h).toFixed(2)}% · ${Number(it.volume24h).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                      </text>
                    </>
                  )}
                  {small && (
                    <text x={it.x + it.width / 2} y={it.y + it.height / 2} textAnchor="middle" fill="#ffffff" fontSize={Math.min(12, Math.max(9, it.width / 5))} fontWeight="700" style={{ pointerEvents: 'none', textShadow: '0 1px 1px rgba(0,0,0,0.45)' }}>
                      {it.symbol.length > 8 ? it.symbol.slice(0, 7) + '…' : it.symbol}
                    </text>
                  )}
                </g>
              );
            })}
          </svg>
        )}

        <div style={{ position: 'absolute', right: 12, bottom: 12, background: 'rgba(0,0,0,0.45)', padding: '8px 10px', borderRadius: 999, color: '#cbe6ff', fontSize: 12, border: '1px solid rgba(255,255,255,0.02)' }}>
          Last: {lastUpdate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </div>

        <div style={{ position: 'absolute', left: 12, top: 12, background: 'rgba(0,0,0,0.45)', padding: '8px 10px', borderRadius: 8, color: '#9fb0c8', fontSize: 13, border: '1px solid rgba(255,255,255,0.02)' }}>
          Treemap
        </div>

        {tooltip.visible && tooltip.content && (
          <div style={{
            position: 'absolute',
            left: tooltip.x,
            top: tooltip.y,
            transform: 'translate(0,0)',
            background: 'linear-gradient(180deg, rgba(12,16,22,0.98), rgba(6,8,12,0.98))',
            padding: '10px 12px',
            borderRadius: 8,
            color: '#e6f0ff',
            fontSize: 13,
            boxShadow: '0 8px 30px rgba(2,6,23,0.7)',
            border: '1px solid rgba(255,255,255,0.03)',
            pointerEvents: 'none',
            minWidth: 180,
            zIndex: 60
          }}>
            <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 6 }}>{tooltip.content.symbol} · {tooltip.content.name}</div>
            <div style={{ color: '#9fb0c8', fontSize: 13 }}>Price: {tooltip.content.price != null ? `$${Number(tooltip.content.price).toFixed(6)}` : '—'}</div>
            <div style={{ color: tooltip.content.change24h >= 0 ? '#9fe7b4' : '#f4a6a6', fontWeight: 700, marginTop: 6 }}>{tooltip.content.change24h >= 0 ? '+' : ''}{Number(tooltip.content.change24h).toFixed(2)}%</div>
            <div style={{ color: '#9fb0c8', fontSize: 12, marginTop: 6 }}>24h Volume: ${Number(tooltip.content.volume24h).toLocaleString()}</div>
          </div>
        )}
      </div>

      <div style={{ marginTop: 18, padding: 16, borderRadius: 12, background: 'rgba(6,8,15,0.5)', border: '1px solid rgba(255,255,255,0.02)', color: '#9fb0c8' }}>
        <div style={{ fontWeight: 700, color: '#cbe6ff', marginBottom: 8 }}>How to read this chart</div>
        <ul style={{ margin: 0, paddingLeft: 18, lineHeight: 1.6 }}>
          <li>Larger boxes represent higher 24h trading volume</li>
          <li>Green shades mean price up, red shades mean price down</li>
          <li>Hover a box for details, click to open the coin view</li>
          <li>Layout adapts to your screen size</li>
        </ul>
      </div>
    </div>
  );
}
