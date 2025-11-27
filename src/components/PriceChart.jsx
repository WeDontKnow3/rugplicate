import React, { useEffect, useRef, useState } from 'react';

export default function PriceChart({ series = [] }) {
  const outerRef = useRef(null);
  const containerRef = useRef(null);
  const chartRef = useRef(null);
  const [useFallback, setUseFallback] = useState(false);
  const [libErrorMsg, setLibErrorMsg] = useState(null);
  const [hover, setHover] = useState(null);
  const [totalWidth, setTotalWidth] = useState(760);

  function computeTotalWidthFromSeries(containerWidth, itemCount) {
    const paddingLeft = 70;
    const paddingRight = 20;
    const innerW = Math.max(10, containerWidth - paddingLeft - paddingRight);
    const candleWidth = Math.max(8, Math.min(20, Math.floor(innerW / Math.max(1, Math.min(itemCount, 200)))));
    const gapWidth = Math.max(1, candleWidth * 0.15);
    const totalCandleWidth = candleWidth + gapWidth;
    return Math.max(containerWidth, Math.ceil(paddingLeft + itemCount * totalCandleWidth + paddingRight));
  }

  useEffect(() => {
    let mounted = true;
    import('lightweight-charts')
      .then(({ createChart }) => {
        if (!mounted || !outerRef.current || !containerRef.current) return;
        const outerWidth = outerRef.current.clientWidth || 760;
        const count = Math.max(1, series.length);
        const computedTotal = computeTotalWidthFromSeries(outerWidth, count);
        setTotalWidth(computedTotal);
        const chart = createChart(containerRef.current, {
          width: computedTotal,
          height: 350,
          layout: {
            background: { type: 'solid', color: '#071029' },
            textColor: '#d1e6ff'
          },
          grid: {
            vertLines: { color: 'rgba(255,255,255,0.04)' },
            horzLines: { color: 'rgba(255,255,255,0.04)' }
          },
          crosshair: {
            mode: 1,
            vertLine: {
              width: 1,
              color: 'rgba(209, 230, 255, 0.3)',
              style: 2,
              labelBackgroundColor: '#1a3a5c'
            },
            horzLine: {
              width: 1,
              color: 'rgba(209, 230, 255, 0.3)',
              style: 2,
              labelBackgroundColor: '#1a3a5c'
            }
          },
          rightPriceScale: {
            visible: true,
            borderColor: 'rgba(255,255,255,0.04)',
            textColor: '#d1e6ff',
            scaleMargins: { top: 0.15, bottom: 0.15 }
          },
          timeScale: {
            timeVisible: true,
            secondsVisible: false,
            borderColor: 'rgba(255,255,255,0.04)',
            textColor: '#d1e6ff'
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
          borderVisible: false
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

        const handleResize = () => {
          if (!outerRef.current || !containerRef.current) return;
          const outerWidth2 = outerRef.current.clientWidth || 760;
          const computed = computeTotalWidthFromSeries(outerWidth2, Math.max(1, series.length));
          setTotalWidth(computed);
          try {
            chart.applyOptions({ width: computed });
          } catch (e) {}
        };

        window.addEventListener('resize', handleResize);

        chartRef.current = { chart, candlestickSeries, setData, handleResize };
      })
      .catch(err => {
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
      const outerWidth = outerRef.current ? outerRef.current.clientWidth : 760;
      const computedTotal = computeTotalWidthFromSeries(outerWidth, Math.max(1, series.length));
      setTotalWidth(computedTotal);
      try {
        chartRef.current.chart.applyOptions({ width: computedTotal });
      } catch (e) {}
      chartRef.current.setData(series);
      return;
    }
    const outerWidth = outerRef.current ? outerRef.current.clientWidth : 760;
    const computedTotal = computeTotalWidthFromSeries(outerWidth, Math.max(1, series.length));
    setTotalWidth(computedTotal);
  }, [series]);

  if (!useFallback) {
    return (
      <div ref={outerRef} style={{ width: '100%', overflowX: 'auto' }}>
        <div style={{ width: totalWidth, height: 350, position: 'relative' }}>
          <div ref={containerRef} style={{ width: totalWidth, height: 350 }} />
        </div>
      </div>
    );
  }

  const points = series.filter(p => p.close != null);
  if (points.length === 0) {
    return (
      <div style={{ padding: 18, borderRadius: 10, background: 'rgba(255,255,255,0.02)', color: '#cfe6ff' }}>
        Sem dados para mostrar.
        {libErrorMsg ? <div style={{ fontSize: 12, marginTop: 6, color: '#fca5a5' }}>lightweight-charts erro: {libErrorMsg}</div> : null}
      </div>
    );
  }

  const w = outerRef.current ? Math.max(totalWidth, outerRef.current.clientWidth || 760) : totalWidth;
  const h = 350;
  const padding = { left: 70, right: 20, top: 20, bottom: 35 };
  const innerW = Math.max(10, w - padding.left - padding.right);
  const innerH = Math.max(10, h - padding.top - padding.bottom);

  const sorted = [...points].sort((a, b) => new Date(a.time) - new Date(b.time));
  const allPrices = sorted.flatMap(p => [p.open, p.high, p.low, p.close]);
  const minP = Math.min(...allPrices);
  const maxP = Math.max(...allPrices);
  const range = maxP - minP || maxP || 1;

  const candleWidth = Math.max(8, Math.min(20, Math.floor(innerW / Math.max(1, Math.min(sorted.length, 200)))));
  const gapWidth = Math.max(1, candleWidth * 0.15);
  const totalCandleWidth = candleWidth + gapWidth;
  const wickWidth = Math.max(1.5, candleWidth * 0.15);

  function priceToY(price) {
    const ratio = (Number(price) - minP) / range;
    return padding.top + (1 - ratio) * innerH;
  }

  function handleMouseMove(e) {
    const rect = e.currentTarget.getBoundingClientRect();
    const scrollLeft = outerRef.current ? outerRef.current.scrollLeft : 0;
    const mx = e.clientX - rect.left + scrollLeft;
    const relativeX = mx - padding.left;
    const idx = Math.floor(relativeX / totalCandleWidth);
    if (idx >= 0 && idx < sorted.length) {
      setHover({ idx, item: sorted[idx], x: padding.left + idx * totalCandleWidth + candleWidth / 2 });
    } else {
      setHover(null);
    }
  }

  function handleMouseLeave() { setHover(null); }

  const ticks = 6;
  const tickVals = Array.from({ length: ticks + 1 }, (_, i) => minP + (i / ticks) * range).reverse();

  const svgWidth = Math.max(w, Math.ceil(padding.left + sorted.length * totalCandleWidth + padding.right));

  return (
    <div ref={outerRef} style={{ width: '100%', overflowX: 'auto' }}>
      <div style={{ width: svgWidth, height: h, position: 'relative', borderRadius: 8, overflow: 'visible', background: 'linear-gradient(180deg, rgba(255,255,255,0.01), rgba(255,255,255,0.003))' }}>
        <svg width={svgWidth} height={h} onMouseMove={handleMouseMove} onMouseLeave={handleMouseLeave} style={{ display: 'block' }}>
          <g>
            {tickVals.map((v, i) => {
              const ty = padding.top + (i / ticks) * innerH;
              return (
                <g key={i}>
                  <line x1={padding.left} x2={svgWidth - padding.right} y1={ty} y2={ty} stroke="rgba(255,255,255,0.04)" strokeWidth={1} />
                  <text x={padding.left - 10} y={ty + 4} fontSize={12} fill="#9fb0d4" textAnchor="end">{Number(v).toFixed(6)}</text>
                </g>
              );
            })}
          </g>

          {sorted.map((candle, i) => {
            const x = padding.left + i * totalCandleWidth + candleWidth / 2;
            const yOpen = priceToY(candle.open);
            const yClose = priceToY(candle.close);
            const yHigh = priceToY(candle.high);
            const yLow = priceToY(candle.low);

            const isUp = candle.close >= candle.open;
            const color = isUp ? '#26a69a' : '#ef5350';
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
                  stroke={color}
                  strokeWidth={wickWidth}
                  opacity={isHovered ? 1 : 0.9}
                />
                <rect
                  x={x - candleWidth / 2}
                  y={bodyTop}
                  width={candleWidth}
                  height={bodyHeight}
                  fill={color}
                  opacity={isHovered ? 1 : 0.95}
                />
              </g>
            );
          })}

          {hover && (
            <line
              x1={hover.x}
              x2={hover.x}
              y1={padding.top}
              y2={h - padding.bottom}
              stroke="rgba(209, 230, 255, 0.2)"
              strokeWidth={1}
              strokeDasharray="4,4"
            />
          )}
        </svg>

        {hover && (
          <div style={{
            position: 'absolute',
            left: Math.min(svgWidth - 220, Math.max(15, hover.x - 100)),
            top: 25,
            background: 'rgba(7, 16, 41, 0.95)',
            color: '#d1e6ff',
            padding: '12px 14px',
            borderRadius: 8,
            fontSize: 13,
            pointerEvents: 'none',
            boxShadow: '0 8px 24px rgba(2,6,23,0.6)',
            border: '1px solid rgba(255,255,255,0.1)',
            minWidth: 180
          }}>
            <div style={{ fontSize: 11, color: '#9fb0d4', marginBottom: 8, fontWeight: 500 }}>
              {new Date(hover.item.time).toLocaleString()}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
              <span style={{ color: '#9fb0d4' }}>Open</span>
              <span style={{ fontWeight: 600 }}>{hover.item.open}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
              <span style={{ color: '#9fb0d4' }}>High</span>
              <span style={{ fontWeight: 600, color: '#26a69a' }}>{hover.item.high}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
              <span style={{ color: '#9fb0d4' }}>Low</span>
              <span style={{ fontWeight: 600, color: '#ef5350' }}>{hover.item.low}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ color: '#9fb0d4' }}>Close</span>
              <span style={{ fontWeight: 600 }}>{hover.item.close}</span>
            </div>
            <div style={{ paddingTop: 8, borderTop: '1px solid rgba(255,255,255,0.1)', textAlign: 'center' }}>
              <span style={{
                fontWeight: 700,
                fontSize: 14,
                color: hover.item.close >= hover.item.open ? '#26a69a' : '#ef5350'
              }}>
                {hover.item.close >= hover.item.open ? '▲ ' : '▼ '}
                {Math.abs((hover.item.close - hover.item.open) / (hover.item.open || 1) * 100).toFixed(2)}%
              </span>
            </div>
          </div>
        )}

        <div style={{ position: 'absolute', left: 15, bottom: 10, color: '#9fb0d4', fontSize: 11 }}>
          {libErrorMsg ? 'loaded' : 'candlesticks'}
        </div>
      </div>
    </div>
  );
}
