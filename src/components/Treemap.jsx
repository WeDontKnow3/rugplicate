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
    const measure = (rect) => {
      const maxWidth = Math.min(1400, Math.round(rect.width || window.innerWidth * 0.95));
      const height = Math.min(900, Math.max(420, Math.round(Math.min(window.innerHeight * 0.75, 900))));
      setDimensions({ width: Math.max(320, maxWidth), height });
    };

    if (typeof ResizeObserver !== 'undefined' && containerRef.current) {
      const ro = new ResizeObserver((entries) => {
        for (const entry of entries) measure(entry.contentRect);
      });
      ro.observe(containerRef.current);
      measure(containerRef.current.getBoundingClientRect());
      return () => ro.disconnect();
    }

    const update = () => {
      if (containerRef.current) measure(containerRef.current.getBoundingClientRect());
      else measure({ width: Math.max(320, window.innerWidth * 0.95) });
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
      ws.onclose = () => setTimeout(connectWebSocket, 5000);
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
      } else {
        setCoins([]);
      }
    } catch (e) {
      setCoins([]);
    } finally {
      setLoading(false);
    }
  }

  function squarify(data, x, y, width, height) {
    if (!data || data.length === 0) return [];
    const totalValue = data.reduce((s, it) => s + (it.volume24h || 0), 0);
    if (totalValue === 0 || width <= 0 || height <= 0) return [];
    const normalized = data.map(item => ({ ...item, normalizedValue: (item.volume24h / totalValue) * width * height }));
    const result = [];
    let remaining = [...normalized];
    let currentX = x;
    let currentY = y;
    let remainingWidth = width;
    let remainingHeight = height;

    while (remaining.length > 0) {
      const slice = getOptimalSlice(remaining, remainingWidth, remainingHeight);
      const sliceValue = slice.reduce((s, it) => s + it.normalizedValue, 0);
      if (sliceValue === 0) break;

      if (remainingWidth >= remainingHeight) {
        const sliceWidth = (sliceValue / (remainingWidth * remainingHeight)) * remainingWidth;
        let sliceY = currentY;
        slice.forEach(item => {
          const itemHeight = (item.normalizedValue / sliceValue) * remainingHeight;
          result.push({ ...item, x: currentX, y: sliceY, width: sliceWidth, height: itemHeight });
          sliceY += itemHeight;
        });
        currentX += sliceWidth;
        remainingWidth -= sliceWidth;
      } else {
        const sliceHeight = (sliceValue / (remainingWidth * remainingHeight)) * remainingHeight;
        let sliceX = currentX;
        slice.forEach(item => {
          const itemWidth = (item.normalizedValue / sliceValue) * remainingWidth;
          result.push({ ...item, x: sliceX, y: currentY, width: itemWidth, height: sliceHeight });
          sliceX += itemWidth;
        });
        currentY += sliceHeight;
        remainingHeight -= sliceHeight;
      }

      remaining = remaining.slice(slice.length);
    }
    return result;
  }

  function getOptimalSlice(data, width, height) {
    if (!data || data.length === 0) return [];
    if (data.length === 1) return [data[0]];
    let bestSlice = [data[0]];
    let bestRatio = getWorstAspectRatio([data[0]], width, height);
    for (let i = 2; i <= Math.min(data.length, 30); i++) {
      const slice = data.slice(0, i);
      const ratio = getWorstAspectRatio(slice, width, height);
      if (ratio < bestRatio) {
        bestRatio = ratio;
        bestSlice = slice;
      } else break;
    }
    return bestSlice;
  }

  function getWorstAspectRatio(slice, width, height) {
    const total = slice.reduce((s, it) => s + (it.normalizedValue || 0), 0);
    if (total === 0) return Infinity;
    const sliceLength = width >= height ? (total / (width * height)) * width : (total / (width * height)) * height;
    return Math.max(...slice.map(item => {
      const itemLength = width >= height ? (item.normalizedValue / total) * height : (item.normalizedValue / total) * width;
      if (!itemLength) return Infinity;
      const ratio = sliceLength / itemLength;
      return Math.max(ratio, 1 / ratio);
    }));
  }

  function getColor(change) {
    if (change > 0) {
      const intensity = Math.min(Math.abs(change) / 15, 1);
      const r = Math.floor(34 + intensity * 60);
      const g = Math.floor(197 - intensity * 80);
      const b = Math.floor(94 - intensity * 40);
      return `rgb(${r}, ${g}, ${b})`;
    } else if (change < 0) {
      const intensity = Math.min(Math.abs(change) / 15, 1);
      const r = Math.floor(220 - intensity * 60);
      const g = Math.floor(38 + intensity * 30);
      const b = Math.floor(38 + intensity * 30);
      return `rgb(${r}, ${g}, ${b})`;
    }
    return '#475569';
  }

  function handleClick(symbol) {
    if (typeof onSelectCoin === 'function') onSelectCoin(symbol);
  }

  function showTooltip(e, item) {
    const rect = containerRef.current?.getBoundingClientRect();
    const offsetX = rect ? rect.left : 0;
    const offsetY = rect ? rect.top : 0;
    setTooltip({
      visible: true,
      x: Math.max(8, e.clientX - offsetX + 12),
      y: Math.max(8, e.clientY - offsetY + 12),
      content: item
    });
  }

  function moveTooltip(e) {
    const rect = containerRef.current?.getBoundingClientRect();
    const offsetX = rect ? rect.left : 0;
    const offsetY = rect ? rect.top : 0;
    setTooltip(t => ({ ...t, x: Math.max(8, e.clientX - offsetX + 12), y: Math.max(8, e.clientY - offsetY + 12) }));
  }

  function hideTooltip() {
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

  const innerPadding = 10;
  const gap = 6;
  const layout = (dimensions.width > 0 && dimensions.height > 0) ? squarify(coins, innerPadding, innerPadding, Math.max(1, dimensions.width - innerPadding * 2), Math.max(1, dimensions.height - innerPadding * 2)) : [];

  const renderRect = (it, i) => {
    const w = Math.max(1, it.width - gap);
    const h = Math.max(1, it.height - gap);
    const x = it.x + gap / 2;
    const y = it.y + gap / 2;
    const small = w < 70 || h < 48;
    const rx = Math.min(10, Math.round(Math.min(w, h) * 0.08));
    const color = getColor(it.change24h);
    const contrastText = '#FFFFFF';

    const centerX = x + w / 2;
    const centerY = y + h / 2;
    const titleSize = Math.min(18, Math.max(10, Math.round(w / 8)));
    const subtitleSize = Math.min(13, Math.max(9, Math.round(w / 12)));

    return (
      <g key={i}>
        <rect
          x={x}
          y={y}
          width={w}
          height={h}
          rx={rx}
          fill={color}
          stroke="rgba(0,0,0,0.35)"
          strokeWidth={1}
          style={{ transition: 'all 240ms cubic-bezier(.2,.9,.2,1)' }}
          onMouseEnter={(e) => showTooltip(e, it)}
          onMouseMove={moveTooltip}
          onMouseLeave={hideTooltip}
          onClick={() => handleClick(it.symbol)}
          role={typeof onSelectCoin === 'function' ? 'button' : undefined}
          tabIndex={typeof onSelectCoin === 'function' ? 0 : -1}
          onKeyDown={(e) => { if (e.key === 'Enter' && typeof onSelectCoin === 'function') onSelectCoin(it.symbol); }}
        />
        {!small && (
          <>
            <text x={centerX} y={centerY - (subtitleSize / 2)} textAnchor="middle" fill={contrastText} fontSize={titleSize} fontWeight="800" style={{ pointerEvents: 'none', textShadow: '0 1px 2px rgba(0,0,0,0.45)' }}>
              {it.symbol}
            </text>
            <text x={centerX} y={centerY + (subtitleSize + 2)} textAnchor="middle" fill={contrastText} fontSize={subtitleSize} fontWeight="700" style={{ pointerEvents: 'none', opacity: 0.95 }}>
              {it.change24h >= 0 ? '+' : ''}{Number(it.change24h).toFixed(2)}% · ${Number(it.volume24h).toLocaleString()}
            </text>
          </>
        )}
        {small && (
          <text x={x + 6} y={y + 14} fill={contrastText} fontSize={Math.min(11, Math.max(9, Math.round(w / 6)))} fontWeight="800" style={{ pointerEvents: 'none', textShadow: '0 1px 2px rgba(0,0,0,0.45)' }}>
            {it.symbol.length > 10 ? it.symbol.slice(0, 9) + '…' : it.symbol}
          </text>
        )}
      </g>
    );
  };

  return (
    <div style={{ width: '100%', maxWidth: 1400, margin: '0 auto', fontFamily: 'Inter, system-ui, -apple-system, "Helvetica Neue", Arial' }}>
      <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
        <div>
          <h2 style={{ margin: 0, color: '#e6f0ff', fontSize: 20 }}>Market Treemap</h2>
          <div style={{ color: '#9fb0c8', fontSize: 13, marginTop: 6 }}>Visual representation of the cryptocurrency market. Size indicates 24h volume, color shows 24h price change.</div>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '6px 10px', borderRadius: 999, background: 'rgba(34,197,94,0.08)', color: '#9fe7b4', fontWeight: 700, fontSize: 12 }}>
            <div style={{ width: 8, height: 8, background: '#22c55e', borderRadius: 999 }} /> Positive
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '6px 10px', borderRadius: 999, background: 'rgba(239,68,68,0.06)', color: '#f4a6a6', fontWeight: 700, fontSize: 12 }}>
            <div style={{ width: 8, height: 8, background: '#ef4444', borderRadius: 999 }} /> Negative
          </div>
        </div>
      </div>

      <div ref={containerRef} style={{ width: '100%', height: 'min(75vh, 820px)', position: 'relative', borderRadius: 12, overflow: 'hidden', background: 'linear-gradient(180deg, rgba(6,8,15,0.9), rgba(12,14,20,0.9))', border: '1px solid rgba(255,255,255,0.02)' }}>
        {dimensions.width < 300 || dimensions.height < 200 ? (
          <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8' }}>Calculating layout...</div>
        ) : (
          <svg width="100%" height="100%" viewBox={`0 0 ${dimensions.width} ${dimensions.height}`} preserveAspectRatio="xMidYMid meet" style={{ display: 'block' }}>
            <defs>
              <filter id="shadow"><feDropShadow dx="0" dy="6" stdDeviation="10" floodOpacity="0.12" /></filter>
            </defs>

            <rect x="0" y="0" width={dimensions.width} height={dimensions.height} rx="6" fill="transparent" stroke="rgba(255,255,255,0.03)" strokeWidth="1" />

            {layout.map((it, i) => renderRect(it, i))}
          </svg>
        )}

        <div style={{ position: 'absolute', right: 12, bottom: 12, background: 'rgba(0,0,0,0.45)', padding: '8px 10px', borderRadius: 999, color: '#cbe6ff', fontSize: 12, border: '1px solid rgba(255,255,255,0.02)' }}>
          Last: {lastUpdate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
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
            minWidth: 190,
            zIndex: 60
          }}>
            <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 6 }}>{tooltip.content.symbol} · {tooltip.content.name}</div>
            <div style={{ color: '#9fb0c8', fontSize: 13 }}>Price: {tooltip.content.price != null ? `$${Number(tooltip.content.price).toFixed(6)}` : '—'}</div>
            <div style={{ color: tooltip.content.change24h >= 0 ? '#9fe7b4' : '#f4a6a6', fontWeight: 700, marginTop: 6 }}>{tooltip.content.change24h >= 0 ? '+' : ''}{Number(tooltip.content.change24h).toFixed(2)}%</div>
            <div style={{ color: '#9fb0c8', fontSize: 12, marginTop: 6 }}>24h Volume: ${Number(tooltip.content.volume24h).toLocaleString()}</div>
          </div>
        )}
      </div>

      <div style={{ marginTop: 16, padding: 14, borderRadius: 12, background: 'rgba(6,8,15,0.5)', border: '1px solid rgba(255,255,255,0.02)', color: '#9fb0c8' }}>
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
