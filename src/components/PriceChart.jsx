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
          height: 260,
          layout: {
            background: { type: 'solid', color: '#071029' },
            textColor: '#d1e6ff'
          },
          grid: {
            vertLines: { color: 'rgba(255,255,255,0.03)' },
            horzLines: { color: 'rgba(255,255,255,0.03)' }
          },
          crosshair: { mode: 1 },
          rightPriceScale: { visible: true },
          timeScale: {
            timeVisible: true,
            secondsVisible: false,
            borderColor: 'rgba(255,255,255,0.04)'
          }
        });

        const candlestickSeries = chart.addCandlestickSeries({
          upColor: '#26a69a',
          downColor: '#ef5350',
          borderUpColor: '#26a69a',
          borderDownColor: '#ef5350',
          wickUpColor: '#26a69a',
          wickDownColor: '#ef5350'
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
      <div style={{ width: '100%', height: 260, position: 'relative' }}>
        <div ref={containerRef} style={{ width: '100%', height: 260 }} />
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
  const h = 260;
  const padding = { left: 36, right: 10, top: 12, bottom: 24 };
  const innerW = Math.max(10, w - padding.left - padding.right);
  const innerH = Math.max(10, h - padding.top - padding.bottom);

  const sorted = [...points].sort((a,b) => new Date(a.time) - new Date(b.time));
  const allPrices = sorted.flatMap(p => [p.open, p.high, p.low, p.close]);
  const minP = Math.min(...allPrices);
  const maxP = Math.max(...allPrices);
  const range = maxP - minP || maxP || 1;

  const candleWidth = Math.max(2, innerW / sorted.length - 2);

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
      setHover({ idx, item: sorted[idx] });
    }
  }
  
  function handleMouseLeave() { setHover(null); }

  const ticks = 4;
  const tickVals = Array.from({length: ticks+1}, (_,i) => minP + (i/ticks)*range).reverse();

  return (
    <div ref={containerRef} style={{ width: '100%', height: h, position: 'relative', borderRadius: 8, overflow: 'hidden', background: 'linear-gradient(180deg, rgba(255,255,255,0.01), rgba(255,255,255,0.003))' }}>
      <svg width={w} height={h} onMouseMove={handleMouseMove} onMouseLeave={handleMouseLeave} style={{display:'block'}}>
        <g>
          {tickVals.map((v,i) => {
            const ty = padding.top + (i / ticks) * innerH;
            return <text key={i} x={6} y={ty+4} fontSize={11} fill="#9fb0d4">{Number(v).toFixed(6)}</text>;
          })}
        </g>

        {sorted.map((candle, i) => {
          const x = padding.left + (i / sorted.length) * innerW + (innerW / sorted.length) / 2;
          const yOpen = priceToY(candle.open);
          const yClose = priceToY(candle.close);
          const yHigh = priceToY(candle.high);
          const yLow = priceToY(candle.low);
          
          const isUp = candle.close >= candle.open;
          const color = isUp ? '#26a69a' : '#ef5350';
          const bodyTop = Math.min(yOpen, yClose);
          const bodyHeight = Math.max(1, Math.abs(yClose - yOpen));

          return (
            <g key={i}>
              <line x1={x} x2={x} y1={yHigh} y2={yLow} stroke={color} strokeWidth={1} />
              <rect 
                x={x - candleWidth / 2} 
                y={bodyTop} 
                width={candleWidth} 
                height={bodyHeight} 
                fill={color}
                opacity={hover?.idx === i ? 0.8 : 0.9}
              />
            </g>
          );
        })}

        {hover && (
          <line 
            x1={padding.left + (hover.idx / sorted.length) * innerW + (innerW / sorted.length) / 2} 
            x2={padding.left + (hover.idx / sorted.length) * innerW + (innerW / sorted.length) / 2}
            y1={padding.top} 
            y2={padding.top + innerH} 
            stroke="rgba(255,255,255,0.1)" 
            strokeWidth={1}
          />
        )}
      </svg>

      {hover && (
        <div style={{
          position:'absolute', 
          left: Math.min(w - 200, padding.left + (hover.idx / sorted.length) * innerW + 8), 
          top: 8,
          background: 'rgba(2,6,23,0.95)', 
          color:'#d1e6ff', 
          padding:'10px 12px', 
          borderRadius:8, 
          fontSize:12, 
          pointerEvents:'none', 
          boxShadow:'0 8px 24px rgba(2,6,23,0.4)',
          border: '1px solid rgba(255,255,255,0.1)'
        }}>
          <div style={{marginBottom:6, fontSize:11, color:'#9fb0d4'}}>
            {new Date(hover.item.time).toLocaleString()}
          </div>
          <div style={{display:'flex', gap:'12px', fontSize:11}}>
            <div><span style={{color:'#9fb0d4'}}>O:</span> {hover.item.open}</div>
            <div><span style={{color:'#9fb0d4'}}>H:</span> {hover.item.high}</div>
          </div>
          <div style={{display:'flex', gap:'12px', fontSize:11, marginTop:2}}>
            <div><span style={{color:'#9fb0d4'}}>L:</span> {hover.item.low}</div>
            <div><span style={{color:'#9fb0d4'}}>C:</span> {hover.item.close}</div>
          </div>
        </div>
      )}

      <div style={{ position:'absolute', left:10, bottom:6, color:'#9fb0d4', fontSize:12 }}>
        {libErrorMsg ? 'graphic loaded' : 'loaded'}
      </div>
    </div>
  );
}
