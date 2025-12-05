import React, { useEffect, useState, useRef } from 'react';
import * as api from '../api';

export default function Treemap() {
  const [coins, setCoins] = useState([]);
  const [loading, setLoading] = useState(true);
  const containerRef = useRef(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  useEffect(() => {
    loadCoins();
    const interval = setInterval(loadCoins, 10000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        const width = containerRef.current.clientWidth;
        const height = Math.min(800, Math.max(500, window.innerHeight - 200));
        setDimensions({ width, height });
      }
    };

    updateDimensions();
    window.addEventListener('resize', updateDimensions);
    return () => window.removeEventListener('resize', updateDimensions);
  }, []);

  async function loadCoins() {
    try {
      const res = await api.listCoins();
      if (res && res.coins) {
        const filtered = res.coins
          .filter(c => c.symbol !== 'COMMUNITY' && c.volume24h > 0)
          .map(c => ({
            symbol: c.symbol,
            name: c.name,
            price: c.price || 0,
            change24h: c.change24h || 0,
            volume24h: c.volume24h || 0,
            marketCap: (c.price || 0) * ((c.circulating_supply || 0) - (c.pool_token || 0))
          }))
          .sort((a, b) => b.volume24h - a.volume24h)
          .slice(0, 100);
        
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

    for (let i = 2; i <= data.length; i++) {
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
      const intensity = Math.min(Math.abs(change) / 10, 1);
      const r = Math.floor(16 + intensity * 100);
      const g = Math.floor(185 - intensity * 50);
      const b = Math.floor(129);
      return `rgb(${r}, ${g}, ${b})`;
    } else if (change < 0) {
      const intensity = Math.min(Math.abs(change) / 10, 1);
      const r = Math.floor(239 - intensity * 50);
      const g = Math.floor(68 + intensity * 20);
      const b = Math.floor(68 + intensity * 20);
      return `rgb(${r}, ${g}, ${b})`;
    }
    return '#64748b';
  }

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '500px',
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
        height: '500px',
        color: '#94a3b8',
        textAlign: 'center'
      }}>
        <div>
          <div style={{ fontSize: '48px', marginBottom: '1rem' }}>📊</div>
          <div>No market data available</div>
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
        padding: '1rem',
        background: 'rgba(255,255,255,0.02)',
        borderRadius: '8px',
        border: '1px solid rgba(255,255,255,0.05)'
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1rem'
        }}>
          <div>
            <h3 style={{ margin: 0, marginBottom: '0.25rem' }}>Market Treemap</h3>
            <p style={{ margin: 0, fontSize: '0.875rem', color: '#94a3b8' }}>
              Size indicates 24h volume, color shows price change
            </p>
          </div>
          <div style={{
            display: 'flex',
            gap: '1.5rem',
            fontSize: '0.875rem'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <div style={{
                width: '16px',
                height: '16px',
                background: '#10b981',
                borderRadius: '4px'
              }}></div>
              <span style={{ color: '#94a3b8' }}>Positive</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <div style={{
                width: '16px',
                height: '16px',
                background: '#ef4444',
                borderRadius: '4px'
              }}></div>
              <span style={{ color: '#94a3b8' }}>Negative</span>
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
          background: 'rgba(255,255,255,0.02)',
          borderRadius: '8px',
          border: '1px solid rgba(255,255,255,0.05)',
          overflow: 'hidden'
        }}
      >
        <svg
          width={dimensions.width}
          height={dimensions.height}
          style={{ display: 'block' }}
        >
          {layout.map((item, idx) => (
            <g key={idx}>
              <rect
                x={item.x}
                y={item.y}
                width={item.width}
                height={item.height}
                fill={getColor(item.change24h)}
                stroke="rgba(0,0,0,0.2)"
                strokeWidth="1"
                style={{
                  cursor: 'pointer',
                  transition: 'opacity 0.2s'
                }}
                onMouseEnter={(e) => e.target.style.opacity = '0.8'}
                onMouseLeave={(e) => e.target.style.opacity = '1'}
              />
              
              {item.width > 60 && item.height > 40 && (
                <>
                  <text
                    x={item.x + item.width / 2}
                    y={item.y + item.height / 2 - 8}
                    textAnchor="middle"
                    fill="#ffffff"
                    fontSize={Math.min(14, item.width / 6)}
                    fontWeight="700"
                    style={{ pointerEvents: 'none', userSelect: 'none' }}
                  >
                    {item.symbol}
                  </text>
                  <text
                    x={item.x + item.width / 2}
                    y={item.y + item.height / 2 + 8}
                    textAnchor="middle"
                    fill="#ffffff"
                    fontSize={Math.min(12, item.width / 8)}
                    fontWeight="600"
                    style={{ pointerEvents: 'none', userSelect: 'none' }}
                  >
                    {item.change24h >= 0 ? '+' : ''}{item.change24h.toFixed(2)}%
                  </text>
                </>
              )}
              
              {item.width > 40 && item.height > 25 && item.width <= 60 && (
                <text
                  x={item.x + item.width / 2}
                  y={item.y + item.height / 2 + 4}
                  textAnchor="middle"
                  fill="#ffffff"
                  fontSize={Math.min(11, item.width / 5)}
                  fontWeight="700"
                  style={{ pointerEvents: 'none', userSelect: 'none' }}
                >
                  {item.symbol}
                </text>
              )}
            </g>
          ))}
        </svg>
      </div>

      <div style={{
        marginTop: '1.5rem',
        padding: '1rem',
        background: 'rgba(59, 130, 246, 0.05)',
        borderRadius: '8px',
        border: '1px solid rgba(59, 130, 246, 0.2)'
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: '0.75rem'
        }}>
          <div style={{ fontSize: '1.25rem' }}>💡</div>
          <div>
            <div style={{ fontWeight: 700, marginBottom: '0.5rem', color: '#60a5fa' }}>
              How to read this chart
            </div>
            <ul style={{
              margin: 0,
              paddingLeft: '1.25rem',
              color: '#94a3b8',
              fontSize: '0.875rem',
              lineHeight: 1.6
            }}>
              <li>Larger boxes represent higher trading volume (24h)</li>
              <li>Green indicates positive price change, red indicates negative</li>
              <li>Darker colors show stronger price movements</li>
              <li>Click on any box to view detailed coin information</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
