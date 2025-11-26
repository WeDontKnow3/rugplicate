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
          height: 280,
          layout: {
            background: { type: 'solid', color: '#0d1117' },
            textColor: '#8b92a7'
          },
          grid: {
            vertLines: { color: 'rgba(42, 46, 57, 0.5)' },
            horzLines: { color: 'rgba(42, 46, 57, 0.5)' }
          },
          crosshair: {
            mode: 1,
            vertLine: {
              width: 1,
              color: 'rgba(138, 146, 167, 0.3)',
              style: 2,
              labelBackgroundColor: '#2a2e39'
            },
            horzLine: {
              width: 1,
              color: 'rgba(138, 146, 167, 0.3)',
              style: 2,
              labelBackgroundColor: '#2a2e39'
            }
          },
          rightPriceScale: {
            visible: true,
            borderColor: '#2a2e39',
            textColor: '#8b92a7',
            scaleMargins: {
              top: 0.1,
              bottom: 0.1
            }
          },
          timeScale: {
            timeVisible: true,
            secondsVisible: false,
            borderColor: '#2a2e39',
            textColor: '#8b92a7'
          }
        });

        const candlestickSeries = chart.addCandlestickSeries({
          upColor: '#26a69a',
          downColor: '#ef5350',
          borderUpColor: '#26a69a',
          borderDownColor: '#ef5350',
          wickUpColor: '#26a69a',
          wickDownColor: '#ef5350',
          priceLineVisible: false,
          borderVisible: true
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
      <div style={{ width: '100%', height: 280, position: 'relative' }}>
        <div ref={containerRef} style={{ width: '100%', height: 280 }} />
      </div>
    );
  }

  const points = series.filter(p => p.close != null);
  if (points.length === 0) {
    return (
      <div style={{ padding: 18, borderRadius: 10, background: 'rgba(255,255,255,0.02)', color: '#cfe6ff' }}>
        Sem dados para mostrar.
        {libErrorMsg ? <div style={{fontSize:12, marginTop:6, color:'#fca5a5'}}>lightweight-charts erro: {libErrorMsg}</div> : null}
      </div>
    );
  }

  const w = containerRef.current ? containerRef.current.clientWidth : 760;
  const h = 280;
  const padding = { left: 60, right: 10, top: 12, bottom: 30 };
  const innerW = Math.max(10, w - padding.left - padding.right);
  const innerH = Math.max(10, h - padding.top - padding.bottom);

  const sorted = [...points].sort((a,b) => new Date(a.time) - new Date(b.time));
  const allPrices = sorted.flatMap(p => [p.open, p.high, p.low, p.close]);
  const minP = Math.min(...allPrices);
  const maxP = Math.max(...allPrices);
  const range = maxP - minP || maxP || 1;

  const candleSpacing = innerW / sorted.length;
  const candleWidth = Math.max(2, Math.min(12, candleSpacing * 0.8));

  function priceToY(price) {
    const ratio = (Number(price) - minP) / range;
    return padding.top + (1 - ratio) * innerH;
  }

  function handleMouseMove(e) {
    const rect = e.currentTarget.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const idx = Math.floor((mx - padding.left) / candleSpacing);
    if (idx >= 0 && idx < sorted.length) {
      setHover({ idx, item: sorted[idx], x: padding.left + (idx + 0.5) * candleSpacing });
    }
  }
  
  function handleMouseLeave() { setHover(null); }

  const ticks = 4;
  const tickVals = Array.from({length: ticks+1}, (_,i) => minP + (i/ticks)*range).reverse();

  return (
    <div ref={containerRef} style={{ width: '100%', height: h, position: 'relative', borderRadius: 8, overflow: 'hidden', background: '#0d1117' }}>
      <svg width={w} height={h} onMouseMove={handleMouseMove} onMouseLeave={handleMouseLeave} style={{display:'block'}}>
        <rect width={w} height={h} fill="#0d1117"/>
        
        <g>
          {tickVals.map((v,i) => {
            const ty = padding.top + (i / ticks) * innerH;
            return (
              <g key={i}>
                <line x1={padding.left} x2={w - padding.right} y1={ty} y2={ty} stroke="rgba(42, 46, 57, 0.5)" strokeWidth={1} />
                <text x={padding.left - 8} y={ty+4} fontSize={11} fill="#8b92a7" textAnchor="end">{Number(v).toFixed(6)}</text>
              </g>
            );
          })}
        </g>

        {sorted.map((candle, i) => {
          const x = padding.left + (i + 0.5) * candleSpacing;
          const yOpen = priceToY(candle.open);
          const yClose = priceToY(candle.close);
          const yHigh = priceToY(candle.high);
          const yLow = priceToY(candle.low);
          
          const isUp = candle.close >= candle.open;
          const color = isUp ? '#26a69a' : '#ef5350';
          const bodyTop = Math.min(yOpen, yClose);
          const bodyHeight = Math.max(1.5, Math.abs(yClose - yOpen));

          const isHovered = hover?.idx === i;

          return (
            <g key={i}>
              <line 
                x1={x} 
                x2={x} 
                y1={yHigh} 
                y2={yLow} 
                stroke={color} 
                strokeWidth={1.5}
                opacity={isHovered ? 1 : 0.95}
              />
              <rect 
                x={x - candleWidth / 2} 
                y={bodyTop} 
                width={candleWidth} 
                height={bodyHeight} 
                fill={color}
                stroke={color}
                strokeWidth={0.5}
                opacity={isHovered ? 1 : 0.95}
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
              stroke="rgba(138, 146, 167, 0.3)" 
              strokeWidth={1}
              strokeDasharray="3,3"
            />
          </>
        )}
      </svg>

      {hover && (
        <div style={{
          position:'absolute', 
          left: Math.min(w - 210, Math.max(10, hover.x + 10)), 
          top: 10,
          background: 'rgba(13, 17, 23, 0.95)', 
          color:'#d1e6ff', 
          padding:'10px 12px', 
          borderRadius:6, 
          fontSize:12, 
          pointerEvents:'none', 
          boxShadow:'0 4px 12px rgba(0,0,0,0.6)',
          border: '1px solid rgba(138, 146, 167, 0.2)',
          minWidth: 180
        }}>
          <div style={{fontSize:10, color:'#8b92a7', marginBottom:8}}>
            {new Date(hover.item.time).toLocaleString()}
          </div>
          <div style={{display:'flex', justifyContent:'space-between', marginBottom:3}}>
            <span style={{color:'#8b92a7'}}>O</span>
            <span style={{fontWeight:600}}>{hover.item.open}</span>
          </div>
          <div style={{display:'flex', justifyContent:'space-between', marginBottom:3}}>
            <span style={{color:'#8b92a7'}}>H</span>
            <span style={{fontWeight:600, color:'#26a69a'}}>{hover.item.high}</span>
          </div>
          <div style={{display:'flex', justifyContent:'space-between', marginBottom:3}}>
            <span style={{color:'#8b92a7'}}>L</span>
            <span style={{fontWeight:600, color:'#ef5350'}}>{hover.item.low}</span>
          </div>
          <div style={{display:'flex', justifyContent:'space-between'}}>
            <span style={{color:'#8b92a7'}}>C</span>
            <span style={{fontWeight:600}}>{hover.item.close}</span>
          </div>
          <div style={{marginTop:8, paddingTop:8, borderTop:'1px solid rgba(138, 146, 167, 0.2)', fontSize:11}}>
            <span style={{
              fontWeight:600, 
              color: hover.item.close >= hover.item.open ? '#26a69a' : '#ef5350'
            }}>
              {hover.item.close >= hover.item.open ? '+' : ''}
              {((hover.item.close - hover.item.open) / hover.item.open * 100).toFixed(2)}%
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
