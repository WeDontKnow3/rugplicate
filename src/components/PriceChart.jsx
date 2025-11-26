import React, { useEffect, useRef, useState } from 'react';

export default function PriceChart({ series = [] }) {
  const containerRef = useRef();
  const chartRef = useRef(null);
  const [useFallback, setUseFallback] = useState(false);
  const [libErrorMsg, setLibErrorMsg] = useState(null);
  const [hover, setHover] = useState(null);

  useEffect(() => {
    let mounted = true;
    import('lightweight-charts')
      .then(({ createChart }) => {
        if (!mounted || !containerRef.current) return;
        const chart = createChart(containerRef.current, {
          width: containerRef.current.clientWidth,
          height: 320,
          layout: {
            background: { type: 'solid', color: '#0a0e1a' },
            textColor: '#9ca3af'
          },
          grid: {
            vertLines: { color: 'rgba(99, 102, 241, 0.05)' },
            horzLines: { color: 'rgba(99, 102, 241, 0.05)' }
          },
          crosshair: {
            mode: 1,
            vertLine: {
              width: 1,
              color: 'rgba(99, 102, 241, 0.4)',
              style: 0,
              labelBackgroundColor: '#6366f1'
            },
            horzLine: {
              width: 1,
              color: 'rgba(99, 102, 241, 0.4)',
              style: 0,
              labelBackgroundColor: '#6366f1'
            }
          },
          rightPriceScale: {
            visible: true,
            borderColor: 'rgba(99, 102, 241, 0.1)',
            textColor: '#9ca3af'
          },
          timeScale: {
            timeVisible: true,
            secondsVisible: false,
            borderColor: 'rgba(99, 102, 241, 0.1)',
            textColor: '#9ca3af'
          }
        });

        const candlestickSeries = chart.addCandlestickSeries({
          upColor: '#10b981',
          downColor: '#ef4444',
          borderUpColor: '#10b981',
          borderDownColor: '#ef4444',
          wickUpColor: '#10b981',
          wickDownColor: '#ef4444',
          priceLineVisible: false
        });

        const setData = (s) => {
          const data = s
            .filter(p => p.open != null && p.high != null && p.low != null && p.close != null)
            .map(p => ({
              time: Math.floor(new Date(p.time).getTime() / 1000),
              open: Number(p.open),
              high: Number(p.high),
              low: Number(p.low),
              close: Number(p.close)
            }));
          candlestickSeries.setData(data);
        };

        setData(series);

        const handleResize = () => chart.applyOptions({ width: containerRef.current.clientWidth });
        window.addEventListener('resize', handleResize);

        chartRef.current = { chart, candlestickSeries, setData, handleResize };
      })
      .catch(err => {
        console.warn('lightweight-charts import failed (fallback enabled):', err);
        if (mounted) {
          setUseFallback(true);
          setLibErrorMsg(String(err && err.message ? err.message : err));
        }
      });

    return () => {
      mounted = false;
      if (chartRef.current) {
        window.removeEventListener('resize', chartRef.current.handleResize);
        try { chartRef.current.chart.remove(); } catch (_) {}
        chartRef.current = null;
      }
    };
  }, []);
  
  useEffect(() => {
    if (chartRef.current && chartRef.current.setData) {
      chartRef.current.setData(series);
      return;
    }
  }, [series]);

  if (!useFallback) {
    return (
      <div style={{ width: '100%', height: 320, position: 'relative', borderRadius: 12, overflow: 'hidden', background: 'linear-gradient(135deg, #0a0e1a 0%, #1a1f35 100%)', boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)' }}>
        <div ref={containerRef} style={{ width: '100%', height: 320 }} />
      </div>
    );
  }

  const points = series.filter(p => p.close != null);
  if (points.length === 0) {
    return (
      <div style={{ padding: 24, borderRadius: 12, background: 'linear-gradient(135deg, #0a0e1a 0%, #1a1f35 100%)', color: '#9ca3af', textAlign: 'center', boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)' }}>
        <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>No data available</div>
        {libErrorMsg ? <div style={{fontSize:12, color:'#ef4444', marginTop:8}}>Error: {libErrorMsg}</div> : null}
      </div>
    );
  }

  const w = containerRef.current ? containerRef.current.clientWidth : 760;
  const h = 320;
  const padding = { left: 50, right: 20, top: 20, bottom: 35 };
  const innerW = Math.max(10, w - padding.left - padding.right);
  const innerH = Math.max(10, h - padding.top - padding.bottom);

  const sorted = [...points].sort((a,b) => new Date(a.time) - new Date(b.time));
  const allPrices = sorted.flatMap(p => [p.open, p.high, p.low, p.close]);
  const minP = Math.min(...allPrices);
  const maxP = Math.max(...allPrices);
  const range = maxP - minP || maxP || 1;

  const candleWidth = Math.max(1.5, Math.min(8, innerW / sorted.length - 1));

  function priceToY(price) {
    const ratio = (Number(price) - minP) / range;
    return padding.top + (1 - ratio) * innerH;
  }

  function handleMouseMove(e) {
    const rect = e.currentTarget.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const candleSpacing = innerW / sorted.length;
    const idx = Math.floor((mx - padding.left) / candleSpacing);
    if (idx >= 0 && idx < sorted.length) {
      setHover({ idx, item: sorted[idx], x: padding.left + (idx / sorted.length) * innerW + (innerW / sorted.length) / 2 });
    }
  }
  
  function handleMouseLeave() { setHover(null); }

  const ticks = 5;
  const tickVals = Array.from({length: ticks+1}, (_,i) => minP + (i/ticks)*range).reverse();

  return (
    <div ref={containerRef} style={{ width: '100%', height: h, position: 'relative', borderRadius: 12, overflow: 'hidden', background: 'linear-gradient(135deg, #0a0e1a 0%, #1a1f35 100%)', boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)' }}>
      <svg width={w} height={h} onMouseMove={handleMouseMove} onMouseLeave={handleMouseLeave} style={{display:'block'}}>
        <defs>
          <linearGradient id="upGradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" style={{stopColor: '#10b981', stopOpacity: 1}} />
            <stop offset="100%" style={{stopColor: '#059669', stopOpacity: 1}} />
          </linearGradient>
          <linearGradient id="downGradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" style={{stopColor: '#ef4444', stopOpacity: 1}} />
            <stop offset="100%" style={{stopColor: '#dc2626', stopOpacity: 1}} />
          </linearGradient>
          <filter id="glow">
            <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
            <feMerge>
              <feMergeNode in="coloredBlur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
        </defs>

        <g>
          {tickVals.map((v,i) => {
            const ty = padding.top + (i / ticks) * innerH;
            return (
              <g key={i}>
                <line x1={padding.left} x2={w - padding.right} y1={ty} y2={ty} stroke="rgba(99, 102, 241, 0.05)" strokeWidth={1} />
                <text x={12} y={ty+4} fontSize={11} fill="#6b7280" fontWeight="500">${Number(v).toFixed(6)}</text>
              </g>
            );
          })}
        </g>

        {sorted.map((candle, i) => {
          const x = padding.left + (i / sorted.length) * innerW + (innerW / sorted.length) / 2;
          const yOpen = priceToY(candle.open);
          const yClose = priceToY(candle.close);
          const yHigh = priceToY(candle.high);
          const yLow = priceToY(candle.low);
          
          const isUp = candle.close >= candle.open;
          const gradient = isUp ? 'url(#upGradient)' : 'url(#downGradient)';
          const wickColor = isUp ? '#10b981' : '#ef4444';
          const bodyTop = Math.min(yOpen, yClose);
          const bodyHeight = Math.max(2, Math.abs(yClose - yOpen));

          const isHovered = hover?.idx === i;

          return (
            <g key={i}>
              <line 
                x1={x} 
                x2={x} 
                y1={yHigh} 
                y2={yLow} 
                stroke={wickColor} 
                strokeWidth={isHovered ? 2 : 1.5}
                opacity={isHovered ? 1 : 0.9}
              />
              <rect 
                x={x - candleWidth / 2} 
                y={bodyTop} 
                width={candleWidth} 
                height={bodyHeight} 
                fill={gradient}
                opacity={isHovered ? 1 : 0.95}
                rx={1}
                filter={isHovered ? 'url(#glow)' : undefined}
              />
            </g>
          );
        })}

        {hover && (
          <>
            <line 
              x1={hover.x} 
              x2={hover.x}
              y1={padding.top} 
              y2={h - padding.bottom} 
              stroke="rgba(99, 102, 241, 0.3)" 
              strokeWidth={1}
              strokeDasharray="4,4"
            />
            <line 
              x1={padding.left} 
              x2={w - padding.right}
              y1={priceToY(hover.item.close)} 
              y2={priceToY(hover.item.close)} 
              stroke="rgba(99, 102, 241, 0.3)" 
              strokeWidth={1}
              strokeDasharray="4,4"
            />
          </>
        )}
      </svg>

      {hover && (
        <div style={{
          position:'absolute', 
          left: Math.min(w - 230, Math.max(10, hover.x - 100)), 
          top: 15,
          background: 'linear-gradient(135deg, rgba(17, 24, 39, 0.98) 0%, rgba(31, 41, 55, 0.98) 100%)', 
          color:'#e5e7eb', 
          padding:'14px 16px', 
          borderRadius:10, 
          fontSize:13, 
          pointerEvents:'none', 
          boxShadow:'0 20px 40px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(99, 102, 241, 0.2)',
          backdropFilter: 'blur(10px)',
          minWidth: 200
        }}>
          <div style={{marginBottom:10, fontSize:11, color:'#9ca3af', fontWeight: 500, letterSpacing: '0.5px'}}>
            {new Date(hover.item.time).toLocaleString('en-US', { 
              month: 'short', 
              day: 'numeric', 
              hour: '2-digit', 
              minute: '2-digit'
            })}
          </div>
          <div style={{display:'grid', gridTemplateColumns: '1fr 1fr', gap:'10px', fontSize:12}}>
            <div>
              <div style={{color:'#6b7280', fontSize:10, marginBottom:3, fontWeight: 600}}>OPEN</div>
              <div style={{fontWeight:600, color:'#e5e7eb'}}>${hover.item.open}</div>
            </div>
            <div>
              <div style={{color:'#6b7280', fontSize:10, marginBottom:3, fontWeight: 600}}>HIGH</div>
              <div style={{fontWeight:600, color:'#10b981'}}>${hover.item.high}</div>
            </div>
            <div>
              <div style={{color:'#6b7280', fontSize:10, marginBottom:3, fontWeight: 600}}>LOW</div>
              <div style={{fontWeight:600, color:'#ef4444'}}>${hover.item.low}</div>
            </div>
            <div>
              <div style={{color:'#6b7280', fontSize:10, marginBottom:3, fontWeight: 600}}>CLOSE</div>
              <div style={{fontWeight:600, color:'#e5e7eb'}}>${hover.item.close}</div>
            </div>
          </div>
          <div style={{marginTop:10, paddingTop:10, borderTop:'1px solid rgba(99, 102, 241, 0.2)', fontSize:11}}>
            <span style={{color:'#9ca3af'}}>Change: </span>
            <span style={{
              fontWeight:700, 
              color: hover.item.close >= hover.item.open ? '#10b981' : '#ef4444'
            }}>
              {hover.item.close >= hover.item.open ? '+' : ''}
              {((hover.item.close - hover.item.open) / hover.item.open * 100).toFixed(2)}%
            </span>
          </div>
        </div>
      )}

      <div style={{ 
        position:'absolute', 
        left:15, 
        bottom:12, 
        color:'#6b7280', 
        fontSize:11,
        fontWeight: 500,
        letterSpacing: '0.5px',
        textTransform: 'uppercase'
      }}>
        {libErrorMsg ? 'Fallback Mode' : '1m Candlesticks'}
      </div>
    </div>
  );
}
