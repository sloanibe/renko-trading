import React, { useState, useEffect } from 'react';
import ChartComponent from './ChartComponent';

const API_BASE = 'http://localhost:5000/api';
const ACTIVE_CHART_STORAGE_KEY = 'renko-active-chart';
const RAW_RANGE_MARKER_SET = 'Raw Range Bar Set';
const TAIL_ARROWS_MARKER_SET = 'Tail Arrows';

const isTailArrowAnnotation = annotation =>
  annotation?.tailArrow === 'up' ||
  annotation?.tailArrow === 'down' ||
  annotation?.markerSet === TAIL_ARROWS_MARKER_SET;
const CAMPAIGN_OPTIONS = {
  yellowMomentum: {
    label: 'Yellow Momentum 1:1',
    resultKey: 'yellow_momentum_campaign_results',
    entryFlag: 'isYellowMomentumCampaignEntry',
    exitFlag: 'isYellowMomentumCampaignExit',
  },
  emaBounce: {
    label: 'Campaign EMA Bounce',
    resultKey: 'ema_bounce_campaign_results',
    entryFlag: 'isEmaBounceCampaignEntry',
    exitFlag: 'isEmaBounceCampaignExit',
  },
  mesReg5Recovery: {
    label: 'MES Reg5 Daily Recovery',
    resultKey: 'mes_reg5_daily_recovery_campaign_results',
    entryFlag: 'isMesReg5RecoveryCampaignEntry',
    exitFlag: 'isMesReg5RecoveryCampaignExit',
  },
  dailyTarget: {
    label: 'Daily Target Campaign',
    resultKey: 'campaign_results',
    entryFlag: 'isCampaignEntry',
    exitFlag: 'isCampaignExit',
  },
};
const bookmarkStorageKey = chartName => `renko-bookmark:${chartName}`;
const MARKER_SETTINGS_STORAGE_KEY = 'renko-marker-settings';
const MES_RANGE_CAMPAIGN_CHARTS = ['MESM_reg_5', 'MESU_reg_5pt', 'MES_8pt', 'MES_3pt', 'MES3 Point Range'];
const isMesRangeCampaignChart = chartName => MES_RANGE_CAMPAIGN_CHARTS.includes(chartName);
const isNineEmaChart = chartName =>
  chartName?.includes('8pt') || chartName?.includes('3pt') || chartName === 'MES3 Point Range';
const defaultMarkerSetForChart = chartName =>
  chartName?.includes('Range') || chartName === 'MES3' ? RAW_RANGE_MARKER_SET : 'Training Set';

const loadMarkerSettings = () => {
  if (typeof window === 'undefined') return {};
  try {
    return JSON.parse(localStorage.getItem(MARKER_SETTINGS_STORAGE_KEY) || '{}');
  } catch {
    return {};
  }
};

const metricsMatchBrick = (metrics, brick) => {
  if (!metrics || !brick) return false;
  return ['open', 'high', 'low', 'close', 'ema'].every(key => {
    if (!Number.isFinite(metrics[key]) || !Number.isFinite(brick[key])) return true;
    return Math.abs(metrics[key] - brick[key]) < 0.0001;
  });
};

const annotationMatchesBrick = (annotation, brick) => {
  if (!annotation || !brick) return false;
  if (Number.isInteger(annotation.barIndex) && Number.isInteger(brick.originalIndex)) {
    return annotation.barIndex === brick.originalIndex;
  }

  const targetTime = brick.originalTime || brick.time;
  return annotation.timestamp === targetTime && metricsMatchBrick(annotation.metrics, brick);
};

export default function App() {
  const savedMarkerSettings = React.useMemo(loadMarkerSettings, []);
  const [charts, setCharts] = useState([]);
  const [activeChart, setActiveChart] = useState('');
  const isRegularCandlestick = activeChart?.toLowerCase().includes('reg');
  const [chartData, setChartData] = useState([]);
  const [secondaryChartData, setSecondaryChartData] = useState([]);
  const [showSecondaryPane, setShowSecondaryPane] = useState(savedMarkerSettings.showSecondaryPane ?? true);
  const [currentHaSelection, setCurrentHaSelection] = useState(null);
  const [allAnnotations, setAllAnnotations] = useState({});
  const [selectedBrick, setSelectedBrick] = useState(null);
  const [backtestResults, setBacktestResults] = useState(null);
  const [loadingBacktest, setLoadingBacktest] = useState(false);
  const [discussionStatus, setDiscussionStatus] = useState('');
  const [bookmark, setBookmark] = useState(null);
  const [annotationsDrawerOpen, setAnnotationsDrawerOpen] = useState(false);
  const [datasetsDrawerOpen, setDatasetsDrawerOpen] = useState(false);
  const [datasetActionStatus, setDatasetActionStatus] = useState('');
  const [datasetActionError, setDatasetActionError] = useState('');
  const [importingDataset, setImportingDataset] = useState(false);
  const [deletingDataset, setDeletingDataset] = useState('');
  const [datasetContextMenu, setDatasetContextMenu] = useState(null);
  const [renamingChart, setRenamingChart] = useState('');
  const [renameValue, setRenameValue] = useState('');
  const [renamingSubmitting, setRenamingSubmitting] = useState(false);
  const importFileInputRef = React.useRef(null);

  // Strategy Configuration states
  const [slopeThreshold, setSlopeThreshold] = useState(2.0);
  const [minWick, setMinWick] = useState(5.0);
  const [maxEmaDist, setMaxEmaDist] = useState(20.0);
  const [retestTolerance, setRetestTolerance] = useState(2.0);
  const [cooldownBars, setCooldownBars] = useState(0);
  const [wickBodyOffset, setWickBodyOffset] = useState(0);
  const [sessionStartTime, setSessionStartTime] = useState('06:31:00');
  const [exitStrategy, setExitStrategy] = useState('fixed'); // 'fixed', 'trail', or 'stepup' (Fixed Target by default)
  const [showTrainingAnnotations, setShowTrainingAnnotations] = useState(savedMarkerSettings.showTrainingAnnotations ?? false);
  const [showRawSignals, setShowRawSignals] = useState(savedMarkerSettings.showRawSignals ?? false);
  const [showSignalSet2, setShowSignalSet2] = useState(savedMarkerSettings.showSignalSet2 ?? true);
  const [showSignalSet3, setShowSignalSet3] = useState(savedMarkerSettings.showSignalSet3 ?? true);
  const [showMes3TrendTailSignals, setShowMes3TrendTailSignals] = useState(savedMarkerSettings.showMes3TrendTailSignals ?? false);
  const [showMes3PreviousTailSignals, setShowMes3PreviousTailSignals] = useState(savedMarkerSettings.showMes3PreviousTailSignals ?? true);
  const [showMes3HaEmaApproachSignals, setShowMes3HaEmaApproachSignals] = useState(savedMarkerSettings.showMes3HaEmaApproachSignals ?? true);
  const [showMesReg5LongTailSignals, setShowMesReg5LongTailSignals] = useState(savedMarkerSettings.showMesReg5LongTailSignals ?? true);
  const [showMesReg5EmaBounceAritySignals, setShowMesReg5EmaBounceAritySignals] = useState(savedMarkerSettings.showMesReg5EmaBounceAritySignals ?? true);
  const [showMesReg5PinBarBreakoutSignals, setShowMesReg5PinBarBreakoutSignals] = useState(savedMarkerSettings.showMesReg5PinBarBreakoutSignals ?? true);
  const [showCampaignTrades, setShowCampaignTrades] = useState(savedMarkerSettings.showCampaignTrades ?? true);
  const [campaignView, setCampaignView] = useState(savedMarkerSettings.campaignView ?? 'yellowMomentum');
  const [aridLookback, setAridLookback] = useState(8);
  const [aridMaxOverlap, setAridMaxOverlap] = useState(0.95);
  const [aridMaxReversals, setAridMaxReversals] = useState(5);
  const [aridSlopeThreshold, setAridSlopeThreshold] = useState(10.0);
  const [aridMinGap, setAridMinGap] = useState(0.5);
  const [bounceType, setBounceType] = useState('green');
  const [set3LeftLookback, setSet3LeftLookback] = useState(8);
  const [set3MaxLeftOverlaps, setSet3MaxLeftOverlaps] = useState(1);
  const [set3SlopeThreshold, setSet3SlopeThreshold] = useState(4.0);
  const [set3MinGap, setSet3MinGap] = useState(0.5);
  const [set3SyntheticMinGap, setSet3SyntheticMinGap] = useState(-0.25);
  const [optimizing, setOptimizing] = useState(false);
  const [optimizingYellowMomentum, setOptimizingYellowMomentum] = useState(false);
  const [yellowOptimizationSummary, setYellowOptimizationSummary] = useState(null);
  const [yellowSlopePeriod, setYellowSlopePeriod] = useState(8);
  const [yellowFastSlope, setYellowFastSlope] = useState(30.0);
  const [yellowSlowSlope, setYellowSlowSlope] = useState(25.0);
  const [yellowMinGap, setYellowMinGap] = useState(4.0);
  const [yellowMinPenetration, setYellowMinPenetration] = useState(1.5);
  const [yellowMinTail, setYellowMinTail] = useState(1.0);
  const [yellowArityLookback, setYellowArityLookback] = useState(8);
  const [yellowMaxOverlap, setYellowMaxOverlap] = useState(0.95);
  const [yellowMaxReversals, setYellowMaxReversals] = useState(5);

  const fetchBacktest = async (chartName, configOverrides = {}) => {
    if (!chartName) return;
    setLoadingBacktest(true);
    
    // Prioritize overrides (passed during optimization/updates) over stale states
    const slope = configOverrides.slopeThreshold !== undefined ? configOverrides.slopeThreshold : slopeThreshold;
    const wick = configOverrides.minWick !== undefined ? configOverrides.minWick : minWick;
    const dist = configOverrides.maxEmaDist !== undefined ? configOverrides.maxEmaDist : maxEmaDist;
    const tol = configOverrides.retestTolerance !== undefined ? configOverrides.retestTolerance : retestTolerance;
    const cooldownVal = configOverrides.cooldownBars !== undefined ? configOverrides.cooldownBars : cooldownBars;
    const exitStrategyVal = configOverrides.exitStrategy !== undefined ? configOverrides.exitStrategy : exitStrategy;
    const wickOffset = configOverrides.wickBodyOffset !== undefined ? configOverrides.wickBodyOffset : wickBodyOffset;
    const startTime = configOverrides.sessionStartTime !== undefined ? configOverrides.sessionStartTime : sessionStartTime;
    const yellowSlopePeriodVal = configOverrides.yellowSlopePeriod !== undefined ? configOverrides.yellowSlopePeriod : yellowSlopePeriod;
    const yellowFastSlopeVal = configOverrides.yellowFastSlope !== undefined ? configOverrides.yellowFastSlope : yellowFastSlope;
    const yellowSlowSlopeVal = configOverrides.yellowSlowSlope !== undefined ? configOverrides.yellowSlowSlope : yellowSlowSlope;
    const yellowMinGapVal = configOverrides.yellowMinGap !== undefined ? configOverrides.yellowMinGap : yellowMinGap;
    const yellowMinPenetrationVal = configOverrides.yellowMinPenetration !== undefined ? configOverrides.yellowMinPenetration : yellowMinPenetration;
    const yellowMinTailVal = configOverrides.yellowMinTail !== undefined ? configOverrides.yellowMinTail : yellowMinTail;
    const yellowArityLookbackVal = configOverrides.yellowArityLookback !== undefined ? configOverrides.yellowArityLookback : yellowArityLookback;
    const yellowMaxOverlapVal = configOverrides.yellowMaxOverlap !== undefined ? configOverrides.yellowMaxOverlap : yellowMaxOverlap;
    const yellowMaxReversalsVal = configOverrides.yellowMaxReversals !== undefined ? configOverrides.yellowMaxReversals : yellowMaxReversals;

    try {
      const params = new URLSearchParams({
        slopeThreshold: slope,
        minWick: wick,
        maxEmaDist: dist,
        retestTolerance: tol,
        cooldownBars: cooldownVal,
        exitStrategy: exitStrategyVal,
        wickBodyOffset: wickOffset,
        startTime,
        aridLookback,
        aridMaxOverlap,
        aridMaxReversals,
        aridSlopeThreshold,
        aridMinGap,
        bounceType,
        set3LeftLookback,
        set3MaxLeftOverlaps,
        set3SlopeThreshold,
        set3MinGap,
        set3SyntheticMinGap,
        yellowSlopePeriod: yellowSlopePeriodVal,
        yellowFastSlope: yellowFastSlopeVal,
        yellowSlowSlope: yellowSlowSlopeVal,
        yellowMinGap: yellowMinGapVal,
        yellowMinPenetration: yellowMinPenetrationVal,
        yellowMinTail: yellowMinTailVal,
        yellowArityLookback: yellowArityLookbackVal,
        yellowMaxOverlap: yellowMaxOverlapVal,
        yellowMaxReversals: yellowMaxReversalsVal,
      });
      const query = `?${params.toString()}`;
      const res = await fetch(`${API_BASE}/charts/${chartName}/backtest${query}`);
      const data = await res.json();
      setBacktestResults(data);
    } catch (err) {
      console.error('Failed to fetch backtest results:', err);
    } finally {
      setLoadingBacktest(false);
    }
  };

  const handleOptimize = async () => {
    if (!activeChart) return;
    setOptimizing(true);
    try {
      const res = await fetch(`${API_BASE}/charts/${activeChart}/optimize`);
      const bestConfig = await res.json();
      if (bestConfig && !bestConfig.error) {
        setSlopeThreshold(bestConfig.ema_slope_threshold);
        setMinWick(bestConfig.min_wick_length);
        setMaxEmaDist(bestConfig.max_ema_distance);
        setRetestTolerance(bestConfig.wick_retest_tolerance);
        
        // Fetch backtest with the optimized config overrides immediately
        fetchBacktest(activeChart, {
          slopeThreshold: bestConfig.ema_slope_threshold,
          minWick: bestConfig.min_wick_length,
          maxEmaDist: bestConfig.max_ema_distance,
          retestTolerance: bestConfig.wick_retest_tolerance
        });
      } else {
        alert('Optimization failed: ' + (bestConfig.error || 'Unknown error'));
      }
    } catch (err) {
      console.error('Failed to optimize parameters:', err);
      alert('Failed to connect to the optimization engine.');
    } finally {
      setOptimizing(false);
    }
  };

  const handleOptimizeYellowMomentum = async () => {
    if (!activeChart) return;
    setOptimizingYellowMomentum(true);
    try {
      const params = new URLSearchParams({
        startTime: sessionStartTime,
      });
      const res = await fetch(`${API_BASE}/charts/${activeChart}/optimize-yellow-momentum?${params.toString()}`);
      const optimization = await res.json();
      if (!optimization || optimization.error) {
        alert('Yellow Momentum optimization failed: ' + (optimization?.error || 'Unknown error'));
        return;
      }

      const cfg = optimization.best_config || {};
      const nextConfig = {
        yellowSlopePeriod: cfg.yellow_momentum_slope_period ?? yellowSlopePeriod,
        yellowFastSlope: cfg.yellow_momentum_fast_slope_threshold ?? yellowFastSlope,
        yellowSlowSlope: cfg.yellow_momentum_slow_slope_threshold ?? yellowSlowSlope,
        yellowMinGap: cfg.yellow_momentum_min_ema_gap ?? yellowMinGap,
        yellowMinPenetration: cfg.yellow_momentum_min_penetration ?? yellowMinPenetration,
        yellowMinTail: cfg.yellow_momentum_min_tail ?? yellowMinTail,
        yellowArityLookback: cfg.yellow_momentum_arity_lookback ?? yellowArityLookback,
        yellowMaxOverlap: cfg.yellow_momentum_max_overlap ?? yellowMaxOverlap,
        yellowMaxReversals: cfg.yellow_momentum_max_reversals ?? yellowMaxReversals,
      };

      setYellowSlopePeriod(nextConfig.yellowSlopePeriod);
      setYellowFastSlope(nextConfig.yellowFastSlope);
      setYellowSlowSlope(nextConfig.yellowSlowSlope);
      setYellowMinGap(nextConfig.yellowMinGap);
      setYellowMinPenetration(nextConfig.yellowMinPenetration);
      setYellowMinTail(nextConfig.yellowMinTail);
      setYellowArityLookback(nextConfig.yellowArityLookback);
      setYellowMaxOverlap(nextConfig.yellowMaxOverlap);
      setYellowMaxReversals(nextConfig.yellowMaxReversals);
      setYellowOptimizationSummary(optimization);
      setCampaignView('yellowMomentum');
      setShowCampaignTrades(true);
      fetchBacktest(activeChart, nextConfig);
    } catch (err) {
      console.error('Failed to optimize Yellow Momentum parameters:', err);
      alert('Failed to connect to the Yellow Momentum optimization engine.');
    } finally {
      setOptimizingYellowMomentum(false);
    }
  };
  
  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedAction, setSelectedAction] = useState('');
  const [selectedMarkerSet, setSelectedMarkerSet] = useState('');
  const [commentText, setCommentText] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [isCreatingNewSet, setIsCreatingNewSet] = useState(false);
  const [visibleMarkerSets, setVisibleMarkerSets] = useState({});

  // Draggable Modal state
  const [modalPosition, setModalPosition] = useState({ x: 100, y: 100 });
  const [dragStart, setDragStart] = useState(null);



  const handleMouseDown = (e) => {
    // Only drag on the header, not on input fields, buttons, or textareas
    if (
      e.target.tagName === 'INPUT' || 
      e.target.tagName === 'TEXTAREA' || 
      e.target.tagName === 'BUTTON' || 
      e.target.closest('button')
    ) {
      return;
    }
    setDragStart({
      startX: e.clientX - modalPosition.x,
      startY: e.clientY - modalPosition.y,
    });
  };

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!dragStart) return;
      const newX = e.clientX - dragStart.startX;
      const newY = e.clientY - dragStart.startY;
      
      // Keep modal within viewport boundaries
      const boundedX = Math.max(10, Math.min(window.innerWidth - 490, newX));
      const boundedY = Math.max(10, Math.min(window.innerHeight - 460, newY));
      
      setModalPosition({ x: boundedX, y: boundedY });
    };

    const handleMouseUp = () => {
      setDragStart(null);
    };

    if (dragStart) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [dragStart, modalPosition]);

  // Fetch available charts and annotations on mount
  useEffect(() => {
    fetchCharts();
    fetchAnnotations();
  }, []);

  useEffect(() => {
    if (datasetsDrawerOpen) {
      setDatasetActionStatus('');
      setDatasetActionError('');
    }
  }, [datasetsDrawerOpen]);

  useEffect(() => {
    if (activeChart) {
      localStorage.setItem(ACTIVE_CHART_STORAGE_KEY, activeChart);
    }
  }, [activeChart]);

  useEffect(() => {
    if (isMesRangeCampaignChart(activeChart) && campaignView !== 'mesReg5Recovery') {
      setCampaignView('mesReg5Recovery');
    }
  }, [activeChart, campaignView]);

  useEffect(() => {
    localStorage.setItem(MARKER_SETTINGS_STORAGE_KEY, JSON.stringify({
      showTrainingAnnotations,
      showRawSignals,
      showSignalSet2,
      showSignalSet3,
      showMes3TrendTailSignals,
      showMes3PreviousTailSignals,
      showMes3HaEmaApproachSignals,
      showMesReg5LongTailSignals,
      showMesReg5EmaBounceAritySignals,
      showMesReg5PinBarBreakoutSignals,
      showCampaignTrades,
      showSecondaryPane,
      campaignView,
    }));
  }, [
    showTrainingAnnotations,
    showRawSignals,
    showSignalSet2,
    showSignalSet3,
    showMes3TrendTailSignals,
    showMes3PreviousTailSignals,
    showMes3HaEmaApproachSignals,
    showMesReg5LongTailSignals,
    showMesReg5EmaBounceAritySignals,
    showMesReg5PinBarBreakoutSignals,
    showCampaignTrades,
    showSecondaryPane,
    campaignView,
  ]);

  // Fetch chart data and backtest when active selection changes or when configuration is adjusted
  useEffect(() => {
    if (activeChart) {
      fetchChartData(activeChart);
      if (activeChart === 'MES3' || activeChart === 'MESM_reg_5') {
        fetchSecondaryChartData('MES_2sec_HA');
      } else {
        setSecondaryChartData([]);
        setCurrentHaSelection(null);
      }
      // Keep user's saved showSecondaryPane setting
      fetchBacktest(activeChart);
      const savedBookmark = localStorage.getItem(bookmarkStorageKey(activeChart));
      try {
        setBookmark(savedBookmark ? JSON.parse(savedBookmark) : null);
      } catch {
        setBookmark(null);
      }
    } else {
      setChartData([]);
      setSecondaryChartData([]);
      setCurrentHaSelection(null);
      setBacktestResults(null);
      setBookmark(null);
    }
  }, [
    activeChart,
    slopeThreshold,
    minWick,
    maxEmaDist,
    retestTolerance,
    cooldownBars,
    exitStrategy,
    wickBodyOffset,
    sessionStartTime,
    aridLookback,
    aridMaxOverlap,
    aridMaxReversals,
    aridSlopeThreshold,
    aridMinGap,
    bounceType,
    set3LeftLookback,
    set3MaxLeftOverlaps,
    set3SlopeThreshold,
    set3MinGap,
    set3SyntheticMinGap,
    yellowSlopePeriod,
    yellowFastSlope,
    yellowSlowSlope,
    yellowMinGap,
    yellowMinPenetration,
    yellowMinTail,
    yellowArityLookback,
    yellowMaxOverlap,
    yellowMaxReversals,
  ]);

  const fetchCharts = async () => {
    try {
      const res = await fetch(`${API_BASE}/charts`);
      const data = await res.json();
      setCharts(data);
      if (data.length > 0 && !activeChart) {
        const savedChart = localStorage.getItem(ACTIVE_CHART_STORAGE_KEY);
        setActiveChart(savedChart && data.includes(savedChart) ? savedChart : data[0]);
      }
    } catch (err) {
      console.error('Failed to fetch charts:', err);
    }
  };

  const fetchAnnotations = async () => {
    try {
      const res = await fetch(`${API_BASE}/annotations`);
      const data = await res.json();
      setAllAnnotations(data);
    } catch (err) {
      console.error('Failed to fetch annotations:', err);
    }
  };

  const fetchChartData = async (name) => {
    try {
      const res = await fetch(`${API_BASE}/charts/${name}`);
      const data = await res.json();
      setChartData(data);
    } catch (err) {
      console.error('Failed to fetch chart data:', err);
    }
  };

  const fetchSecondaryChartData = async (name) => {
    try {
      const res = await fetch(`${API_BASE}/charts/${name}`);
      if (!res.ok) {
        setSecondaryChartData([]);
        return;
      }
      const data = await res.json();
      setSecondaryChartData(data);
    } catch (err) {
      console.error('Failed to fetch secondary chart data:', err);
      setSecondaryChartData([]);
    }
  };

  const deriveDatasetName = (fileName) => fileName.replace(/\.[^./\\]+$/, '');

  const handleMultichartsFileChosen = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    const name = deriveDatasetName(file.name);
    setImportingDataset(true);
    setDatasetActionStatus('');
    setDatasetActionError('');

    try {
      const text = await file.text();
      const data = JSON.parse(text);
      const res = await fetch(`${API_BASE}/charts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, data }),
      });
      const result = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(result.details || result.error || `Import failed (${res.status})`);
      }

      await fetchCharts();
      setActiveChart(result.name);
      setDatasetsDrawerOpen(false);
      setDatasetActionStatus(`Imported "${result.name}" (${result.barCount} bars).`);
    } catch (err) {
      console.error('Failed to import dataset:', err);
      setDatasetActionError(
        err instanceof SyntaxError
          ? 'That file is not valid JSON chart data.'
          : (err.message || 'Failed to import dataset.')
      );
    } finally {
      setImportingDataset(false);
    }
  };

  const handleDeleteDataset = async (chartName, event) => {
    event.stopPropagation();
    if (deletingDataset) return;

    const confirmed = window.confirm(
      `Delete "${chartName}"?\n\nThis removes the dataset file from data/ and clears its annotations.`
    );
    if (!confirmed) return;

    setDeletingDataset(chartName);
    setDatasetActionStatus('');
    setDatasetActionError('');

    try {
      const res = await fetch(`${API_BASE}/charts/${encodeURIComponent(chartName)}`, {
        method: 'DELETE',
      });
      const result = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(result.details || result.error || `Delete failed (${res.status})`);
      }

      const remainingCharts = charts.filter(c => c !== chartName);
      setCharts(remainingCharts);

      const updatedAnnotations = { ...allAnnotations };
      delete updatedAnnotations[chartName];
      setAllAnnotations(updatedAnnotations);

      if (activeChart === chartName) {
        const nextChart = remainingCharts[0] || '';
        setActiveChart(nextChart);
        if (!nextChart) {
          setChartData([]);
          setSecondaryChartData([]);
          setBacktestResults(null);
          setBookmark(null);
        }
      }

      setDatasetActionStatus(`Deleted "${chartName}".`);
    } catch (err) {
      console.error('Failed to delete dataset:', err);
      setDatasetActionError(err.message || 'Failed to delete dataset.');
    } finally {
      setDeletingDataset('');
    }
  };

  // Rename a dataset (file move + annotation re-key handled server-side).
  const handleRenameDataset = async (oldName, rawNewName) => {
    const newName = (rawNewName || '').trim();
    if (!newName) {
      setDatasetActionError('Name cannot be empty.');
      return;
    }
    if (newName === oldName) {
      setRenamingChart('');
      return;
    }

    setRenamingSubmitting(true);
    setDatasetActionStatus('');
    setDatasetActionError('');

    try {
      const res = await fetch(`${API_BASE}/charts/${encodeURIComponent(oldName)}/rename`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newName }),
      });
      const result = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(result.details || result.error || `Rename failed (${res.status})`);
      }

      setCharts(prev => prev.map(c => (c === oldName ? newName : c)));

      setAllAnnotations(prev => {
        if (!(oldName in prev)) return prev;
        const reordered = {};
        for (const [key, value] of Object.entries(prev)) {
          reordered[key === oldName ? newName : key] = value;
        }
        return reordered;
      });

      if (activeChart === oldName) {
        setActiveChart(newName);
        try {
          localStorage.setItem(ACTIVE_CHART_STORAGE_KEY, newName);
        } catch {
          /* localStorage may be unavailable; non-fatal */
        }
      }

      setRenamingChart('');
      setDatasetActionStatus(`Renamed "${oldName}" to "${newName}".`);
    } catch (err) {
      console.error('Failed to rename dataset:', err);
      setDatasetActionError(err.message || 'Failed to rename dataset.');
      // keep edit mode open so the user can correct the name
    } finally {
      setRenamingSubmitting(false);
    }
  };

  // Close the dataset context menu on outside interaction (mirrors the chart's
  // context-menu close logic in ChartComponent.jsx).
  useEffect(() => {
    if (!datasetContextMenu) return;
    const closeMenu = () => setDatasetContextMenu(null);
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') closeMenu();
    };
    window.addEventListener('click', closeMenu);
    window.addEventListener('contextmenu', closeMenu);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('click', closeMenu);
      window.removeEventListener('contextmenu', closeMenu);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [datasetContextMenu]);

  const handleHaSelectionChange = async (selection) => {
    setCurrentHaSelection(selection);
    try {
      await fetch(`${API_BASE}/ai-selection`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'heiken_ashi_range',
          chart: activeChart,
          secondaryChart: 'MES_2sec_HA',
          selectedAt: new Date().toISOString(),
          selection,
        }),
      });
    } catch (err) {
      console.error('Failed to publish Heiken Ashi selection:', err);
    }
  };

  // Handle keyboard shortcuts when modal is open
  useEffect(() => {
    if (!modalOpen || !selectedBrick) return;

    const handleKeyDown = (e) => {
      // If user is typing in the textarea, only handle Enter (without Shift) to save
      if (e.target.tagName === 'TEXTAREA' || e.target.tagName === 'INPUT') {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          handleSaveAnnotation();
        }
        return;
      }

      const key = e.key.toLowerCase();
      if (key === 'b' || e.key === '1') {
        setSelectedAction('Buy');
      } else if (key === 's' || e.key === '2') {
        setSelectedAction('Sell');
      } else if (key === 'k' || e.key === '3') {
        setSelectedAction('Skip');
      } else if (e.key === 'Enter') {
        handleSaveAnnotation();
      } else if (e.key === 'Escape') {
        setModalOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [modalOpen, selectedAction, selectedMarkerSet, commentText, selectedBrick, activeChart]);

  const handleBrickClick = (brick, clickPoint) => {
    // Match the exact brick; imported Renko data can contain duplicate timestamps.
    const activeAnnotations = allAnnotations[activeChart] || [];
    const targetTime = brick.originalTime || brick.time;
    const existing = activeAnnotations.find(annotation => annotationMatchesBrick(annotation, brick));
    const barIndex = brick.originalIndex;
    const exactSystemSignal = backtestResults?.signal_details?.find(
      signal => signal.barIndex === barIndex
    );
    const systemSignal = exactSystemSignal?.action || null;

    if (Number.isInteger(barIndex)) {
      const contextStart = Math.max(0, barIndex - 12);
      const contextEnd = Math.min(chartData.length, barIndex + 13);
      const context = chartData.slice(contextStart, contextEnd).map((bar, offset) => ({
        barIndex: contextStart + offset,
        relativePosition: contextStart + offset - barIndex,
        ...bar,
      }));
      const previousBar = chartData[barIndex - 1];
      const emaThreeBarsAgo = chartData[barIndex - 3]?.ema;
      const isUpBrick = brick.close > brick.open;
      const wickLength = isUpBrick ? brick.open - brick.low : brick.high - brick.open;

      setDiscussionStatus('Publishing selected setup...');
      fetch(`${API_BASE}/ai-selection`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chart: activeChart,
          selectedAt: new Date().toISOString(),
          selectedBar: {
            barIndex,
            timestamp: targetTime,
            direction: isUpBrick ? 'Up' : 'Down',
            systemSignal,
            annotation: existing || null,
            values: {
              open: brick.open,
              high: brick.high,
              low: brick.low,
              close: brick.close,
              ema: brick.ema,
            },
            measurements: {
              bodySize: Math.abs(brick.close - brick.open),
              wickLength,
              closeToEma: Number.isFinite(brick.ema) ? brick.close - brick.ema : null,
              emaSlopeThreeBars: Number.isFinite(emaThreeBarsAgo)
                ? brick.ema - emaThreeBarsAgo
                : null,
              previousOpen: previousBar?.open ?? null,
              wickReachesPreviousOpen: previousBar
                ? (isUpBrick ? brick.low <= previousBar.open : brick.high >= previousBar.open)
                : null,
            },
          },
          context,
        }),
      })
        .then(response => {
          if (!response.ok) throw new Error(`Selection server returned ${response.status}`);
          setDiscussionStatus('Ready. Tell Codex: analyze my selected setup.');
        })
        .catch(error => {
          console.error('Failed to publish selected setup:', error);
          setDiscussionStatus('Could not publish selection. Check the API server.');
        });
    }
    
    setSelectedBrick(brick);
    setIsCreatingNewSet(false);
    if (existing) {
      setSelectedAction(existing.action);
      setSelectedMarkerSet(existing.markerSet || defaultMarkerSetForChart(activeChart));
      setCommentText(existing.comment || '');
      setIsEditing(true);
    } else {
      setSelectedMarkerSet(defaultMarkerSetForChart(activeChart));
      // Check if there is a system signal for this brick
      const sysSignal = backtestResults?.signal_details?.find(
        signal => signal.barIndex === brick.originalIndex
      )?.action;
      if (sysSignal) {
        setSelectedAction(sysSignal);
        setCommentText('Approving system signal');
      } else {
        // Auto-prepopulate: Buy for Up bars (close > open), Sell for Down-bars (close < open)
        const defaultAction = brick.close > brick.open ? 'Buy' : 'Sell';
        setSelectedAction(defaultAction);
        setCommentText('');
      }
      setIsEditing(false);
    }

    if (clickPoint) {
      const modalWidth = 320;
      const modalHeight = 330;

      // Determine if click point is in the right half of the viewport
      const isRightHalf = clickPoint.x > window.innerWidth / 2;

      // Place the modal either to the left or right of the bar (with 35px gap)
      let x = isRightHalf ? (clickPoint.x - modalWidth - 35) : (clickPoint.x + 35);
      x = Math.max(10, Math.min(window.innerWidth - modalWidth - 10, x));

      // Center vertically around the clicked point
      let y = clickPoint.y - (modalHeight / 2);
      y = Math.max(10, Math.min(window.innerHeight - modalHeight - 10, y));

      setModalPosition({ x, y });
    } else {
      // Fallback: center in screen
      const width = 320;
      const height = 330;
      const x = Math.max(20, (window.innerWidth - width) / 2);
      const y = Math.max(20, (window.innerHeight - height) / 2);
      setModalPosition({ x, y });
    }

    setModalOpen(true);
  };

  const handleSaveAnnotation = async () => {
    if (!selectedAction) {
      alert('Please select an action (Buy, Sell, or Skip)');
      return;
    }

    const activeAnnotations = [...(allAnnotations[activeChart] || [])];
    const targetTime = selectedBrick.originalTime || selectedBrick.time;

    const newAnnotation = {
      timestamp: targetTime,
      barIndex: selectedBrick.originalIndex,
      action: selectedAction,
      markerSet: selectedMarkerSet || defaultMarkerSetForChart(activeChart),
      comment: commentText,
      metrics: {
        open: selectedBrick.open,
        high: selectedBrick.high,
        low: selectedBrick.low,
        close: selectedBrick.close,
        ema: selectedBrick.ema,
        ema5: selectedBrick.ema5,
        ema10: selectedBrick.ema10,
      },
    };

    const index = activeAnnotations.findIndex(annotation => annotationMatchesBrick(annotation, selectedBrick));
    if (index !== -1) {
      activeAnnotations[index] = newAnnotation;
    } else {
      activeAnnotations.push(newAnnotation);
    }

    activeAnnotations.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

    const updated = { ...allAnnotations, [activeChart]: activeAnnotations };
    setAllAnnotations(updated);
    setShowTrainingAnnotations(true);
    setModalOpen(false);

    try {
      const response = await fetch(`${API_BASE}/annotations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileKey: activeChart, annotations: activeAnnotations }),
      });
      if (!response.ok) {
        const details = await response.json().catch(() => ({}));
        throw new Error(details.error || `Annotation server returned ${response.status}`);
      }
    } catch (err) {
      console.error('Failed to save annotation:', err);
      setAllAnnotations(allAnnotations);
      alert('Failed to save annotation. Make sure the API server is running on port 5000.');
    }
  };

  const handleAddTailArrowAnnotation = async (brick, direction) => {
    if (!brick || !activeChart || (direction !== 'up' && direction !== 'down')) return;

    const activeAnnotations = [...(allAnnotations[activeChart] || [])];
    const newAnnotation = {
      timestamp: brick.originalTime || brick.time,
      barIndex: brick.originalIndex,
      markerSet: TAIL_ARROWS_MARKER_SET,
      tailArrow: direction,
      metrics: {
        open: brick.open,
        high: brick.high,
        low: brick.low,
        close: brick.close,
        ema: brick.ema,
        ema5: brick.ema5,
        ema10: brick.ema10,
      },
    };

    const existingIndex = activeAnnotations.findIndex(
      annotation =>
        annotation.markerSet === TAIL_ARROWS_MARKER_SET &&
        annotation.tailArrow === direction &&
        annotationMatchesBrick(annotation, brick)
    );

    if (existingIndex !== -1) {
      activeAnnotations[existingIndex] = newAnnotation;
    } else {
      activeAnnotations.push(newAnnotation);
    }

    activeAnnotations.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

    const previousAnnotations = allAnnotations;
    const updated = { ...allAnnotations, [activeChart]: activeAnnotations };
    setAllAnnotations(updated);

    try {
      const response = await fetch(`${API_BASE}/annotations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileKey: activeChart, annotations: activeAnnotations }),
      });
      if (!response.ok) {
        const details = await response.json().catch(() => ({}));
        throw new Error(details.error || `Annotation server returned ${response.status}`);
      }
    } catch (err) {
      console.error('Failed to save tail arrow annotation:', err);
      setAllAnnotations(previousAnnotations);
      alert('Failed to save tail arrow. Make sure the API server is running on port 5000.');
    }
  };

  const handleClearTailArrowAnnotations = async () => {
    if (!activeChart) return;

    const activeAnnotations = (allAnnotations[activeChart] || []).filter(
      annotation => annotation.markerSet !== TAIL_ARROWS_MARKER_SET
    );
    const removedCount = (allAnnotations[activeChart] || []).length - activeAnnotations.length;
    if (removedCount === 0) return;

    const previousAnnotations = allAnnotations;
    const updated = { ...allAnnotations, [activeChart]: activeAnnotations };
    setAllAnnotations(updated);

    try {
      const response = await fetch(`${API_BASE}/annotations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileKey: activeChart, annotations: activeAnnotations }),
      });
      if (!response.ok) {
        const details = await response.json().catch(() => ({}));
        throw new Error(details.error || `Annotation server returned ${response.status}`);
      }
    } catch (err) {
      console.error('Failed to clear tail arrow annotations:', err);
      setAllAnnotations(previousAnnotations);
      alert('Failed to clear tail arrows. Make sure the API server is running on port 5000.');
    }
  };

  const handleDeleteAnnotation = async () => {
    if (!selectedBrick) return;

    const activeAnnotations = (allAnnotations[activeChart] || []).filter(
      annotation => !annotationMatchesBrick(annotation, selectedBrick)
    );

    const updated = { ...allAnnotations, [activeChart]: activeAnnotations };
    setAllAnnotations(updated);
    setModalOpen(false);

    try {
      const response = await fetch(`${API_BASE}/annotations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileKey: activeChart, annotations: activeAnnotations }),
      });
      if (!response.ok) {
        const details = await response.json().catch(() => ({}));
        throw new Error(details.error || `Annotation server returned ${response.status}`);
      }
    } catch (err) {
      console.error('Failed to delete annotation:', err);
      setAllAnnotations(allAnnotations);
      alert('Failed to delete annotation. Make sure the API server is running on port 5000.');
    }
  };

  const handleBookmarkBrick = (brick) => {
    if (!brick || !Number.isInteger(brick.originalIndex) || !activeChart) return;

    const nextBookmark = {
      barIndex: brick.originalIndex,
      timestamp: brick.originalTime || brick.time,
    };
    localStorage.setItem(bookmarkStorageKey(activeChart), JSON.stringify(nextBookmark));
    setBookmark(nextBookmark);
  };

  const handleSetBookmark = () => {
    handleBookmarkBrick(selectedBrick);
  };

  const handleClearBookmark = () => {
    if (!activeChart) return;
    localStorage.removeItem(bookmarkStorageKey(activeChart));
    setBookmark(null);
  };

  const savedAnnotations = allAnnotations[activeChart] || [];

  // Get all unique marker sets available in the saved annotations
  const availableMarkerSets = React.useMemo(() => {
    const sets = new Set([RAW_RANGE_MARKER_SET, 'Training Set']);
    savedAnnotations.forEach(ann => {
      if (ann.markerSet && !isTailArrowAnnotation(ann)) {
        sets.add(ann.markerSet);
      }
    });
    return [...sets].sort();
  }, [savedAnnotations]);

  const tailArrowAnnotations = React.useMemo(
    () => savedAnnotations.filter(isTailArrowAnnotation),
    [savedAnnotations]
  );

  const trainingAnnotationCount = React.useMemo(
    () => savedAnnotations.filter(ann => !isTailArrowAnnotation(ann)).length,
    [savedAnnotations]
  );

  // Construct annotations to pass to ChartComponent, including a temporary preview if the modal is open
  const currentAnnotations = React.useMemo(() => {
    if (!modalOpen || !selectedBrick) {
      return savedAnnotations;
    }

    const previewAnn = {
      timestamp: selectedBrick.originalTime || selectedBrick.time,
      barIndex: selectedBrick.originalIndex,
      action: selectedAction,
      markerSet: selectedMarkerSet || defaultMarkerSetForChart(activeChart),
      comment: commentText,
      metrics: {
        open: selectedBrick.open,
        high: selectedBrick.high,
        low: selectedBrick.low,
        close: selectedBrick.close,
        ema: selectedBrick.ema,
        ema5: selectedBrick.ema5,
        ema10: selectedBrick.ema10,
      },
      isPreview: true,
    };

    const exists = savedAnnotations.some(annotation => annotationMatchesBrick(annotation, selectedBrick));

    if (exists) {
      return savedAnnotations.map(annotation =>
        annotationMatchesBrick(annotation, selectedBrick) ? previewAnn : annotation
      );
    } else {
      return [...savedAnnotations, previewAnn];
    }
  }, [savedAnnotations, modalOpen, selectedBrick, selectedAction, selectedMarkerSet, commentText, activeChart]);

  const filteredTrainingAnnotations = React.useMemo(() => {
    return currentAnnotations.filter(ann => {
      if (isTailArrowAnnotation(ann)) return false;
      if (ann.isPreview) return true;
      const set = ann.markerSet || defaultMarkerSetForChart(activeChart);
      return visibleMarkerSets[set] !== false;
    });
  }, [currentAnnotations, visibleMarkerSets, activeChart]);

  const filteredManualAnnotations = React.useMemo(
    () => [...filteredTrainingAnnotations, ...tailArrowAnnotations],
    [filteredTrainingAnnotations, tailArrowAnnotations]
  );

  // Merge user annotations, system signals, and campaign trades for chart display
  const mergedAnnotations = React.useMemo(() => {
    const shouldShowTrainingAnnotations = showTrainingAnnotations || modalOpen;
    const merged = [
      ...tailArrowAnnotations,
      ...(shouldShowTrainingAnnotations ? filteredTrainingAnnotations : filteredTrainingAnnotations.filter(annotation => annotation.isPreview)),
    ];
    
    // 1. Add every raw strategy signal, including signals skipped by the campaign.
    if (showRawSignals && backtestResults?.signal_details) {
      backtestResults.signal_details.forEach(({ barIndex, timestamp, action }) => {
        const evaluation = backtestResults.signal_evaluations?.find(
          ev => ev.barIndex === barIndex && ev.direction === action
        );
        merged.push({
          timestamp,
          barIndex,
          action,
          isSystem: true,
          signalSet: 1,
          comment: 'System generated entry',
          evaluationResult: evaluation ? evaluation.result : 'Pending',
        });
      });
    }

    if (showSignalSet2 && backtestResults?.signal_set_2_details) {
      backtestResults.signal_set_2_details.forEach(({ barIndex, timestamp, action, metrics }) => {
        const evaluation = backtestResults.signal_set_2_evaluations?.find(
          ev => ev.barIndex === barIndex && ev.direction === action
        );
        merged.push({
          timestamp,
          barIndex,
          action,
          isSystem: true,
          signalSet: 2,
          metrics,
          comment: 'EMA bounce signal',
          evaluationResult: evaluation ? evaluation.result : 'Pending',
        });
      });
    }

    if (showSignalSet3 && backtestResults?.signal_set_3_details) {
      backtestResults.signal_set_3_details.forEach(({ barIndex, markerBarIndex, timestamp, markerTimestamp, action, setupType, virtualBrick, metrics }) => {
        const evaluation = backtestResults.signal_set_3_evaluations?.find(
          ev => ev.barIndex === barIndex && ev.direction === action
        );
        const aridETrade = backtestResults.arid_e_trades?.find(
          trade =>
            trade.markerBarIndex === markerBarIndex &&
            trade.direction === action &&
            trade.setupType === setupType
        );
        if (!aridETrade) return;
        merged.push({
          timestamp: markerTimestamp || timestamp,
          barIndex: Number.isInteger(markerBarIndex) ? markerBarIndex : barIndex,
          entryBarIndex: barIndex,
          action,
          isSystem: true,
          signalSet: 3,
          setupType,
          virtualBrick,
          metrics,
          comment: setupType === 'synthetic'
            ? 'No-tail synthetic arity entry'
            : 'No-tail arity trend resumption',
          evaluationResult: evaluation ? evaluation.result : 'Open',
          profitBricks: evaluation?.profit_bricks,
          aridETrade,
        });
      });
    }

    if (showMes3TrendTailSignals && (activeChart === 'MES3' || activeChart === 'MESM_reg_5') && backtestResults?.mes3_trend_tail_details) {
      backtestResults.mes3_trend_tail_details.forEach(({ barIndex, timestamp, action, metrics }) => {
        const evaluation = backtestResults.mes3_trend_tail_evaluations?.find(
          ev => ev.barIndex === barIndex && ev.direction === action
        );
        merged.push({
          timestamp,
          barIndex,
          action,
          isSystem: true,
          signalSet: 4,
          setupType: 'mes3TrendTail',
          metrics,
          comment: 'MES3 8 EMA trend-tail signal',
          evaluationResult: evaluation ? evaluation.result : 'Pending',
        });
      });
    }

    if (showMes3PreviousTailSignals && (activeChart === 'MES3' || activeChart === 'MESM_reg_5') && backtestResults?.mes3_previous_tail_details) {
      backtestResults.mes3_previous_tail_details.forEach(({ barIndex, timestamp, action, metrics }) => {
        const evaluation = backtestResults.mes3_previous_tail_evaluations?.find(
          ev => ev.barIndex === barIndex && ev.direction === action
        );
        merged.push({
          timestamp,
          barIndex,
          action,
          isSystem: true,
          signalSet: 5,
          setupType: 'mes3PreviousTailRejection',
          metrics,
          comment: 'MES3 previous-bar tail rejection',
          evaluationResult: evaluation ? evaluation.result : 'Pending',
        });
      });
    }

    if (showMes3HaEmaApproachSignals && (activeChart === 'MES3' || activeChart === 'MESM_reg_5') && backtestResults?.mes3_ha_ema_approach_details) {
      backtestResults.mes3_ha_ema_approach_details.forEach(({ barIndex, timestamp, action, metrics }) => {
        merged.push({
          timestamp,
          barIndex,
          action,
          isSystem: true,
          signalSet: 6,
          setupType: 'mes3HaEmaApproachIndecisionBreakout',
          metrics,
          comment: 'MES3 HA indecision breakout near Renko EMA',
          evaluationResult: 'Study',
        });
      });
    }

    if (showMesReg5LongTailSignals && isMesRangeCampaignChart(activeChart) && backtestResults?.mes_reg5_long_tail_details) {
      backtestResults.mes_reg5_long_tail_details.forEach(({ barIndex, timestamp, action, metrics }) => {
        merged.push({
          timestamp,
          barIndex,
          action,
          isSystem: true,
          signalSet: 7,
          setupType: 'mesReg5LongTail',
          metrics,
          comment: 'MES Reg5 Long Tail in strong trend',
          evaluationResult: 'Study',
        });
      });
    }

    if (showMesReg5EmaBounceAritySignals && isMesRangeCampaignChart(activeChart) && backtestResults?.mes_reg5_ema_bounce_arity_details) {
      backtestResults.mes_reg5_ema_bounce_arity_details.forEach(({ barIndex, timestamp, action, metrics }) => {
        merged.push({
          timestamp,
          barIndex,
          action,
          isSystem: true,
          signalSet: 8,
          setupType: 'mesReg5EmaBounceArity',
          metrics,
          comment: 'MES Reg5 EMA Bounce with Arity',
          evaluationResult: 'Study',
        });
      });
    }

    if (showMesReg5PinBarBreakoutSignals && isMesRangeCampaignChart(activeChart) && backtestResults?.mes_reg5_pin_bar_breakout_details) {
      backtestResults.mes_reg5_pin_bar_breakout_details.forEach(({ barIndex, timestamp, action, metrics }) => {
        const evaluation = backtestResults.mes_reg5_pin_bar_breakout_evaluations?.find(
          ev => ev.barIndex === barIndex && ev.direction === action
        );
        merged.push({
          timestamp,
          barIndex,
          action,
          isSystem: true,
          signalSet: 9,
          setupType: 'mesReg5PinBarBreakout',
          metrics,
          comment: 'MES Reg5 Pin Bar Breakout',
          evaluationResult: evaluation ? evaluation.result : 'Study',
        });
      });
    }
    
    // 2. Add selected campaign trade markers (entries & exits) for the latest traded day.
    if (showCampaignTrades) {
      const selectedCampaign = CAMPAIGN_OPTIONS[campaignView] || CAMPAIGN_OPTIONS.yellowMomentum;
      const reports = backtestResults?.[selectedCampaign.resultKey]?.daily_reports;
      reports?.forEach(day => {
        day.trades?.forEach((trade, idx) => {
          merged.push({
            timestamp: trade.entry_time,
            barIndex: trade.entry_barIndex,
            action: trade.direction,
            [selectedCampaign.entryFlag]: true,
            tradeIndex: idx + 1,
            comment: `${selectedCampaign.label} entry #${idx + 1}`,
          });

          merged.push({
            timestamp: trade.exit_time,
            barIndex: trade.exit_barIndex,
            action: trade.direction,
            direction: trade.direction,
            [selectedCampaign.exitFlag]: true,
            isCampaignComplete: trade.is_campaign_complete,
            exitResult: trade.result,
            profitBricks: trade.profit_bricks,
            dailyProfitBricks: trade.daily_profit_bricks,
            tradeIndex: idx + 1,
            comment: `${selectedCampaign.label} exit #${idx + 1} (${trade.result})`,
          });
        });
        day.skipped_trades?.forEach((skipped, idx) => {
          if (skipped.reason !== 'FastMarket') return;
          merged.push({
            timestamp: skipped.time,
            barIndex: skipped.barIndex,
            action: skipped.direction,
            isMesReg5RecoveryCampaignSkip: selectedCampaign.resultKey === 'mes_reg5_daily_recovery_campaign_results',
            skipReason: skipped.reason,
            secondsSincePreviousBar: skipped.seconds_since_previous_bar,
            tradeIndex: idx + 1,
            comment: `${selectedCampaign.label} skipped fast-market signal #${idx + 1}`,
          });
        });
        day.paper_trades?.forEach((trade, idx) => {
          if (selectedCampaign.resultKey !== 'mes_reg5_daily_recovery_campaign_results') return;
          merged.push({
            timestamp: trade.entry_time,
            barIndex: trade.entry_barIndex,
            action: trade.direction,
            isMesReg5RecoveryPaperEntry: true,
            tradeIndex: idx + 1,
            comment: `${selectedCampaign.label} paper entry #${idx + 1}`,
          });

          merged.push({
            timestamp: trade.exit_time,
            barIndex: trade.exit_barIndex,
            action: trade.direction,
            direction: trade.direction,
            isMesReg5RecoveryPaperExit: true,
            exitResult: trade.result,
            profitBricks: trade.profit_bricks,
            tradeIndex: idx + 1,
            comment: `${selectedCampaign.label} paper exit #${idx + 1} (${trade.result})`,
          });
        });
      });
    }
    
    return merged;
  }, [filteredTrainingAnnotations, tailArrowAnnotations, backtestResults, showTrainingAnnotations, showRawSignals, showSignalSet2, showSignalSet3, showMes3TrendTailSignals, showMes3PreviousTailSignals, showMes3HaEmaApproachSignals, showMesReg5LongTailSignals, showMesReg5EmaBounceAritySignals, showMesReg5PinBarBreakoutSignals, showCampaignTrades, campaignView, activeChart, modalOpen]);

  // Compute performance and alignment stats
  const stats = React.useMemo(() => {
    if (!backtestResults || !backtestResults.signal_evaluations) return null;
    
    const evaluations = backtestResults.signal_evaluations;
    const passed = evaluations.filter(item => item.result === 'Pass').length;
    const failed = evaluations.filter(item => item.result === 'Fail').length;
    const pending = evaluations.filter(item => item.result === 'Pending').length;
    const resolved = passed + failed;
    const passRate = resolved > 0 ? (passed / resolved * 100).toFixed(1) : '0.0';
    
    const alignment = backtestResults.alignment || {};
    const matches = alignment.matches_count || 0;
    const missed = alignment.false_negatives_count || 0;
    const overTriggers = alignment.false_positives_count || 0;
    const totalLabeled = matches + missed;
    const alignmentRate = totalLabeled > 0 ? (matches / totalLabeled * 100).toFixed(1) : '0.0';
    
    const campaign = backtestResults.campaign_results || {};
    const campaignSummary = campaign.summary || {};
    const selectedCampaign = CAMPAIGN_OPTIONS[campaignView] || CAMPAIGN_OPTIONS.yellowMomentum;
    const selectedCampaignResults = backtestResults[selectedCampaign.resultKey] || {};
    const selectedCampaignSummary = selectedCampaignResults.summary || {};
    const selectedCampaignRules = selectedCampaignResults.rules || {};

    return {
      totalSignals: evaluations.length,
      passed,
      failed,
      pending,
      passRate,
      matches,
      missed,
      overTriggers,
      alignmentRate,
      totalLabeled,
      campaignTotalDays: campaignSummary.total_days || 0,
      campaignWinningDays: campaignSummary.winning_days || 0,
      campaignLosingDays: campaignSummary.losing_days || 0,
      campaignWinRate: campaignSummary.win_rate !== undefined ? campaignSummary.win_rate.toFixed(1) : '0.0',
      campaignAvgTime: campaignSummary.avg_success_time || 'N/A',
      campaignMaxDrawdown: campaignSummary.max_drawdown_bricks !== undefined ? campaignSummary.max_drawdown_bricks.toFixed(1) : '0.0',
      selectedCampaignName: selectedCampaignResults.name || selectedCampaign.label,
      selectedCampaignTrades: selectedCampaignSummary.total_trades || 0,
      selectedCampaignWinningTrades: selectedCampaignSummary.winning_trades || 0,
      selectedCampaignLosingTrades: selectedCampaignSummary.losing_trades || 0,
      selectedCampaignTradeWinRate: selectedCampaignSummary.trade_win_rate !== undefined ? selectedCampaignSummary.trade_win_rate.toFixed(1) : '0.0',
      selectedCampaignNet: selectedCampaignSummary.net_profit_bricks !== undefined ? selectedCampaignSummary.net_profit_bricks.toFixed(1) : '0.0',
      selectedCampaignMaxDrawdown: selectedCampaignSummary.max_drawdown_bricks !== undefined ? selectedCampaignSummary.max_drawdown_bricks.toFixed(1) : '0.0',
      selectedCampaignExit: selectedCampaignRules.exit || selectedCampaignRules.target || 'N/A',
    };
  }, [backtestResults, campaignView]);

  return (
    <div className="app-container">
      <button
        type="button"
        className="datasets-drawer-button"
        onClick={() => setDatasetsDrawerOpen(true)}
      >
        Datasets
      </button>

      {datasetsDrawerOpen && (
        <div className="datasets-drawer-backdrop" onClick={() => setDatasetsDrawerOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={`app-sidebar ${datasetsDrawerOpen ? 'open' : ''}`}>
        <div>
          <div className="drawer-panel-header">
            <h3 className="section-title" style={{ margin: 0 }}>Datasets</h3>
            <button
              type="button"
              className="drawer-close-button"
              onClick={() => setDatasetsDrawerOpen(false)}
            >
              Close
            </button>
          </div>
          {charts.length === 0 ? (
            <div style={{ fontSize: '13px', color: 'var(--text-muted)', textAlign: 'center', padding: '12px' }}>
              No datasets yet.<br/>Import an export below to get started.
            </div>
          ) : (
            <div className="file-list">
              {charts.map(c => {
                const isRenaming = renamingChart === c;
                return (
                  <div
                    key={c}
                    className={`file-item ${activeChart === c ? 'active' : ''}`}
                    onContextMenu={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      setDatasetContextMenu({ x: event.clientX, y: event.clientY, chartName: c });
                    }}
                    onClick={() => {
                      if (isRenaming) return; // don't select/switch while editing the name
                      setActiveChart(c);
                      setDatasetsDrawerOpen(false);
                    }}
                  >
                    <div className="file-item-row">
                      <div className="file-item-content">
                        {isRenaming ? (
                          <input
                            type="text"
                            className="file-name-input"
                            value={renameValue}
                            autoFocus
                            disabled={renamingSubmitting}
                            onClick={(event) => event.stopPropagation()}
                            onChange={(event) => setRenameValue(event.target.value)}
                            onKeyDown={(event) => {
                              if (event.key === 'Enter') {
                                event.preventDefault();
                                handleRenameDataset(c, renameValue);
                              } else if (event.key === 'Escape') {
                                event.preventDefault();
                                setRenamingChart('');
                                setRenameValue('');
                              }
                            }}
                            onBlur={() => {
                              if (!renamingSubmitting) {
                                setRenamingChart('');
                                setRenameValue('');
                              }
                            }}
                          />
                        ) : (
                          <>
                            <span className="file-name">{c}</span>
                            <span className="file-meta">
                              {(allAnnotations[c] || []).length} annotations
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="dataset-import-panel">
          <input
            ref={importFileInputRef}
            type="file"
            className="dataset-file-input"
            onChange={handleMultichartsFileChosen}
          />
          <button
            type="button"
            className="btn btn-primary dataset-import-button"
            disabled={importingDataset}
            onClick={() => importFileInputRef.current?.click()}
          >
            {importingDataset ? 'Importing...' : 'Choose MultiCharts Export'}
          </button>
          <p className="dataset-help-text">
            Opens a file chooser. Go to <code>C:\MultiChartsExports</code> and pick any export file.
          </p>

          {datasetActionStatus && (
            <p className="dataset-status dataset-status-success">{datasetActionStatus}</p>
          )}
          {datasetActionError && (
            <p className="dataset-status dataset-status-error">{datasetActionError}</p>
          )}
        </div>

        {/* Strategy & Alignment Card - only when chart loaded */}
        {chartData.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {/* Strategy Configuration Card */}
            <div style={{ background: 'var(--bg-card)', padding: '14px', borderRadius: '12px', border: '1px solid var(--border-color)', fontSize: '12px' }}>
              <h4 style={{ color: 'var(--primary)', marginBottom: '10px', fontSize: '13px', fontWeight: '600', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><span>⚙️</span> Strategy Config</span>
                <button 
                  onClick={handleOptimize} 
                  disabled={optimizing}
                  style={{
                    background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '6px',
                    padding: '4px 8px',
                    fontSize: '10px',
                    fontWeight: '600',
                    cursor: 'pointer',
                    boxShadow: '0 2px 4px rgba(59, 130, 246, 0.2)',
                    transition: 'all 0.2s',
                    opacity: optimizing ? 0.7 : 1
                  }}
                  onMouseOver={(e) => e.currentTarget.style.filter = 'brightness(1.1)'}
                  onMouseOut={(e) => e.currentTarget.style.filter = 'brightness(1.0)'}
                >
                  {optimizing ? 'Optimizing...' : 'Auto-Optimize ⚡'}
                </button>
              </h4>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {/* Min Wick Length */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Min Wick Length:</span>
                    <span style={{ fontWeight: '600', color: 'var(--primary)' }}>{minWick.toFixed(1)} pt</span>
                  </div>
                  <input 
                    type="range" 
                    min="0" 
                    max="40" 
                    step="0.5" 
                    value={minWick} 
                    onChange={(e) => setMinWick(parseFloat(e.target.value))}
                    style={{ width: '100%', accentColor: 'var(--primary)', height: '4px', borderRadius: '2px', outline: 'none' }}
                  />
                </div>

                {/* Max EMA Distance */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Max EMA Distance:</span>
                    <span style={{ fontWeight: '600', color: 'var(--primary)' }}>{maxEmaDist.toFixed(1)} pt</span>
                  </div>
                  <input 
                    type="range" 
                    min="5" 
                    max="100" 
                    step="1" 
                    value={maxEmaDist} 
                    onChange={(e) => setMaxEmaDist(parseFloat(e.target.value))}
                    style={{ width: '100%', accentColor: 'var(--primary)', height: '4px', borderRadius: '2px', outline: 'none' }}
                  />
                </div>

                {/* EMA Slope Threshold */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>EMA Slope Threshold:</span>
                    <span style={{ fontWeight: '600', color: 'var(--primary)' }}>{slopeThreshold.toFixed(1)} pt</span>
                  </div>
                  <input 
                    type="range" 
                    min="0.5" 
                    max="50" 
                    step="0.5" 
                    value={slopeThreshold} 
                    onChange={(e) => setSlopeThreshold(parseFloat(e.target.value))}
                    style={{ width: '100%', accentColor: 'var(--primary)', height: '4px', borderRadius: '2px', outline: 'none' }}
                  />
                </div>

                {/* Wick Retest Tolerance */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Retest Tolerance:</span>
                    <span style={{ fontWeight: '600', color: 'var(--primary)' }}>{retestTolerance.toFixed(1)} pt</span>
                  </div>
                  <input 
                    type="range" 
                    min="0.5" 
                    max="30" 
                    step="0.5" 
                    value={retestTolerance} 
                    onChange={(e) => setRetestTolerance(parseFloat(e.target.value))}
                    style={{ width: '100%', accentColor: 'var(--primary)', height: '4px', borderRadius: '2px', outline: 'none' }}
                  />
                </div>

                {/* 50 EMA slider removed */}

                {/* Time Cool-Down (bars) */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Time Cool-Down:</span>
                    <span style={{ fontWeight: '600', color: 'var(--primary)' }}>{cooldownBars} bars</span>
                  </div>
                  <input 
                    type="range" 
                    min="0" 
                    max="20" 
                    step="1" 
                    value={cooldownBars} 
                    onChange={(e) => setCooldownBars(parseInt(e.target.value, 10))}
                    style={{ width: '100%', accentColor: 'var(--primary)', height: '4px', borderRadius: '2px', outline: 'none' }}
                  />
                </div>

                {/* Wick Body Offset (ticks) */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Wick Body Offset:</span>
                    <span style={{ fontWeight: '600', color: 'var(--primary)' }}>{wickBodyOffset} ticks</span>
                  </div>
                  <input
                    type="range"
                    min="-30"
                    max="10"
                    step="1"
                    value={wickBodyOffset}
                    onChange={(e) => setWickBodyOffset(parseInt(e.target.value, 10))}
                    style={{ width: '100%', accentColor: 'var(--primary)', height: '4px', borderRadius: '2px', outline: 'none' }}
                  />
                </div>

                {/* Session Start Time */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Earliest Entry:</span>
                    <span style={{ fontWeight: '600', color: 'var(--primary)' }}>{sessionStartTime}</span>
                  </div>
                  <input
                    type="time"
                    step="1"
                    value={sessionStartTime}
                    onChange={(e) => setSessionStartTime(e.target.value.length === 5 ? `${e.target.value}:00` : e.target.value)}
                    style={{ width: '100%', colorScheme: 'dark' }}
                  />
                </div>

                <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '10px' }}>
                  <div style={{ color: 'var(--primary)', fontWeight: '600', marginBottom: '8px' }}>
                    Signal Set 2: EMA Bounce
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <label>
                      <span style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)' }}>
                        <span>Bounce Type</span><strong>{bounceType}</strong>
                      </span>
                      <select
                        value={bounceType}
                        onChange={(e) => setBounceType(e.target.value)}
                        style={{
                          width: '100%',
                          height: '32px',
                          marginTop: '4px',
                          background: 'var(--bg-main)',
                          color: 'var(--text-main)',
                          border: '1px solid var(--border-color)',
                          borderRadius: '6px',
                          padding: '0 8px',
                        }}
                      >
                        <option value="green">Green bounces</option>
                        <option value="yellow">Yellow bounces</option>
                        <option value="all">All bounces</option>
                      </select>
                    </label>
                    <label>
                      <span style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)' }}>
                        <span>Lookback</span><strong>{aridLookback} bars</strong>
                      </span>
                      <input type="range" min="4" max="16" step="1" value={aridLookback} onChange={(e) => setAridLookback(parseInt(e.target.value, 10))} style={{ width: '100%', accentColor: '#0891b2' }} />
                    </label>
                    <label>
                      <span style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)' }}>
                        <span>Maximum Clumping</span><strong>{aridMaxOverlap.toFixed(2)} overlaps</strong>
                      </span>
                      <input type="range" min="0" max="1.5" step="0.05" value={aridMaxOverlap} onChange={(e) => setAridMaxOverlap(parseFloat(e.target.value))} style={{ width: '100%', accentColor: '#0891b2' }} />
                    </label>
                    <label>
                      <span style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)' }}>
                        <span>Maximum Reversals</span><strong>{aridMaxReversals}</strong>
                      </span>
                      <input type="range" min="0" max="5" step="1" value={aridMaxReversals} onChange={(e) => setAridMaxReversals(parseInt(e.target.value, 10))} style={{ width: '100%', accentColor: '#0891b2' }} />
                    </label>
                    <label>
                      <span style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)' }}>
                        <span>EMA Trend Strength</span><strong>{aridSlopeThreshold.toFixed(1)} pt</strong>
                      </span>
                      <input type="range" min="1" max="20" step="0.5" value={aridSlopeThreshold} onChange={(e) => setAridSlopeThreshold(parseFloat(e.target.value))} style={{ width: '100%', accentColor: '#0891b2' }} />
                    </label>
                    <label>
                      <span style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)' }}>
                        <span>Score Padding</span><strong>{aridMinGap.toFixed(2)}</strong>
                      </span>
                      <input type="range" min="0" max="3" step="0.25" value={aridMinGap} onChange={(e) => setAridMinGap(parseFloat(e.target.value))} style={{ width: '100%', accentColor: '#0891b2' }} />
                    </label>
                  </div>
                </div>

                <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '10px' }}>
                  <div style={{ color: '#eab308', fontWeight: '600', marginBottom: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
                    <span>Yellow Momentum 1:1</span>
                    <button
                      type="button"
                      onClick={handleOptimizeYellowMomentum}
                      disabled={optimizingYellowMomentum}
                      style={{
                        background: '#eab308',
                        color: '#111827',
                        border: 'none',
                        borderRadius: '6px',
                        padding: '4px 8px',
                        fontSize: '11px',
                        fontWeight: '700',
                        cursor: optimizingYellowMomentum ? 'default' : 'pointer',
                        opacity: optimizingYellowMomentum ? 0.65 : 1,
                      }}
                    >
                      {optimizingYellowMomentum ? 'Optimizing...' : 'Optimize'}
                    </button>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <label>
                      <span style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)' }}>
                        <span>Slope Lookback</span><strong>{yellowSlopePeriod} bars</strong>
                      </span>
                      <input type="range" min="4" max="12" step="1" value={yellowSlopePeriod} onChange={(e) => setYellowSlopePeriod(parseInt(e.target.value, 10))} style={{ width: '100%', accentColor: '#eab308' }} />
                    </label>
                    <label>
                      <span style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)' }}>
                        <span>5 EMA Steepness</span><strong>{yellowFastSlope.toFixed(1)} pt</strong>
                      </span>
                      <input type="range" min="10" max="50" step="1" value={yellowFastSlope} onChange={(e) => setYellowFastSlope(parseFloat(e.target.value))} style={{ width: '100%', accentColor: '#eab308' }} />
                    </label>
                    <label>
                      <span style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)' }}>
                        <span>10 EMA Steepness</span><strong>{yellowSlowSlope.toFixed(1)} pt</strong>
                      </span>
                      <input type="range" min="8" max="45" step="1" value={yellowSlowSlope} onChange={(e) => setYellowSlowSlope(parseFloat(e.target.value))} style={{ width: '100%', accentColor: '#eab308' }} />
                    </label>
                    <label>
                      <span style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)' }}>
                        <span>EMA Separation</span><strong>{yellowMinGap.toFixed(1)} pt</strong>
                      </span>
                      <input type="range" min="0" max="12" step="0.5" value={yellowMinGap} onChange={(e) => setYellowMinGap(parseFloat(e.target.value))} style={{ width: '100%', accentColor: '#eab308' }} />
                    </label>
                    <label>
                      <span style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)' }}>
                        <span>Yellow Penetration</span><strong>{yellowMinPenetration.toFixed(1)} pt</strong>
                      </span>
                      <input type="range" min="0" max="8" step="0.5" value={yellowMinPenetration} onChange={(e) => setYellowMinPenetration(parseFloat(e.target.value))} style={{ width: '100%', accentColor: '#eab308' }} />
                    </label>
                    <label>
                      <span style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)' }}>
                        <span>Tail Length</span><strong>{yellowMinTail.toFixed(1)} pt</strong>
                      </span>
                      <input type="range" min="0" max="8" step="0.5" value={yellowMinTail} onChange={(e) => setYellowMinTail(parseFloat(e.target.value))} style={{ width: '100%', accentColor: '#eab308' }} />
                    </label>
                    <label>
                      <span style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)' }}>
                        <span>Arity Lookback</span><strong>{yellowArityLookback} bars</strong>
                      </span>
                      <input type="range" min="4" max="14" step="1" value={yellowArityLookback} onChange={(e) => setYellowArityLookback(parseInt(e.target.value, 10))} style={{ width: '100%', accentColor: '#eab308' }} />
                    </label>
                    <label>
                      <span style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)' }}>
                        <span>Maximum Clumping</span><strong>{yellowMaxOverlap.toFixed(2)}</strong>
                      </span>
                      <input type="range" min="0.35" max="1.4" step="0.05" value={yellowMaxOverlap} onChange={(e) => setYellowMaxOverlap(parseFloat(e.target.value))} style={{ width: '100%', accentColor: '#eab308' }} />
                    </label>
                    <label>
                      <span style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)' }}>
                        <span>Maximum Reversals</span><strong>{yellowMaxReversals}</strong>
                      </span>
                      <input type="range" min="0" max="6" step="1" value={yellowMaxReversals} onChange={(e) => setYellowMaxReversals(parseInt(e.target.value, 10))} style={{ width: '100%', accentColor: '#eab308' }} />
                    </label>
                    {yellowOptimizationSummary && (
                      <div style={{ color: 'var(--text-secondary)', borderTop: '1px solid var(--border-color)', paddingTop: '8px', lineHeight: '1.5' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span>Tested:</span>
                          <strong>{yellowOptimizationSummary.tested_configs}</strong>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span>Best Net:</span>
                          <strong style={{ color: (yellowOptimizationSummary.best_summary?.net_profit_bricks || 0) >= 0 ? '#10b981' : '#ef4444' }}>
                            {(yellowOptimizationSummary.best_summary?.net_profit_bricks || 0).toFixed(1)} ranges
                          </strong>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '10px' }}>
                  <div style={{ color: '#7c3aed', fontWeight: '600', marginBottom: '8px' }}>
                    Signal Set 3: No-Tail Arity
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <label>
                      <span style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)' }}>
                        <span>Left-Side Lookback</span><strong>{set3LeftLookback} bars</strong>
                      </span>
                      <input type="range" min="3" max="30" step="1" value={set3LeftLookback} onChange={(e) => setSet3LeftLookback(parseInt(e.target.value, 10))} style={{ width: '100%', accentColor: '#7c3aed' }} />
                    </label>
                    <label>
                      <span style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)' }}>
                        <span>Maximum Left Overlaps</span><strong>{set3MaxLeftOverlaps}</strong>
                      </span>
                      <input type="range" min="0" max="8" step="1" value={set3MaxLeftOverlaps} onChange={(e) => setSet3MaxLeftOverlaps(parseInt(e.target.value, 10))} style={{ width: '100%', accentColor: '#7c3aed' }} />
                    </label>
                    <label>
                      <span style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)' }}>
                        <span>EMA Trend Strength</span><strong>{set3SlopeThreshold.toFixed(1)} pt</strong>
                      </span>
                      <input type="range" min="1" max="20" step="0.5" value={set3SlopeThreshold} onChange={(e) => setSet3SlopeThreshold(parseFloat(e.target.value))} style={{ width: '100%', accentColor: '#7c3aed' }} />
                    </label>
                    <label>
                      <span style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)' }}>
                        <span>Minimum EMA Separation</span><strong>{set3MinGap.toFixed(2)} bricks</strong>
                      </span>
                      <input type="range" min="0" max="3" step="0.25" value={set3MinGap} onChange={(e) => setSet3MinGap(parseFloat(e.target.value))} style={{ width: '100%', accentColor: '#7c3aed' }} />
                    </label>
                    <label>
                      <span style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)' }}>
                        <span>Synthetic EMA Clearance</span><strong>{set3SyntheticMinGap.toFixed(2)} bricks</strong>
                      </span>
                      <input type="range" min="-1" max="4" step="0.25" value={set3SyntheticMinGap} onChange={(e) => setSet3SyntheticMinGap(parseFloat(e.target.value))} style={{ width: '100%', accentColor: '#7c3aed' }} />
                    </label>
                  </div>
                </div>

                {/* Exit Strategy Selector */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '4px' }}>
                  <span style={{ color: 'var(--text-secondary)', fontWeight: '500' }}>Exit Strategy Permutation:</span>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginTop: '4px' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer', fontWeight: '500', color: exitStrategy === 'fixed' ? 'var(--primary)' : 'var(--text-secondary)', fontSize: '12px' }}>
                      <input 
                        type="radio" 
                        name="exitStrategy" 
                        value="fixed" 
                        checked={exitStrategy === 'fixed'} 
                        onChange={() => setExitStrategy('fixed')} 
                        style={{ accentColor: 'var(--primary)', cursor: 'pointer' }}
                      />
                      Fixed Target (Campaign 1)
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer', fontWeight: '500', color: exitStrategy === 'fixed2' ? 'var(--primary)' : 'var(--text-secondary)', fontSize: '12px' }}>
                      <input 
                        type="radio" 
                        name="exitStrategy" 
                        value="fixed2" 
                        checked={exitStrategy === 'fixed2'} 
                        onChange={() => setExitStrategy('fixed2')} 
                        style={{ accentColor: 'var(--primary)', cursor: 'pointer' }}
                      />
                      Fixed Target 2 (Optimized)
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer', fontWeight: '500', color: exitStrategy === 'trail' ? 'var(--primary)' : 'var(--text-secondary)', fontSize: '12px' }}>
                      <input 
                        type="radio" 
                        name="exitStrategy" 
                        value="trail" 
                        checked={exitStrategy === 'trail'} 
                        onChange={() => setExitStrategy('trail')} 
                        style={{ accentColor: 'var(--primary)', cursor: 'pointer' }}
                      />
                      Winners Run
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer', fontWeight: '500', color: exitStrategy === 'stepup' ? 'var(--primary)' : 'var(--text-secondary)', fontSize: '12px' }}>
                      <input 
                        type="radio" 
                        name="exitStrategy" 
                        value="stepup" 
                        checked={exitStrategy === 'stepup'} 
                        onChange={() => setExitStrategy('stepup')} 
                        style={{ accentColor: 'var(--primary)', cursor: 'pointer' }}
                      />
                      Step Up on Loss
                    </label>
                  </div>
                </div>

                {/* Chart Marker Filters */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '7px', marginTop: '6px' }}>
                  <span style={{ color: 'var(--text-secondary)', fontWeight: '500' }}>Chart Markers:</span>
                  <label htmlFor="showTrainingAnnotations" style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '12px', fontWeight: '500', userSelect: 'none' }}>
                    <input
                      type="checkbox"
                      id="showTrainingAnnotations"
                      checked={showTrainingAnnotations}
                      onChange={(e) => setShowTrainingAnnotations(e.target.checked)}
                      style={{ accentColor: '#22c55e', cursor: 'pointer', width: '16px', height: '16px' }}
                    />
                    Training Annotations ({trainingAnnotationCount})
                  </label>
                  
                  {/* Indented checklist for individual Marker Sets */}
                  {showTrainingAnnotations && availableMarkerSets.length > 0 && (
                    <div style={{ paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '5px', marginTop: '2px', borderLeft: '1px dashed var(--border-color)', marginLeft: '7px' }}>
                      {availableMarkerSets.map(set => {
                        const count = savedAnnotations.filter(
                          ann => !isTailArrowAnnotation(ann) && (ann.markerSet || defaultMarkerSetForChart(activeChart)) === set
                        ).length;
                        const isChecked = visibleMarkerSets[set] !== false;
                        return (
                          <label key={set} style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '11px', fontWeight: '500', userSelect: 'none' }}>
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => setVisibleMarkerSets(prev => ({ ...prev, [set]: !isChecked }))}
                              style={{ accentColor: '#22c55e', cursor: 'pointer', width: '13px', height: '13px' }}
                            />
                            {set} ({count})
                          </label>
                        );
                      })}
                    </div>
                  )}
                  <label htmlFor="showRawSignals" style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '12px', fontWeight: '500', userSelect: 'none' }}>
                    <input
                      type="checkbox"
                      id="showRawSignals"
                      checked={showRawSignals}
                      onChange={(e) => setShowRawSignals(e.target.checked)}
                      style={{ accentColor: 'var(--primary)', cursor: 'pointer', width: '16px', height: '16px' }}
                    />
                    Raw Signal Set 1
                  </label>
                  <label htmlFor="showSignalSet2" style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '12px', fontWeight: '500', userSelect: 'none' }}>
                    <input
                      type="checkbox"
                      id="showSignalSet2"
                      checked={showSignalSet2}
                      onChange={(e) => setShowSignalSet2(e.target.checked)}
                      style={{ accentColor: '#0891b2', cursor: 'pointer', width: '16px', height: '16px' }}
                    />
                    EMA Bounce Set 2 ({backtestResults?.signal_set_2_details?.length || 0})
                  </label>
                  <label htmlFor="showSignalSet3" style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '12px', fontWeight: '500', userSelect: 'none' }}>
                    <input
                      type="checkbox"
                      id="showSignalSet3"
                      checked={showSignalSet3}
                      onChange={(e) => setShowSignalSet3(e.target.checked)}
                      style={{ accentColor: '#7c3aed', cursor: 'pointer', width: '16px', height: '16px' }}
                    />
                    No-Tail Arity Set 3 ({backtestResults?.signal_set_3_details?.length || 0})
                  </label>
                  {(activeChart === 'MES3' || activeChart === 'MESM_reg_5') && (
                    <>
                      <label htmlFor="showMes3PreviousTailSignals" style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '12px', fontWeight: '500', userSelect: 'none' }}>
                        <input
                          type="checkbox"
                          id="showMes3PreviousTailSignals"
                          checked={showMes3PreviousTailSignals}
                          onChange={(e) => setShowMes3PreviousTailSignals(e.target.checked)}
                          style={{ accentColor: '#f59e0b', cursor: 'pointer', width: '16px', height: '16px' }}
                        />
                        MES3 Prev-Bar Tail Rejections ({backtestResults?.mes3_previous_tail_details?.length || 0})
                      </label>
                      <label htmlFor="showMes3TrendTailSignals" style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '12px', fontWeight: '500', userSelect: 'none' }}>
                        <input
                          type="checkbox"
                          id="showMes3TrendTailSignals"
                          checked={showMes3TrendTailSignals}
                          onChange={(e) => setShowMes3TrendTailSignals(e.target.checked)}
                          style={{ accentColor: '#f59e0b', cursor: 'pointer', width: '16px', height: '16px' }}
                        />
                        MES3 8 EMA Trend-Tail ({backtestResults?.mes3_trend_tail_details?.length || 0})
                      </label>
                      <label htmlFor="showMes3HaEmaApproachSignals" style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '12px', fontWeight: '500', userSelect: 'none' }}>
                        <input
                          type="checkbox"
                          id="showMes3HaEmaApproachSignals"
                          checked={showMes3HaEmaApproachSignals}
                          onChange={(e) => setShowMes3HaEmaApproachSignals(e.target.checked)}
                          style={{ accentColor: '#14b8a6', cursor: 'pointer', width: '16px', height: '16px' }}
                        />
                        HA 10 EMA Reclaim Tail Setup ({backtestResults?.mes3_ha_ema_approach_details?.length || 0})
                      </label>
                      {isMesRangeCampaignChart(activeChart) && (
                        <>
                          <label htmlFor="showMesReg5LongTailSignals" style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '12px', fontWeight: '500', userSelect: 'none' }}>
                            <input
                              type="checkbox"
                              id="showMesReg5LongTailSignals"
                              checked={showMesReg5LongTailSignals}
                              onChange={(e) => setShowMesReg5LongTailSignals(e.target.checked)}
                              style={{ accentColor: '#7c3aed', cursor: 'pointer', width: '16px', height: '16px' }}
                            />
                            MES Reg5 Long Tail ({backtestResults?.mes_reg5_long_tail_details?.length || 0})
                          </label>
                          <label htmlFor="showMesReg5EmaBounceAritySignals" style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '12px', fontWeight: '500', userSelect: 'none' }}>
                            <input
                              type="checkbox"
                              id="showMesReg5EmaBounceAritySignals"
                              checked={showMesReg5EmaBounceAritySignals}
                              onChange={(e) => setShowMesReg5EmaBounceAritySignals(e.target.checked)}
                              style={{ accentColor: '#10b981', cursor: 'pointer', width: '16px', height: '16px' }}
                            />
                            MES Reg5 EMA Bounce Arity ({backtestResults?.mes_reg5_ema_bounce_arity_details?.length || 0})
                          </label>
                          <label htmlFor="showMesReg5PinBarBreakoutSignals" style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '12px', fontWeight: '500', userSelect: 'none' }}>
                            <input
                              type="checkbox"
                              id="showMesReg5PinBarBreakoutSignals"
                              checked={showMesReg5PinBarBreakoutSignals}
                              onChange={(e) => setShowMesReg5PinBarBreakoutSignals(e.target.checked)}
                              style={{ accentColor: '#f97316', cursor: 'pointer', width: '16px', height: '16px' }}
                            />
                            MES Reg5 Pin Bar Breakout ({backtestResults?.mes_reg5_pin_bar_breakout_details?.length || 0})
                          </label>
                        </>
                      )}
                      <label htmlFor="showSecondaryPane" style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '12px', fontWeight: '500', userSelect: 'none', marginTop: '4px', borderTop: '1px solid rgba(255, 255, 255, 0.05)', paddingTop: '6px' }}>
                        <input
                          type="checkbox"
                          id="showSecondaryPane"
                          checked={showSecondaryPane}
                          onChange={(e) => setShowSecondaryPane(e.target.checked)}
                          style={{ accentColor: 'var(--primary)', cursor: 'pointer', width: '16px', height: '16px' }}
                        />
                        Show Heiken Ashi Pane
                      </label>
                    </>
                  )}
                  <label htmlFor="showCampaignTrades" style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '12px', fontWeight: '500', userSelect: 'none' }}>
                    <input
                      type="checkbox"
                      id="showCampaignTrades"
                      checked={showCampaignTrades}
                      onChange={(e) => setShowCampaignTrades(e.target.checked)}
                      style={{ accentColor: 'var(--primary)', cursor: 'pointer', width: '16px', height: '16px' }}
                    />
                    Campaign Trades and Outcomes
                  </label>
                  <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', color: 'var(--text-secondary)', fontSize: '12px', fontWeight: '500' }}>
                    <span>Campaign View</span>
                    <select
                      value={campaignView}
                      onChange={(e) => setCampaignView(e.target.value)}
                      style={{
                        width: '100%',
                        height: '32px',
                        background: 'var(--bg-main)',
                        color: 'var(--text-main)',
                        border: '1px solid var(--border-color)',
                        borderRadius: '6px',
                        padding: '0 8px',
                      }}
                    >
                      {Object.entries(CAMPAIGN_OPTIONS).map(([value, option]) => (
                        <option key={value} value={value}>{option.label}</option>
                      ))}
                    </select>
                  </label>
                </div>

                <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '8px', marginTop: '4px', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
                  Performance test: one 15-tick favorable brick before the signal tail is exceeded by 2 ticks.
                </div>
              </div>
            </div>

            {/* Active Dataset Stats */}
            <div style={{ background: 'var(--bg-card)', padding: '14px', borderRadius: '12px', border: '1px solid var(--border-color)', fontSize: '12px' }}>
              <h4 style={{ color: 'var(--primary)', marginBottom: '8px', fontSize: '13px', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span>📊</span> Dataset Stats
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Total Bricks:</span>
                  <span style={{ fontWeight: '600' }}>{chartData.length}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>User Annotations:</span>
                  <span style={{ fontWeight: '600', color: 'var(--primary)' }}>{savedAnnotations.length}</span>
                </div>
              </div>
            </div>

            {/* Backtest & Alignment Stats */}
            {loadingBacktest ? (
              <div style={{ background: 'var(--bg-card)', padding: '16px', borderRadius: '12px', border: '1px solid var(--border-color)', fontSize: '12px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                Running backtester engine...
              </div>
            ) : stats ? (
              <div style={{ background: 'var(--bg-card)', padding: '14px', borderRadius: '12px', border: '1px solid var(--border-color)', fontSize: '12px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div>
                  <h4 style={{ color: '#10b981', marginBottom: '8px', fontSize: '13px', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span>⚙️</span> Signal Quality
                  </h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Total Signals:</span>
                      <span style={{ fontWeight: '600' }}>{stats.totalSignals}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Passed / Failed:</span>
                      <span style={{ fontWeight: '600' }}>{stats.passed}P - {stats.failed}F</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Pass Rate:</span>
                      <span style={{ fontWeight: '600', color: parseFloat(stats.passRate) >= 50 ? '#10b981' : '#ef4444' }}>{stats.passRate}%</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Pending:</span>
                      <span style={{ fontWeight: '600' }}>{stats.pending}</span>
                    </div>
                  </div>
                </div>

                <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '10px' }}>
                  <h4 style={{ color: '#3b82f6', marginBottom: '8px', fontSize: '13px', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span>👁️</span> Eye vs. Algorithm
                  </h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Match Rate:</span>
                      <span style={{ fontWeight: '600', color: '#3b82f6' }}>{stats.alignmentRate}% ({stats.matches}/{stats.totalLabeled})</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Missed (FN):</span>
                      <span style={{ fontWeight: '600', color: stats.missed > 0 ? '#ff9100' : 'var(--text-secondary)' }}>{stats.missed}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Over-Triggers (FP):</span>
                      <span style={{ fontWeight: '600', color: stats.overTriggers > 0 ? '#ef4444' : 'var(--text-secondary)' }}>{stats.overTriggers}</span>
                    </div>
                  </div>
                </div>

                <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '10px' }}>
                  <h4 style={{ color: '#a855f7', marginBottom: '8px', fontSize: '13px', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span>🎯</span> Session Campaign (Opt. B)
                  </h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Exit Strategy:</span>
                      <span style={{ fontWeight: '600', textTransform: 'capitalize', color: 'var(--primary)' }}>
                        {backtestResults?.campaign_results?.exit_strategy === 'trail' 
                          ? 'Winners Run' 
                          : backtestResults?.campaign_results?.exit_strategy === 'stepup' 
                            ? 'Step Up on Loss' 
                            : backtestResults?.campaign_results?.exit_strategy === 'fixed2'
                              ? 'Fixed Target 2 (Optimized)'
                              : 'Fixed Target (Campaign 1)'}
                      </span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Trading Days:</span>
                      <span style={{ fontWeight: '600' }}>{stats.campaignTotalDays} days</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Winning Days (+{backtestResults?.campaign_results?.summary?.target_bricks || 2.0}):</span>
                      <span style={{ fontWeight: '600', color: '#10b981' }}>{stats.campaignWinningDays} ({stats.campaignWinRate}%)</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Losing/Flat Days:</span>
                      <span style={{ fontWeight: '600', color: stats.campaignLosingDays > 0 ? '#ef4444' : 'var(--text-secondary)' }}>{stats.campaignLosingDays}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Avg Time to Success:</span>
                      <span style={{ fontWeight: '600', color: 'var(--primary)' }}>{stats.campaignAvgTime}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Max Drawdown:</span>
                      <span style={{ fontWeight: '600', color: parseFloat(stats.campaignMaxDrawdown) < 0 ? '#ef4444' : 'var(--text-secondary)' }}>{stats.campaignMaxDrawdown} bricks</span>
                    </div>
                  </div>
                </div>

                <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '10px' }}>
                  <h4 style={{ color: campaignView === 'yellowMomentum' ? '#eab308' : '#0891b2', marginBottom: '8px', fontSize: '13px', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span>↗</span> {stats.selectedCampaignName}
                  </h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Selected View:</span>
                      <span style={{ fontWeight: '600', color: 'var(--primary)' }}>{CAMPAIGN_OPTIONS[campaignView]?.label || 'Yellow Momentum 1:1'}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Exit:</span>
                      <span style={{ fontWeight: '600', color: 'var(--text-main)', textAlign: 'right' }}>{stats.selectedCampaignExit}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Trades:</span>
                      <span style={{ fontWeight: '600' }}>{stats.selectedCampaignTrades}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Wins / Losses:</span>
                      <span style={{ fontWeight: '600' }}>{stats.selectedCampaignWinningTrades}W - {stats.selectedCampaignLosingTrades}L</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Trade Win Rate:</span>
                      <span style={{ fontWeight: '600', color: parseFloat(stats.selectedCampaignTradeWinRate) >= 40 ? '#10b981' : '#ef4444' }}>{stats.selectedCampaignTradeWinRate}%</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Net:</span>
                      <span style={{ fontWeight: '600', color: parseFloat(stats.selectedCampaignNet) >= 0 ? '#10b981' : '#ef4444' }}>{stats.selectedCampaignNet} ranges</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Max Drawdown:</span>
                      <span style={{ fontWeight: '600', color: parseFloat(stats.selectedCampaignMaxDrawdown) < 0 ? '#ef4444' : 'var(--text-secondary)' }}>{stats.selectedCampaignMaxDrawdown} ranges</span>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div style={{ background: 'var(--bg-card)', padding: '16px', borderRadius: '12px', border: '1px solid var(--border-color)', fontSize: '12px', textAlign: 'center', color: 'var(--text-muted)' }}>
                No backtest results available.
              </div>
            )}
          </div>
        )}
      </aside>

      {/* Main Workspace */}
      <main className="main-workspace">
        {/* Chart View */}
        <div className="chart-container">
          {chartData.length > 0 ? (
            <>
              <div className="floating-info">
                <h4>{activeChart}</h4>
                <div className="inline-status">
                  <span className="status-dot"></span>
                  <span>Local Engine Active</span>
                </div>
                <div>{isRegularCandlestick ? 'Bars' : 'Bricks'}: {chartData.length}</div>
                {(activeChart === 'MES3' || activeChart === 'MESM_reg_5') && secondaryChartData.length > 0 && (
                  <div>HA 2s Bars: {secondaryChartData.length}</div>
                )}
                {currentHaSelection && (
                  <div style={{ color: 'var(--primary)' }}>
                    HA Selected: {currentHaSelection.barCount} bars · {currentHaSelection.linkedMesBarCount} MES
                  </div>
                )}
                <div style={{ color: 'var(--text-secondary)' }}>
                  Click on any {isRegularCandlestick ? 'candlestick' : 'Renko brick'} body or wick to add/edit annotations.
                </div>
                <div style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>
                  Alt+click below a tail for a green up arrow; Alt+click above a tail for a red down arrow.
                </div>
              </div>
              <button
                type="button"
                className="annotations-drawer-button"
                onClick={() => setAnnotationsDrawerOpen(true)}
              >
                Annotations ({trainingAnnotationCount + tailArrowAnnotations.length})
              </button>
              <ChartComponent
                data={chartData}
                secondaryData={(activeChart === 'MES3' || activeChart === 'MESM_reg_5') ? secondaryChartData : []}
                annotations={mergedAnnotations}
                onBrickClick={handleBrickClick}
                onAddTailArrowAnnotation={handleAddTailArrowAnnotation}
                onClearTailArrowAnnotations={handleClearTailArrowAnnotations}
                onHaSelectionChange={handleHaSelectionChange}
                bookmark={bookmark}
                onSetBookmark={handleBookmarkBrick}
                onClearBookmark={handleClearBookmark}
                isRegularCandlestick={isRegularCandlestick}
                showSecondaryPane={showSecondaryPane}
                onToggleSecondaryPane={setShowSecondaryPane}
              />
            </>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', flexDirection: 'column', gap: '12px', color: '#1e293b' }}>
              <span style={{ fontSize: '48px' }}>📈</span>
              <span style={{ fontWeight: '600', fontSize: '16px' }}>No Dataset Loaded</span>
              <span style={{ fontSize: '13px' }}>Export data from MultiCharts and import it to view the interactive chart.</span>
            </div>
          )}
        </div>

      </main>

      {datasetContextMenu && (
        <div
          className="chart-context-menu"
          style={{ left: datasetContextMenu.x, top: datasetContextMenu.y }}
          onClick={event => event.stopPropagation()}
        >
          <button
            type="button"
            onClick={() => {
              const chartName = datasetContextMenu.chartName;
              setDatasetContextMenu(null);
              // Reuse the existing delete flow; it takes a synthetic event-like arg.
              handleDeleteDataset(chartName, { stopPropagation() {} });
            }}
          >
            Delete
          </button>
          <button
            type="button"
            onClick={() => {
              setRenameValue(datasetContextMenu.chartName);
              setRenamingChart(datasetContextMenu.chartName);
              setDatasetContextMenu(null);
            }}
          >
            Rename
          </button>
        </div>
      )}

      {annotationsDrawerOpen && (
        <div className="annotations-drawer-backdrop" onClick={() => setAnnotationsDrawerOpen(false)}>
          <aside className="annotations-drawer" onClick={event => event.stopPropagation()}>
            <div className="panel-header">
              <div>
                <h3 className="section-title" style={{ margin: 0 }}>Annotations Log</h3>
                <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                  Total Marked: {filteredManualAnnotations.length}
                </span>
              </div>
              <button
                type="button"
                className="drawer-close-button"
                onClick={() => setAnnotationsDrawerOpen(false)}
              >
                Close
              </button>
            </div>

            <div style={{ overflowY: 'auto', flex: 1 }}>
              {filteredManualAnnotations.length === 0 ? (
                <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
                  No visible annotations. Make sure their marker set is enabled in the sidebar.
                </div>
              ) : (
                <table className="annotations-table">
                  <thead>
                    <tr>
                      <th>Timestamp (ISO)</th>
                      <th>Set</th>
                      <th>Action</th>
                      <th>Open</th>
                      <th>High</th>
                      <th>Low</th>
                      <th>Close</th>
                      <th>EMA</th>
                      <th>Comments / Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredManualAnnotations.map((ann, i) => (
                      <tr
                        key={i}
                        style={{ cursor: 'pointer' }}
                        onClick={() => {
                          const indexedBrick = Number.isInteger(ann.barIndex) ? chartData[ann.barIndex] : null;
                          const brick = indexedBrick || chartData.find(d =>
                            d.time === ann.timestamp && metricsMatchBrick(ann.metrics, d)
                          );
                          if (brick) {
                            setAnnotationsDrawerOpen(false);
                            handleBrickClick({
                              ...brick,
                              originalTime: brick.time,
                              originalIndex: ann.barIndex ?? chartData.indexOf(brick),
                            });
                          }
                        }}
                      >
                        <td style={{ color: 'var(--text-secondary)', fontFamily: 'monospace' }}>
                          {ann.timestamp}
                        </td>
                        <td>
                          <span className="badge marker-set">
                            {ann.markerSet || defaultMarkerSetForChart(activeChart)}
                          </span>
                        </td>
                        <td>
                          <span className={`badge ${ann.tailArrow === 'up' ? 'buy' : ann.tailArrow === 'down' ? 'sell' : ann.action?.toLowerCase()}`}>
                            {ann.tailArrow === 'up' ? '↑ TAIL' : ann.tailArrow === 'down' ? '↓ TAIL' : ann.action?.toUpperCase()}
                          </span>
                        </td>
                        <td>{ann.metrics?.open?.toFixed(2)}</td>
                        <td>{ann.metrics?.high?.toFixed(2)}</td>
                        <td>{ann.metrics?.low?.toFixed(2)}</td>
                        <td>{ann.metrics?.close?.toFixed(2)}</td>
                        <td>{ann.metrics?.ema?.toFixed(4)}</td>
                        <td style={{ color: 'var(--text-secondary)', maxWidth: '280px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {ann.comment}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </aside>
        </div>
      )}

      {/* Annotation Modal Popup (Modeless & Draggable) */}
      {modalOpen && selectedBrick && (
        <div className="modal-non-blocking-container" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 100, pointerEvents: 'none' }}>
          <div 
            className="modal-content" 
            style={{ 
              position: 'fixed', 
              left: `${modalPosition.x}px`, 
              top: `${modalPosition.y}px`, 
              pointerEvents: 'auto',
              margin: 0
            }}
          >
            <div 
              className="modal-header" 
              onMouseDown={handleMouseDown} 
              style={{ 
                cursor: 'move', 
                userSelect: 'none', 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center', 
                borderBottom: '1px solid var(--border-color)', 
                paddingBottom: '12px', 
                marginBottom: '4px' 
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ color: 'var(--text-muted)', cursor: 'move', userSelect: 'none' }}>⋮⋮</span>
                <span className="modal-title" style={{ margin: 0 }}>
                  {isEditing ? 'Modify Annotation' : 'Add Trade Annotation'}
                </span>
              </div>
              <button 
                onClick={() => setModalOpen(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-muted)',
                  fontSize: '18px',
                  cursor: 'pointer',
                  padding: '4px 8px',
                  borderRadius: '4px',
                  transition: 'all 0.2s',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
                onMouseOver={(e) => e.currentTarget.style.color = 'var(--color-sell)'}
                onMouseOut={(e) => e.currentTarget.style.color = 'var(--text-muted)'}
              >
                ✕
              </button>
            </div>
            
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
              MultiCharts timestamp:{' '}
              <span style={{ fontFamily: 'monospace' }}>
                {selectedBrick.originalTime || selectedBrick.time}
              </span>
            </div>
            <div
              style={{
                fontSize: '11px',
                color: discussionStatus.startsWith('Could not') ? 'var(--color-sell)' : 'var(--primary)',
                background: 'var(--bg-card)',
                border: '1px solid var(--border-color)',
                borderRadius: '6px',
                padding: '7px 9px',
              }}
            >
              AI discussion: {discussionStatus || 'Select a brick to publish its context.'}
            </div>

            <div className="bar-stats-grid">
              <div className="stat-item">
                <span className="stat-label">Open</span>
                <span className="stat-value">{selectedBrick.open.toFixed(2)}</span>
              </div>
              <div className="stat-item">
                <span className="stat-label">High</span>
                <span className="stat-value">{selectedBrick.high.toFixed(2)}</span>
              </div>
              <div className="stat-item">
                <span className="stat-label">Low</span>
                <span className="stat-value">{selectedBrick.low.toFixed(2)}</span>
              </div>
              <div className="stat-item">
                <span className="stat-label">Close</span>
                <span className="stat-value">{selectedBrick.close.toFixed(2)}</span>
              </div>
              <div className="stat-item">
                <span className="stat-label">{isNineEmaChart(activeChart) ? '9 EMA' : '5 EMA'}</span>
                <span className="stat-value" style={{ color: 'var(--primary)' }}>
                  {(selectedBrick.ema5 ?? selectedBrick.ema) ? (selectedBrick.ema5 ?? selectedBrick.ema).toFixed(4) : 'N/A'}
                </span>
              </div>
              {selectedBrick.ema10 !== undefined && selectedBrick.ema10 !== null && (
                <div className="stat-item">
                  <span className="stat-label">10 EMA</span>
                  <span className="stat-value" style={{ color: '#008000' }}>
                    {selectedBrick.ema10.toFixed(4)}
                  </span>
                </div>
              )}
            </div>

            <div>
              <div style={{ fontSize: '12px', fontWeight: '500', marginBottom: '6px' }}>Marker Set:</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <select
                  className="marker-set-select"
                  value={isCreatingNewSet ? '__NEW_SET__' : (selectedMarkerSet || defaultMarkerSetForChart(activeChart))}
                  onChange={e => {
                    if (e.target.value === '__NEW_SET__') {
                      setIsCreatingNewSet(true);
                      setSelectedMarkerSet('');
                    } else {
                      setIsCreatingNewSet(false);
                      setSelectedMarkerSet(e.target.value);
                    }
                  }}
                  style={{ width: '100%', padding: '6px', borderRadius: '4px', border: '1px solid var(--border-color)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: '12px' }}
                >
                  {availableMarkerSets.map(set => (
                    <option key={set} value={set}>{set}</option>
                  ))}
                  <option value="__NEW_SET__">+ Create new set...</option>
                </select>
                {isCreatingNewSet && (
                  <input
                    type="text"
                    placeholder="Enter new set name..."
                    value={selectedMarkerSet}
                    onChange={e => setSelectedMarkerSet(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '6px',
                      borderRadius: '4px',
                      border: '1px solid var(--border-color)',
                      background: 'var(--bg-secondary)',
                      color: 'var(--text-primary)',
                      fontSize: '12px',
                    }}
                  />
                )}
              </div>
            </div>

            <div>
              <div style={{ fontSize: '12px', fontWeight: '500', marginBottom: '6px' }}>Label Action:</div>
              <div className="action-buttons">
                <button
                  className={`action-btn buy ${selectedAction === 'Buy' ? 'selected' : ''}`}
                  onClick={() => setSelectedAction('Buy')}
                >
                  BUY
                </button>
                <button
                  className={`action-btn sell ${selectedAction === 'Sell' ? 'selected' : ''}`}
                  onClick={() => setSelectedAction('Sell')}
                >
                  SELL
                </button>
                <button
                  className={`action-btn skip ${selectedAction === 'Skip' ? 'selected' : ''}`}
                  onClick={() => setSelectedAction('Skip')}
                >
                  SKIP / FALSE
                </button>
              </div>
            </div>

            <div>
              <div style={{ fontSize: '12px', fontWeight: '500', marginBottom: '6px' }}>Notes (e.g., wick size, EMA slope):</div>
              <textarea
                className="comment-input"
                placeholder="Enter trading context here..."
                value={commentText}
                onChange={e => setCommentText(e.target.value)}
              />
            </div>

            <div className="modal-footer">
              {isEditing && (
                <button
                  className="btn btn-delete"
                  style={{ marginRight: 'auto' }}
                  onClick={handleDeleteAnnotation}
                >
                  Delete
                </button>
              )}
              <button
                className="btn btn-secondary"
                onClick={handleSetBookmark}
              >
                {bookmark?.barIndex === selectedBrick.originalIndex ? 'Bookmarked' : 'Bookmark This Bar'}
              </button>
              <button
                className="btn btn-secondary"
                onClick={() => setModalOpen(false)}
              >
                Cancel
              </button>
              <button
                className="btn btn-primary"
                onClick={handleSaveAnnotation}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
