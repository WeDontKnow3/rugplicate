import React, { useEffect, useState, useRef } from 'react';
import * as api from '../api';

export default function Treemap() {
  const [coins, setCoins] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState(new Date());
  const containerRef = useRef(null);
  const wsRef = useRef(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  useEffect(() => {
    loadCoins();
    connectWebSocket();

    const interval = setInterval(loadCoins, 30000);
    
    return () => {
      clearInterval(interval);
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        const width = containerRef.current.clientWidth;
        const height = Math.min(1000, Math.max(600, window.innerHeight - 250));
        setDimensions({ width, height });
      }
    };

    updateDimensions();
    window.addEventListener('resize', updateDimensions);
    return () => window.removeEventListener('resize', updateDimensions);
  }, []);

  function connectWebSocket() {
    const wsUrl = `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}`;
    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      console.log('WebSocket connected');
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'trade') {
          setLastUpdate(new Date());
          loadCoins();
        }
      } catch (err) {
        console.error('WebSocket message error:', err);
      }
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };

    ws.onclose = () => {
      console.log('WebSocket disconnected, reconnecting...');
      setTimeout(connectWebSocket, 5000);
    };

    wsRef.current = ws;
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
          .map(c => ({
            ...c,
            volume24h: Math.max(0.01, c.volume24h)
          }))
          .sort((a, b) => b.marketCap - a.marketCap);
        
        setCoins(filtered);
      }
    } catch (err) {
      console.error('Failed to load coins', err);
    } finally {
      setLoading(false);
    }
  }

  function squarify(data, x, y, width, height) {
    if (data.length === 0) return [];
    
    const totalValue = data.reduce((sum, item) => sum + item.volume24h, 0);
    if (totalValue === 0) return [];

    const normalized = data.map(item => ({
      ...item,
      normalizedValue: (item.volume24h / totalValue) * width * height
    }));

    const result = [];
    let remaining = [...normalized];
    let currentX = x;
    let currentY = y;
    let remainingWidth = width;
    let remainingHeight = height;

    while (remaining.length > 0) {
      const slice = getOptimalSlice(remaining, remainingWidth, remainingHeight);
      const sliceValue = slice.reduce((sum, item) => sum + item.normalizedValue, 0);
      
      if (remainingWidth >= remainingHeight) {
        const sliceWidth = (sliceValue / (remainingWidth * remainingHeight)) * remainingWidth;
        let sliceY = currentY;
        
        slice.forEach(item => {
          const itemHeight = (item.normalizedValue / sliceValue) * remainingHeight;
          result.push({
            ...item,
            x: currentX,
            y: sliceY,
            width: sliceWidth,
            height: itemHeight
          });
          sliceY += itemHeight;
        });
        
        currentX += sliceWidth;
        remainingWidth -= sliceWidth;
      } else {
        const sliceHeight = (sliceValue / (remainingWidth * remainingHeight)) * remainingHeight;
        let sliceX = currentX;
        
        slice.forEach(item => {
          const itemWidth = (item.normalizedValue / sliceValue) * remainingWidth;
          result.push({
            ...item,
            x: sliceX,
            y: currentY,
            width: itemWidth,
            height: sliceHeight
          });
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
    if (data.length === 0) return [];
    if (data.length === 1) return [data[0]];

    let bestSlice = [data[0]];
    let bestRatio = getWorstAspectRatio([data[0]], width, height);

    for (let i = 2; i <= Math.min(data.length, 20); i++) {
      const slice = data.slice(0, i);
      const ratio = getWorstAspectRatio(slice, width, height);
      
      if (ratio < bestRatio) {
        bestRatio = ratio;
        bestSlice = slice;
      } else {
        break;
      }
    }

    return bestSlice;
  }

  function getWorstAspectRatio(slice, width, height) {
    const total = slice.reduce((sum, item) => sum + item.normalizedValue, 0);
    const sliceLength = width >= height ? 
      (total / (width * height)) * width : 
      (total / (width * height)) * height;

    return Math.max(
      ...slice.map(item => {
        const itemLength = width >= height ?
          (item.normalizedValue / total) * height :
          (item.normalizedValue / total) * width;
        
        const ratio = sliceLength / itemLength;
        return Math.max(ratio, 1 / ratio);
      })
    );
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

  function handleCoinClick(symbol) {
    window.location.href = `/coins/${symbol}`;
  }

  function formatTime(date) {
    return date.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit',
      second: '2-digit'
    });
  }

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '600px',
        color: '#94a3b8'
      }}>
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '1rem'
        }}>
          <div style={{
            width: '48px',
            height: '48px',
            border: '4px solid rgba(226, 232, 240, 0.1)',
            borderTopColor: '#3b82f6',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite'
          }}></div>
          <div>Loading market data...</div>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (coins.length === 0) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '600px',
        color: '#94a3b8',
        textAlign: 'center'
      }}>
        <div>
          <div style={{ fontSize: '48px', marginBottom: '1rem' }}>📊</div>
          <div>No market data available</div>
          <div style={{ fontSize: '0.875rem', marginTop: '0.5rem' }}>
            Create some coins to see the treemap
          </div>
        </div>
      </div>
    );
  }

  const layout = dimensions.width > 0 ? 
    squarify(coins, 0, 0, dimensions.width, dimensions.height) : 
    [];

  return (
    <div style={{ width: '100%' }}>
      <div style={{
        marginBottom: '1.5rem',
        padding: '1.25rem',
        background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.05), rgba(147, 51, 234, 0.05))',
        borderRadius: '12px',
        border: '1px solid rgba(59, 130, 246, 0.2)',
        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1rem'
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
              <h2 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 700 }}>📊 Market Treemap</h2>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.25rem 0.75rem',
                background: 'rgba(34, 197, 94, 0.15)',
                borderRadius: '999px',
                fontSize: '0.75rem',
                color: '#22c55e',
                fontWeight: 600
              }}>
                <div style={{
                  width: '6px',
                  height: '6px',
                  borderRadius: '50%',
                  background: '#22c55e',
                  animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite'
                }}></div>
                Live
              </div>
            </div>
            <p style={{ margin: 0, fontSize: '0.875rem', color: '#94a3b8' }}>
              Size indicates 24h volume, color shows price change • {coins.length} coins
            </p>
            <p style={{ margin: 0, marginTop: '0.25rem', fontSize: '0.75rem', color: '#64748b' }}>
              Last updated: {formatTime(lastUpdate)}
            </p>
          </div>
          <div style={{
            display: 'flex',
            gap: '1.5rem',
            fontSize: '0.875rem'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <div style={{
                width: '20px',
                height: '20px',
                background: 'linear-gradient(135deg, #22c55e, #16a34a)',
                borderRadius: '6px',
                boxShadow: '0 2px 4px rgba(34, 197, 94, 0.3)'
              }}></div>
              <span style={{ color: '#94a3b8', fontWeight: 500 }}>Positive</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <div style={{
                width: '20px',
                height: '20px',
                background: 'linear-gradient(135deg, #ef4444, #dc2626)',
                borderRadius: '6px',
                boxShadow: '0 2px 4px rgba(239, 68, 68, 0.3)'
              }}></div>
              <span style={{ color: '#94a3b8', fontWeight: 500 }}>Negative</span>
            </div>
          </div>
        </div>
      </div>

      <div 
        ref={containerRef}
        style={{
          width: '100%',
          height: dimensions.height,
          position: 'relative',
          background: 'rgba(15, 23, 42, 0.6)',
          borderRadius: '12px',
          border: '1px solid rgba(71, 85, 105, 0.3)',
          overflow: 'hidden',
          boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)'
        }}
      >
        <svg
          width={dimensions.width}
          height={dimensions.height}
          style={{ display: 'block' }}
        >
          <defs>
            <filter id="shadow">
              <feDropShadow dx="0" dy="2" stdDeviation="3" floodOpacity="0.3"/>
            </filter>
          </defs>
          {layout.map((item, idx) => (
            <g key={idx}>
              <rect
                x={item.x}
                y={item.y}
                width={item.width}
                height={item.height}
                fill={getColor(item.change24h)}
                stroke="rgba(15, 23, 42, 0.8)"
                strokeWidth="2"
                filter="url(#shadow)"
                style={{
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
                onMouseEnter={(e) => {
                  e.target.style.opacity = '0.85';
                  e.target.style.filter = 'url(#shadow) brightness(1.1)';
                }}
                onMouseLeave={(e) => {
                  e.target.style.opacity = '1';
                  e.target.style.filter = 'url(#shadow)';
                }}
                onClick={() => handleCoinClick(item.symbol)}
              />
              
              {item.width > 80 && item.height > 50 && (
                <>
                  <text
                    x={item.x + item.width / 2}
                    y={item.y + item.height / 2 - 12}
                    textAnchor="middle"
                    fill="#ffffff"
                    fontSize={Math.min(16, item.width / 5)}
                    fontWeight="800"
                    style={{ 
                      pointerEvents: 'none', 
                      userSelect: 'none',
                      textShadow: '0 2px 4px rgba(0,0,0,0.5)'
                    }}
                  >
                    {item.symbol}
                  </text>
                  <text
                    x={item.x + item.width / 2}
                    y={item.y + item.height / 2 + 6}
                    textAnchor="middle"
                    fill="#ffffff"
                    fontSize={Math.min(14, item.width / 7)}
                    fontWeight="700"
                    style={{ 
                      pointerEvents: 'none', 
                      userSelect: 'none',
                      textShadow: '0 2px 4px rgba(0,0,0,0.5)'
                    }}
                  >
                    {item.change24h >= 0 ? '+' : ''}{item.change24h.toFixed(2)}%
                  </text>
                  {item.height > 70 && (
                    <text
                      x={item.x + item.width / 2}
                      y={item.y + item.height / 2 + 24}
                      textAnchor="middle"
                      fill="rgba(255,255,255,0.7)"
                      fontSize={Math.min(11, item.width / 9)}
                      fontWeight="600"
                      style={{ 
                        pointerEvents: 'none', 
                        userSelect: 'none',
                        textShadow: '0 1px 2px rgba(0,0,0,0.5)'
                      }}
                    >
                      ${item.volume24h.toFixed(2)}
                    </text>
                  )}
                </>
              )}
              
              {item.width > 50 && item.height > 35 && item.width <= 80 && (
                <>
                  <text
                    x={item.x + item.width / 2}
                    y={item.y + item.height / 2 - 4}
                    textAnchor="middle"
                    fill="#ffffff"
                    fontSize={Math.min(13, item.width / 4)}
                    fontWeight="800"
                    style={{ 
                      pointerEvents: 'none', 
                      userSelect: 'none',
                      textShadow: '0 2px 4px rgba(0,0,0,0.5)'
                    }}
                  >
                    {item.symbol}
                  </text>
                  <text
                    x={item.x + item.width / 2}
                    y={item.y + item.height / 2 + 10}
                    textAnchor="middle"
                    fill="#ffffff"
                    fontSize={Math.min(11, item.width / 6)}
                    fontWeight="700"
                    style={{ 
                      pointerEvents: 'none', 
                      userSelect: 'none',
                      textShadow: '0 2px 4px rgba(0,0,0,0.5)'
                    }}
                  >
                    {item.change24h >= 0 ? '+' : ''}{item.change24h.toFixed(1)}%
                  </text>
                </>
              )}

              {item.width > 30 && item.height > 25 && item.width <= 50 && (
                <text
                  x={item.x + item.width / 2}
                  y={item.y + item.height / 2 + 4}
                  textAnchor="middle"
                  fill="#ffffff"
                  fontSize={Math.min(10, item.width / 3.5)}
                  fontWeight="700"
                  style={{ 
                    pointerEvents: 'none', 
                    userSelect: 'none',
                    textShadow: '0 1px 3px rgba(0,0,0,0.5)'
                  }}
                >
                  {item.symbol.length > 6 ? item.symbol.substring(0, 5) + '.' : item.symbol}
                </text>
              )}
            </g>
          ))}
        </svg>
      </div>

      <div style={{
        marginTop: '1.5rem',
        padding: '1.25rem',
        background: 'rgba(59, 130, 246, 0.05)',
        borderRadius: '12px',
        border: '1px solid rgba(59, 130, 246, 0.2)'
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: '0.75rem'
        }}>
          <div style={{ fontSize: '1.5rem' }}>💡</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, marginBottom: '0.75rem', color: '#60a5fa', fontSize: '1.125rem' }}>
              How to read this chart
            </div>
            <ul style={{
              margin: 0,
              paddingLeft: '1.25rem',
              color: '#94a3b8',
              fontSize: '0.875rem',
              lineHeight: 1.8
            }}>
              <li>Larger boxes represent higher 24h trading volume</li>
              <li>Green shades indicate positive price change, red indicates negative</li>
              <li>Darker/brighter colors show stronger price movements</li>
              <li>Click on any box to view detailed coin information</li>
              <li>Updates automatically in real-time via WebSocket connection</li>
            </ul>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </div>
  );
}
