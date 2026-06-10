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
    return [
      new RenkoGridLinesPaneView(this), // Grid lines drawn behind
      new ThickWicksPaneView(this),     // Wicks drawn on top
    ];
  }
}

class RenkoGridLinesPaneView {
  constructor(primitive) {
    this._primitive = primitive;
  }

  zOrder() {
    return 'bottom'; // Renders behind the candlestick bodies
  }

  renderer() {
    return new RenkoGridLinesRenderer(this._primitive);
  }
}

class RenkoGridLinesRenderer {
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

      // Pad range slightly beyond the data min/max
      const startPrice = Math.floor((minPrice - 150) / brickSize) * brickSize;
      const endPrice = Math.ceil((maxPrice + 150) / brickSize) * brickSize;

      // Style grid lines to match theme
      ctx.lineWidth = (options.gridLineWidth || 1) * verticalPixelRatio;
      ctx.strokeStyle = options.gridColor || 'rgba(0, 0, 0, 0.08)';
      ctx.setLineDash([]); // Draw solid lines

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
    });
  }
}

class ThickWicksPaneView {
  constructor(primitive) {
    this._primitive = primitive;
  }

  zOrder() {
    return 'top'; // Renders on top
  }

  renderer() {
    return new ThickWicksRenderer(this._primitive);
  }
}

class ThickWicksRenderer {
  constructor(primitive) {
    this._primitive = primitive;
  }

  draw(target) {
    const chart = this._primitive._chart;
    const series = this._primitive._series;
    const data = this._primitive._data;
    const options = this._primitive._options;

    if (!chart || !series || !data || data.length === 0) return;

    target.useBitmapCoordinateSpace((scope) => {
      const ctx = scope.context;
      const horizontalPixelRatio = scope.horizontalPixelRatio;
      const verticalPixelRatio = scope.verticalPixelRatio;

      // Configure wick style
      ctx.lineWidth = (options.wickWidth || 3) * horizontalPixelRatio; // Default to 3px width
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
      priceScale: {
        borderColor: 'rgba(0, 0, 0, 0.15)',
        autoScale: true,
      },
      timeScale: {
        borderColor: 'rgba(0, 0, 0, 0.15)',
        timeVisible: true,
        secondsVisible: true,
        barSpacing: 18, // Zoom in by default to make wicks and bars visually thicker
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
      let t = Math.floor(Date.parse(item.time) / 1000);
      if (isNaN(t)) {
        t = lastTime + 1;
      }
      if (t <= lastTime) {
        t = lastTime + 1;
      }
      lastTime = t;
      return {
        ...item,
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
      gridColor: 'rgba(0, 0, 0, 0.08)',
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

    // Fit content inside visible range initially
    chart.timeScale().fitContent();

    // Handle Clicks for Annotation Placement
    chart.subscribeClick((param) => {
      if (!param || !param.time || !param.point) return;

      // Find the clicked Renko brick in our formatted dataset
      const clickedBrick = formattedData.find(d => d.time === param.time);
      if (clickedBrick) {
        onBrickClick(clickedBrick);
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
    };
  }, [data]);

  // Synchronize Markers (Annotations) whenever annotations or data updates
  useEffect(() => {
    if (!candlestickSeriesRef.current || !data || data.length === 0) return;

    // Recalculate formatted times mapping to map database ISO times back to chart unix times
    let lastTime = 0;
    const timeMapping = {}; // ISO String -> Unix Timestamp
    data.forEach(item => {
      let t = Math.floor(Date.parse(item.time) / 1000);
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
              color: '#00e676', // Emerald Green
              shape: 'arrowUp',
              text: 'BUY',
            });
          } else if (ann.action === 'Sell') {
            markers.push({
              time: chartTime,
              position: 'aboveBar',
              color: '#ff1744', // Ruby Red
              shape: 'arrowDown',
              text: 'SELL',
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

    createSeriesMarkers(candlestickSeriesRef.current, markers);
  }, [annotations, data]);

  return (
    <div className="chart-wrapper">
      <div ref={chartContainerRef} style={{ width: '100%', height: '100%' }} />
    </div>
  );
}
