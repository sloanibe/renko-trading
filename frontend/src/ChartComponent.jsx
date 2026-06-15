import React, { useEffect, useRef } from 'react';
import { createChart, CandlestickSeries, LineSeries, createSeriesMarkers } from 'lightweight-charts';

// Combined Renko overlay primitive for drawing 15-point custom grid lines and bold wicks
class RenkoOverlayPrimitive {
  constructor(data, options = {}) {
    this._data = data;
    this._options = options;
    this._chart = null;
    this._series = null;
    this._requestUpdate = null;

    this._minPrice = Infinity;
    this._maxPrice = -Infinity;
    this._calculatePriceRange();
  }

  updateData(data) {
    this._data = data;
    this._calculatePriceRange();
    if (this._requestUpdate) {
      this._requestUpdate();
    }
  }

  _calculatePriceRange() {
    if (!this._data || this._data.length === 0) {
      this._minPrice = Infinity;
      this._maxPrice = -Infinity;
      return;
    }

    let min = Infinity;
    let max = -Infinity;
    this._data.forEach((item) => {
      if (item.low < min) min = item.low;
      if (item.high > max) max = item.high;
    });
    this._minPrice = min;
    this._maxPrice = max;
  }

  attached(param) {
    this._chart = param.chart;
    this._series = param.series;
    this._requestUpdate = param.requestUpdate;
  }

  detached() {
    this._chart = null;
    this._series = null;
    this._requestUpdate = null;
  }

  paneViews() {
    return [new RenkoOverlayPaneView(this)];
  }
}

class RenkoOverlayPaneView {
  constructor(primitive) {
    this._primitive = primitive;
  }

  zOrder() {
    return 'normal'; // Draw on the standard series layer to ensure visibility over background
  }

  renderer() {
    return new RenkoOverlayRenderer(this._primitive);
  }
}

class RenkoOverlayRenderer {
  constructor(primitive) {
    this._primitive = primitive;
  }

  draw(target) {
    const chart = this._primitive._chart;
    const series = this._primitive._series;
    const data = this._primitive._data;
    const options = this._primitive._options;
    const brickSize = options.brickSize || 15.0;

    const minPrice = this._primitive._minPrice;
    const maxPrice = this._primitive._maxPrice;

    if (!chart || !series || !data || data.length === 0 || minPrice === Infinity || maxPrice === -Infinity) return;

    target.useBitmapCoordinateSpace((scope) => {
      const ctx = scope.context;
      const horizontalPixelRatio = scope.horizontalPixelRatio;
      const verticalPixelRatio = scope.verticalPixelRatio;

      // 1. Draw Custom 15-Point Grid Lines
      const startPrice = Math.floor((minPrice - 150) / brickSize) * brickSize;
      const endPrice = Math.ceil((maxPrice + 150) / brickSize) * brickSize;

      ctx.lineWidth = (options.gridLineWidth || 1) * verticalPixelRatio;
      ctx.strokeStyle = options.gridColor || 'rgba(0, 0, 0, 0.16)'; // Faint black lines for gray background
      ctx.setLineDash([]); // Solid grid lines

      const width = scope.bitmapWidth;

      for (let price = startPrice; price <= endPrice; price += brickSize) {
        const roundedPrice = Math.round(price * 100) / 100;
        const yCoordinate = series.priceToCoordinate(roundedPrice);
        if (yCoordinate === null) continue;

        const y = yCoordinate * verticalPixelRatio;

        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }

      // 2. Draw Bold 3px Wicks (on top of grid lines)
      ctx.lineWidth = (options.wickWidth || 3) * horizontalPixelRatio;
      ctx.strokeStyle = options.wickColor || '#000000';
      ctx.lineCap = 'butt';

      data.forEach((item) => {
        const time = item.time;
        const xCoordinate = chart.timeScale().timeToCoordinate(time);
        if (xCoordinate === null) return; // Not visible on screen

        const openPrice = item.open;
        const closePrice = item.close;
        const highPrice = item.high;
        const lowPrice = item.low;

        let startPrice = openPrice;
        let endPrice = openPrice;

        if (closePrice > openPrice) {
          // Up bar: wick is at the bottom, from low to open
          startPrice = lowPrice;
          endPrice = openPrice;
        } else {
          // Down bar: wick is at the top, from open to high
          startPrice = openPrice;
          endPrice = highPrice;
        }

        const startY = series.priceToCoordinate(startPrice);
        const endY = series.priceToCoordinate(endPrice);

        if (startY === null || endY === null) return;

        const x = xCoordinate * horizontalPixelRatio;
        const yStart = startY * verticalPixelRatio;
        const yEnd = endY * verticalPixelRatio;

        ctx.beginPath();
        ctx.moveTo(x, yStart);
        ctx.lineTo(x, yEnd);
        ctx.stroke();
      });
    });
  }
}


export default function ChartComponent({ data, annotations, onBrickClick }) {
  const chartContainerRef = useRef(null);
  const chartRef = useRef(null);
  const candlestickSeriesRef = useRef(null);
  const emaSeriesRef = useRef(null);
  const markersPluginRef = useRef(null);
  const sliderRef = useRef(null);

  // Button & Slider Handlers
  const handleSliderInput = (e) => {
    const chart = chartRef.current;
    if (!chart || !data) return;
    
    const start = parseFloat(e.target.value);
    const logicalRange = chart.timeScale().getVisibleLogicalRange();
    if (logicalRange) {
      const width = logicalRange.to - logicalRange.from;
      chart.timeScale().setVisibleLogicalRange({
        from: start,
        to: start + width,
      });
    }
  };

  const handleGoToStart = () => {
    const chart = chartRef.current;
    if (!chart) return;
    const logicalRange = chart.timeScale().getVisibleLogicalRange();
    if (logicalRange) {
      const width = logicalRange.to - logicalRange.from;
      chart.timeScale().setVisibleLogicalRange({
        from: 0,
        to: width,
      });
    }
  };

  const handleGoToEnd = () => {
    const chart = chartRef.current;
    if (!chart || !data) return;
    const logicalRange = chart.timeScale().getVisibleLogicalRange();
    if (logicalRange) {
      const width = logicalRange.to - logicalRange.from;
      chart.timeScale().setVisibleLogicalRange({
        from: data.length - width,
        to: data.length,
      });
    }
  };

  const handleScrollLeft = () => {
    const chart = chartRef.current;
    if (!chart) return;
    const logicalRange = chart.timeScale().getVisibleLogicalRange();
    if (logicalRange) {
      const width = logicalRange.to - logicalRange.from;
      const shift = width * 0.2;
      chart.timeScale().setVisibleLogicalRange({
        from: Math.max(0, logicalRange.from - shift),
        to: Math.max(width, logicalRange.to - shift),
      });
    }
  };

  const handleScrollRight = () => {
    const chart = chartRef.current;
    if (!chart || !data) return;
    const logicalRange = chart.timeScale().getVisibleLogicalRange();
    if (logicalRange) {
      const width = logicalRange.to - logicalRange.from;
      const shift = width * 0.2;
      const maxFrom = data.length - width;
      chart.timeScale().setVisibleLogicalRange({
        from: Math.min(maxFrom, logicalRange.from + shift),
        to: Math.min(data.length, logicalRange.to + shift),
      });
    }
  };

  const handleFitChart = () => {
    const chart = chartRef.current;
    if (chart) {
      chart.timeScale().fitContent();
    }
  };

  const handleZoomIn = () => {
    const chart = chartRef.current;
    if (!chart) return;
    const logicalRange = chart.timeScale().getVisibleLogicalRange();
    if (logicalRange) {
      const width = logicalRange.to - logicalRange.from;
      const center = (logicalRange.from + logicalRange.to) / 2;
      const newWidth = Math.max(10, width * 0.7); // Zoom in by 30%
      chart.timeScale().setVisibleLogicalRange({
        from: center - newWidth / 2,
        to: center + newWidth / 2,
      });
    }
  };

  const handleZoomOut = () => {
    const chart = chartRef.current;
    if (!chart || !data) return;
    const logicalRange = chart.timeScale().getVisibleLogicalRange();
    if (logicalRange) {
      const width = logicalRange.to - logicalRange.from;
      const center = (logicalRange.from + logicalRange.to) / 2;
      const newWidth = Math.min(data.length, width * 1.4); // Zoom out by 40%
      chart.timeScale().setVisibleLogicalRange({
        from: center - newWidth / 2,
        to: center + newWidth / 2,
      });
    }
  };

  useEffect(() => {
    if (!chartContainerRef.current || !data || data.length === 0) return;

    // Create Chart Instance
    const chart = createChart(chartContainerRef.current, {
      width: chartContainerRef.current.clientWidth,
      height: chartContainerRef.current.clientHeight,
      layout: {
        background: { color: '#9c9c9c' }, // MultiCharts neutral gray background
        textColor: '#000000', // Black labels for high contrast on gray background
        fontFamily: 'Inter, system-ui, sans-serif',
      },
      grid: {
        vertLines: { color: 'rgba(0, 0, 0, 0.08)' },
        horzLines: { visible: false }, // Disable native horizontal lines (using custom 15pt grid)
      },
      crosshair: {
        mode: 1, // Normal crosshair
        vertLine: {
          color: '#334155',
          width: 1,
          style: 3, // dashed
          labelBackgroundColor: '#1e293b',
        },
        horzLine: {
          color: '#334155',
          width: 1,
          style: 3, // dashed
          labelBackgroundColor: '#1e293b',
        },
      },
      rightPriceScale: {
        borderColor: 'rgba(0, 0, 0, 0.15)',
        autoScale: true,
        scaleMargins: {
          top: 0.15,
          bottom: 0.15,
        },
      },
      timeScale: {
        borderColor: 'rgba(0, 0, 0, 0.15)',
        timeVisible: true,
        secondsVisible: true,
        barSpacing: 18, // Zoom in by default to make wicks and bars visually thicker
        tickMarkFormatter: (time, tickMarkType, locale) => {
          const date = new Date(time * 1000);
          const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
          switch (tickMarkType) {
            case 0: // Year
              return String(date.getUTCFullYear());
            case 1: // Month
              return MONTHS[date.getUTCMonth()];
            case 2: // DayOfMonth
              return String(date.getUTCDate());
            case 3: // Time
            case 4: // TimeWithSeconds
              const hours = String(date.getUTCHours()).padStart(2, '0');
              const minutes = String(date.getUTCMinutes()).padStart(2, '0');
              const seconds = String(date.getUTCSeconds()).padStart(2, '0');
              return `${hours}:${minutes}:${seconds}`;
            default:
              return '';
          }
        },
      },
      localization: {
        locale: 'en-US',
        timeFormatter: (timestamp) => {
          const date = new Date(timestamp * 1000);
          const year = date.getUTCFullYear();
          const month = String(date.getUTCMonth() + 1).padStart(2, '0');
          const day = String(date.getUTCDate()).padStart(2, '0');
          const hours = String(date.getUTCHours()).padStart(2, '0');
          const minutes = String(date.getUTCMinutes()).padStart(2, '0');
          const seconds = String(date.getUTCSeconds()).padStart(2, '0');
          return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
        },
      },
    });

    chartRef.current = chart;

    // Add Candlestick Series (for Renko Bricks + Wicks)
    const candlestickSeries = chart.addSeries(CandlestickSeries, {
      upColor: '#004cff',       // Lightened vibrant royal blue
      downColor: '#cc1a1a',     // Lightened vibrant deep red
      borderVisible: true,      // Keep borders
      borderUpColor: '#000000', // Solid black borders for crisp definition
      borderDownColor: '#000000',
      wickVisible: false,      // Hide default 1px wicks (our custom primitive draws thick wicks)
    });
    candlestickSeriesRef.current = candlestickSeries;

    // Add Line Series (for the 8 EMA)
    const emaSeries = chart.addSeries(LineSeries, {
      color: '#008000',         // MultiCharts Green for EMA
      lineWidth: 2,
      priceLineVisible: false,  // Hide horizontal current price line for EMA
    });
    emaSeriesRef.current = emaSeries;

    // Format Data & ensure strict ascending timestamps (TradingView requirement)
    let lastTime = 0;
    const formattedData = data.map(item => {
      // Append 'Z' to treat the date as UTC and prevent timezone offsets on display
      let t = Math.floor(Date.parse(item.time + 'Z') / 1000);
      if (isNaN(t)) {
        t = lastTime + 1;
      }
      if (t <= lastTime) {
        t = lastTime + 1;
      }
      lastTime = t;
      return {
        ...item,
        originalTime: item.time, // Preserve original ISO string for annotation keys
        time: t,
      };
    });

    // Populate Candlestick Series
    const candleData = formattedData.map(d => ({
      time: d.time,
      open: d.open,
      high: d.high,
      low: d.low,
      close: d.close,
    }));
    candlestickSeries.setData(candleData);

    // Attach custom bold wicks and 15pt grid overlay primitive
    const renkoOverlay = new RenkoOverlayPrimitive(formattedData, {
      wickWidth: 3, // 3 pixels wide
      wickColor: '#000000',
      brickSize: 15.0, // Align custom grid lines with 15pt Renko
      gridColor: 'rgba(0, 0, 0, 0.18)',
    });
    candlestickSeries.attachPrimitive(renkoOverlay);

    // Populate EMA Series
    const emaData = formattedData
      .filter(d => d.ema !== undefined && d.ema !== null)
      .map(d => ({
        time: d.time,
        value: d.ema,
      }));
    emaSeries.setData(emaData);

    // Set initial visible range (show last 150 bars to be zoomed in and readable)
    const totalBars = formattedData.length;
    const defaultVisibleBars = 150;
    if (totalBars > defaultVisibleBars) {
      chart.timeScale().setVisibleLogicalRange({
        from: totalBars - defaultVisibleBars,
        to: totalBars,
      });
    } else {
      chart.timeScale().fitContent();
    }

    // Sync slider with chart scroll
    const handleVisibleRangeChange = (logicalRange) => {
      if (!logicalRange) return;
      const from = logicalRange.from;
      const to = logicalRange.to;
      const width = to - from;
      if (sliderRef.current) {
        const maxVal = Math.max(0, formattedData.length - width);
        sliderRef.current.max = maxVal;
        sliderRef.current.value = Math.min(maxVal, Math.max(0, from));
      }
    };
    chart.timeScale().subscribeVisibleLogicalRangeChange(handleVisibleRangeChange);

    // Handle Clicks for Annotation Placement (only on the actual bar)
    chart.subscribeClick((param) => {
      if (!param || !param.time || !param.point) return;

      // Find the clicked Renko brick in our formatted dataset
      const clickedBrick = formattedData.find(d => d.time === param.time);
      if (clickedBrick && chartContainerRef.current) {
        const yClick = param.point.y;
        const yHigh = candlestickSeries.priceToCoordinate(clickedBrick.high);
        const yLow = candlestickSeries.priceToCoordinate(clickedBrick.low);

        if (yHigh !== null && yLow !== null) {
          const padding = 8; // 8px tolerance padding for easier clicking
          if (yClick >= yHigh - padding && yClick <= yLow + padding) {
            const rect = chartContainerRef.current.getBoundingClientRect();
            const viewportX = rect.left + param.point.x;
            const viewportY = rect.top + param.point.y;
            onBrickClick(clickedBrick, { x: viewportX, y: viewportY });
          }
        }
      }
    });

    // Handle Resize
    const handleResize = () => {
      if (chartContainerRef.current) {
        chart.resize(
          chartContainerRef.current.clientWidth,
          chartContainerRef.current.clientHeight
        );
      }
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      chart.remove();
      markersPluginRef.current = null;
    };
  }, [data]);

  // Synchronize Markers (Annotations) whenever annotations or data updates
  useEffect(() => {
    if (!candlestickSeriesRef.current || !data || data.length === 0) return;

    // Recalculate formatted times mapping to map database ISO times back to chart unix times
    let lastTime = 0;
    const timeMapping = {}; // ISO String -> Unix Timestamp
    data.forEach(item => {
      // Append 'Z' to treat the date as UTC and match the price series timestamps
      let t = Math.floor(Date.parse(item.time + 'Z') / 1000);
      if (isNaN(t)) {
        t = lastTime + 1;
      }
      if (t <= lastTime) {
        t = lastTime + 1;
      }
      lastTime = t;
      timeMapping[item.time] = t;
    });

    // Build Chart Markers
    const markers = [];
    if (annotations && annotations.length > 0) {
      annotations.forEach(ann => {
        const chartTime = timeMapping[ann.timestamp];
        if (chartTime) {
          if (ann.action === 'Buy') {
            markers.push({
              time: chartTime,
              position: 'belowBar',
              color: ann.isSystem ? '#1b5e20' : '#00e676', // Deep forest green for system, emerald for user
              shape: 'arrowUp',
              text: ann.isSystem ? 'SYS BUY' : 'BUY',
            });
          } else if (ann.action === 'Sell') {
            markers.push({
              time: chartTime,
              position: 'aboveBar',
              color: ann.isSystem ? '#b71c1c' : '#ff1744', // Deep red for system, ruby for user
              shape: 'arrowDown',
              text: ann.isSystem ? 'SYS SELL' : 'SELL',
            });
          } else if (ann.action === 'Skip') {
            markers.push({
              time: chartTime,
              position: 'aboveBar',
              color: '#ff9100', // Amber Orange
              shape: 'circle',
              text: 'SKIP',
            });
          }
        }
      });
    }

    console.log("SYNCING MARKERS: annotations=", annotations, "generated markers=", markers);
    if (!markersPluginRef.current) {
      markersPluginRef.current = createSeriesMarkers(candlestickSeriesRef.current, markers);
    } else {
      markersPluginRef.current.setMarkers(markers);
    }
  }, [annotations, data]);

  return (
    <div className="chart-wrapper" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div ref={chartContainerRef} style={{ flex: 1, minHeight: 0 }} />
      <div className="chart-controls">
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
          <span style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-secondary)', minWidth: '40px' }}>Start</span>
          <input
            ref={sliderRef}
            type="range"
            min="0"
            max={data ? Math.max(0, data.length - 150) : 100}
            defaultValue="0"
            onInput={handleSliderInput}
            className="timeline-slider"
          />
          <span style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-secondary)', minWidth: '40px', textAlign: 'right' }}>End</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <button onClick={handleGoToStart} className="control-btn" title="Go to Beginning">⏮ Go to Start</button>
          <button onClick={handleScrollLeft} className="control-btn" title="Scroll Left">◀ Scroll Left</button>
          <button onClick={handleZoomOut} className="control-btn" title="Zoom Out">➖ Zoom Out</button>
          <button onClick={handleFitChart} className="control-btn" title="Show All Data">🔍 Fit All</button>
          <button onClick={handleZoomIn} className="control-btn" title="Zoom In">➕ Zoom In</button>
          <button onClick={handleScrollRight} className="control-btn" title="Scroll Right">Scroll Right ▶</button>
          <button onClick={handleGoToEnd} className="control-btn" title="Go to Latest">Go to End ⏭</button>
        </div>
      </div>
    </div>
  );
}
