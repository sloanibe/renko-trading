import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { exec } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 5000;

// Enable CORS and JSON body parsing
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Path to the data directory
const DATA_DIR = path.join(__dirname, '..', 'data');
const DEFAULT_EXPORTS_DIR = '/mnt/c/MultiChartsExports';
const EXPORT_SETTINGS_PATH = path.join(DATA_DIR, 'export_settings.json');
const RESERVED_CHART_FILES = new Set(['annotations.json', 'ai_selection.json', 'export_settings.json']);

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const ANNOTATIONS_PATH = path.join(DATA_DIR, 'annotations.json');
const AI_SELECTION_PATH = path.join(DATA_DIR, 'ai_selection.json');





const sanitizeChartName = (name) => {
 
  if (!name || typeof name !== 'string') return null;
  const trimmed = name.trim().replace(/\.json$/i, '');
  if (!trimmed) return null;
  if (/[\\/]/.test(trimmed) || trimmed.includes('..')) return null;
  if (RESERVED_CHART_FILES.has(`${trimmed}.json`)) return null;
  return trimmed;
};

const resolveChartFilePath = (name) => {
  const safeName = sanitizeChartName(name);
  if (!safeName) return null;
  const filePath = path.join(DATA_DIR, `${safeName}.json`);
  const resolved = path.resolve(filePath);
  if (!resolved.startsWith(`${path.resolve(DATA_DIR)}${path.sep}`)) return null;
  return resolved;
};

const normalizeExportPath = (inputPath) => {
  if (!inputPath || typeof inputPath !== 'string') return null;
  let trimmed = inputPath.trim();
  if (!trimmed) return null;

  const windowsDriveMatch = trimmed.match(/^([A-Za-z]):[\\/]?(.*)$/);
  if (windowsDriveMatch) {
    const drive = windowsDriveMatch[1].toLowerCase();
    const rest = (windowsDriveMatch[2] || '').replace(/\\/g, '/').replace(/\/+$/, '');
    return rest ? `/mnt/${drive}/${rest}` : `/mnt/${drive}`;
  }

  return path.resolve(trimmed.replace(/\\/g, '/'));
};

const toDisplayPath = (resolvedPath) => {
  const windowsMatch = resolvedPath.match(/^\/mnt\/([a-z])\/(.*)$/i);
  if (windowsMatch) {
    const drive = windowsMatch[1].toUpperCase();
    const rest = windowsMatch[2].replace(/\//g, '\\');
    return rest ? `${drive}:\\${rest}` : `${drive}:\\`;
  }
  return resolvedPath;
};

const loadExportDir = () => {
  try {
    if (fs.existsSync(EXPORT_SETTINGS_PATH)) {
      const settings = JSON.parse(fs.readFileSync(EXPORT_SETTINGS_PATH, 'utf-8') || '{}');
      const normalized = normalizeExportPath(settings.exportDir);
      if (normalized) return normalized;
    }
  } catch {
    // Fall through to default.
  }
  return DEFAULT_EXPORTS_DIR;
};

const saveExportDir = (inputPath) => {
  const normalized = normalizeExportPath(inputPath);
  if (!normalized) {
    throw new Error('A valid export folder path is required.');
  }
  if (!fs.existsSync(normalized) || !fs.statSync(normalized).isDirectory()) {
    throw new Error('Export folder does not exist or is not a directory.');
  }
  fs.writeFileSync(
    EXPORT_SETTINGS_PATH,
    JSON.stringify({ exportDir: normalized }, null, 2),
    'utf-8'
  );
  return normalized;
};

const resolveExportFilePath = (fileName, exportDir = loadExportDir()) => {
  if (!fileName || typeof fileName !== 'string') return null;
  const trimmed = path.basename(fileName.trim());
  if (!trimmed || trimmed !== fileName.trim() || /[\\/]/.test(fileName)) return null;
  const filePath = path.join(exportDir, trimmed);
  const resolved = path.resolve(filePath);
  const resolvedExportDir = path.resolve(exportDir);
  if (!resolved.startsWith(`${resolvedExportDir}${path.sep}`) && resolved !== resolvedExportDir) return null;
  return resolved;
};

const listExportFiles = (exportDir = loadExportDir()) => {
  if (!fs.existsSync(exportDir) || !fs.statSync(exportDir).isDirectory()) {
    return { available: false, files: [] };
  }
  const files = fs.readdirSync(exportDir)
    .filter((entry) => fs.statSync(path.join(exportDir, entry)).isFile())
    .sort((a, b) => a.localeCompare(b));
  return { available: true, files };
};

const listBrowsableDirectory = (inputPath) => {
  const requestedPath = normalizeExportPath(inputPath) || loadExportDir();
  const resolvedPath = path.resolve(requestedPath);
  if (!fs.existsSync(resolvedPath) || !fs.statSync(resolvedPath).isDirectory()) {
    throw new Error('Folder not found.');
  }

  const parentPath = path.dirname(resolvedPath);
  const entries = fs.readdirSync(resolvedPath)
    .map((name) => {
      const entryPath = path.join(resolvedPath, name);
     const stats = fs.statSync(entryPath);
      return {
        name,
        type: stats.isDirectory() ? 'directory' : 'file',
      };
    })
    .sort((a, b) => {
      if (a.type !== b.type) return a.type === 'directory' ? -1 : 1;
      return a.name.localeCompare(b.name);
    });

  return {
    path: resolvedPath,
    displayPath: toDisplayPath(resolvedPath),
    parentPath: parentPath !== resolvedPath ? parentPath : null,
    parentDisplayPath: parentPath !== resolvedPath ? toDisplayPath(parentPath) : null,
    entries,
  };
};

const readExportChartData = (exportPath) => {
  const raw = fs.readFileSync(exportPath, 'utf-8').trim();
  if (!raw) {
    throw new Error('Export file is empty.');
  }
  return JSON.parse(raw);
};

const validateChartData = (data) => {
  if (!Array.isArray(data) || data.length === 0) {
    return 'Chart data must be a non-empty JSON array of bars.';
  }
  const required = ['time', 'open', 'high', 'low', 'close'];
  for (const key of required) {
    if (!(key in data[0])) {
      return `Each bar must include "${key}".`;
    }
  }
  return null;
};

const writeChartFile = (name, data) => {
  const filePath = resolveChartFilePath(name);
  if (!filePath) {
    throw new Error('Invalid dataset name.');
  }
  const validationError = validateChartData(data);
  if (validationError) {
    throw new Error(validationError);
  }
 
  const tempPath = `${filePath}.tmp`;
  fs.writeFileSync(tempPath, JSON.stringify(data, null, 2), 'utf-8');
  fs.renameSync(tempPath, filePath);
  return sanitizeChartName(name);
};

const removeChartAnnotations = (chartName) => {
  if (!fs.existsSync(ANNOTATIONS_PATH)) return;
  const allAnnotations = JSON.parse(fs.readFileSync(ANNOTATIONS_PATH, 'utf-8') || '{}');
  if (!(chartName in allAnnotations)) return;
  delete allAnnotations[chartName];
  fs.writeFileSync(ANNOTATIONS_PATH, JSON.stringify(allAnnotations, null, 2), 'utf-8');
};

// Re-key a chart's annotations entry when the chart is renamed.
const renameChartAnnotations = (oldName, newName) => {
  if (!fs.existsSync(ANNOTATIONS_PATH)) return;
  const allAnnotations = JSON.parse(fs.readFileSync(ANNOTATIONS_PATH, 'utf-8') || '{}');
  if (!(oldName in allAnnotations)) return;
  const reordered = {};
  for (const [key, value] of Object.entries(allAnnotations)) {
    reordered[key === oldName ? newName : key] = value;
  }
  fs.writeFileSync(ANNOTATIONS_PATH, JSON.stringify(reordered, null, 2), 'utf-8');
};

// Endpoint: List all chart files (excluding annotations.json)
app.get('/api/charts', (req, res) => {
  try {
    const files = fs.readdirSync(DATA_DIR);
    const chartFiles = files
      .filter(f => f.endsWith('.json') && !['annotations.json', 'ai_selection.json', 'export_settings.json'].includes(f))
      .map(f => f.replace('.json', ''));
    res.json(chartFiles);
  } catch (error) {
    res.status(500).json({ error: 'Failed to read data directory', details: error.message });
  }
});

// Endpoint: Get configured MultiCharts export folder
app.get('/api/exports/settings', (req, res) => {
  try {
    const exportDir = loadExportDir();
    const { available } = listExportFiles(exportDir);
    res.json({
      exportDir,
      displayPath: toDisplayPath(exportDir),
      available,
    });
  } catch (error) {
 
 
 
 
 
 
 
 
 
 
 
    res.status(500).json({ error: 'Failed to read export settings', details: error.message });
  }
});

// Endpoint: Update configured MultiCharts export folder
app.put('/api/exports/settings', (req, res) => {
  try {
    const exportDir = saveExportDir(req.body?.path || req.body?.exportDir);
    const listing = listExportFiles(exportDir);
    res.json({
      exportDir,
      displayPath: toDisplayPath(exportDir),
      available: listing.available,
      files: listing.files,
    });
  } catch (error) {
    res.status(400).json({ error: 'Failed to update export folder', details: error.message });
  }
});

// Endpoint: Browse folders to choose an export directory
app.get('/api/exports/browse', (req, res) => {
  try {
    const listing = listBrowsableDirectory(req.query.path || loadExportDir());
    res.json(listing);
  } catch (error) {
    res.status(400).json({ error: 'Failed to browse folder', details: error.message });
  }
});

// Endpoint: List export files in the configured folder
app.get('/api/exports', (req, res) => {
  try {
    const exportDir = loadExportDir();
    const listing = listExportFiles(exportDir);
    res.json({
      exportDir,
      displayPath: toDisplayPath(exportDir),
      available: listing.available,
      files: listing.files,
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to read export directory', details: error.message });
  }
});

// Endpoint: Import a dataset from upload or MultiCharts export folder
app.post('/api/charts', (req, res) => {
  try {
    const { name, data, exportFile } = req.body || {};
 
 
    const safeName = sanitizeChartName(name);
    if (!safeName) {
      return res.status(400).json({ error: 'A valid dataset name is required.' });
    }

    if (exportFile) {
      const exportDir = loadExportDir();
      const exportPath = resolveExportFilePath(exportFile, exportDir);
      if (!exportPath || !fs.existsSync(exportPath)) {
        return res.status(404).json({ error: 'Export file not found in the configured export folder.' });
      }
      const parsed = readExportChartData(exportPath);
      const savedName = writeChartFile(safeName, parsed);
      return res.json({ success: true, name: savedName, barCount: parsed.length, source: 'export' });
    }

    if (data) {
      const savedName = writeChartFile(safeName, data);
      return res.json({ success: true, name: savedName, barCount: data.length, source: 'upload' });
    }

    return res.status(400).json({ error: 'Provide either chart data or an export file to import.' });
  } catch (error) {
    res.status(400).json({ error: 'Failed to import dataset', details: error.message });
  }
});

// Endpoint: Delete a dataset
app.delete('/api/charts/:name', (req, res) => {
  try {
    const chartName = sanitizeChartName(req.params.name);
    const filePath = resolveChartFilePath(chartName);
    if (!chartName || !filePath || !fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'Dataset not found.' });
    }

    fs.unlinkSync(filePath);
    removeChartAnnotations(chartName);
    res.json({ success: true, name: chartName });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete dataset', details: error.message });
  }
});

// Endpoint: Rename a dataset (moves the file and re-keys its annotations)
app.post('/api/charts/:name/rename', (req, res) => {
  try {
    const oldName = sanitizeChartName(req.params.name);
    const newName = sanitizeChartName(req.body && req.body.newName);
    if (!oldName || !newName) {
      return res.status(400).json({ error: 'Invalid dataset name.' });
    }

    const oldPath = resolveChartFilePath(oldName);
    const newPath = resolveChartFilePath(newName);
    if (!oldPath || !fs.existsSync(oldPath)) {
      return res.status(404).json({ error: 'Dataset not found.' });
    }
    if (oldName !== newName) {
      if (newPath && fs.existsSync(newPath)) {
        return res.status(409).json({ error: `A dataset named "${newName}" already exists.` });
      }
      fs.renameSync(oldPath, newPath);
      renameChartAnnotations(oldName, newName);
    }

    res.json({ success: true, oldName, newName });
  } catch (error) {
    res.status(500).json({ error: 'Failed to rename dataset', details: error.message });
  }
});

// Endpoint: Get specific chart data
app.get('/api/charts/:name', (req, res) => {
  try {
    const fileName = `${req.params.name}.json`;
    const filePath = path.join(DATA_DIR, fileName);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'Chart data not found' });
    }
    const data = fs.readFileSync(filePath, 'utf-8');
    res.json(JSON.parse(data));
  } catch (error) {
    res.status(500).json({ error: 'Failed to load chart data', details: error.message });
  }
});

// Endpoint: Get all annotations
app.get('/api/annotations', (req, res) => {
  try {
    if (!fs.existsSync(ANNOTATIONS_PATH)) {
      return res.json({});
    }
    const data = fs.readFileSync(ANNOTATIONS_PATH, 'utf-8');
    res.json(JSON.parse(data || '{}'));
  } catch (error) {
    res.status(500).json({ error: 'Failed to read annotations', details: error.message });
  }
});

// Endpoint: Save annotations for a specific chart key
app.post('/api/annotations', (req, res) => {
  try {
    const { fileKey, annotations } = req.body;
    if (!fileKey) {
      return res.status(400).json({ error: 'Missing fileKey' });
    }

    let allAnnotations = {};
    if (fs.existsSync(ANNOTATIONS_PATH)) {
      const existingData = fs.readFileSync(ANNOTATIONS_PATH, 'utf-8');
      allAnnotations = JSON.parse(existingData || '{}');
    }

    // Update the annotations for this specific chart file
    allAnnotations[fileKey] = annotations || [];

    fs.writeFileSync(ANNOTATIONS_PATH, JSON.stringify(allAnnotations, null, 2), 'utf-8');
    res.json({ success: true, message: `Annotations saved for ${fileKey}` });
  } catch (error) {
    res.status(500).json({ error: 'Failed to save annotations', details: error.message });
  }
});

// Endpoint: Publish the exact chart setup currently selected for AI discussion
app.post('/api/ai-selection', (req, res) => {
  try {
    const selection = req.body;
    const isBarSelection = selection?.chart && Number.isInteger(selection?.selectedBar?.barIndex);
    const isHeikenAshiRange = (
      selection?.type === 'heiken_ashi_range' &&
      selection?.chart &&
      (
        selection.selection === null ||
        (
          selection.selection?.startTime &&
          selection.selection?.endTime &&
          Number.isInteger(selection.selection?.startBarIndex) &&
          Number.isInteger(selection.selection?.endBarIndex)
        )
      )
    );
    if (!isBarSelection && !isHeikenAshiRange) {
      return res.status(400).json({ error: 'Selection must include a chart bar or Heiken Ashi range' });
    }

    const tempPath = `${AI_SELECTION_PATH}.tmp`;
    fs.writeFileSync(tempPath, JSON.stringify(selection, null, 2), 'utf-8');
    fs.renameSync(tempPath, AI_SELECTION_PATH);
    res.json({ success: true, path: AI_SELECTION_PATH });
  } catch (error) {
    res.status(500).json({ error: 'Failed to publish AI selection', details: error.message });
  }
});

app.get('/api/ai-selection', (req, res) => {
  try {
    if (!fs.existsSync(AI_SELECTION_PATH)) {
      return res.status(404).json({ error: 'No chart setup has been selected yet' });
    }
    res.json(JSON.parse(fs.readFileSync(AI_SELECTION_PATH, 'utf-8')));
  } catch (error) {
    res.status(500).json({ error: 'Failed to read AI selection', details: error.message });
  }
});

// Endpoint: Get backtester results
app.get('/api/charts/:name/backtest', (req, res) => {
  try {
    const chartName = req.params.name;
    const pythonScript = path.join(__dirname, '..', 'backend', 'backtester.py');
    
    // Construct command with config overrides if present in query parameters
    let cmd = `python3 "${pythonScript}" --chart "${chartName}" --json`;
    
    if (req.query.slopeThreshold) {
      cmd += ` --slope-threshold ${parseFloat(req.query.slopeThreshold)}`;
    }
    if (req.query.retestTolerance) {
      cmd += ` --retest-tolerance ${parseFloat(req.query.retestTolerance)}`;
    }
    if (req.query.minWick) {
      cmd += ` --min-wick ${parseFloat(req.query.minWick)}`;
    }
    if (req.query.maxEmaDist) {
      cmd += ` --max-ema-dist ${parseFloat(req.query.maxEmaDist)}`;
    }
    if (req.query.cooldownBars !== undefined) {
      cmd += ` --cooldown-bars ${parseInt(req.query.cooldownBars, 10)}`;
    }
    if (req.query.wickBodyOffset !== undefined) {
      cmd += ` --wick-body-offset ${parseInt(req.query.wickBodyOffset, 10)}`;
    }
    if (req.query.exitStrategy) {
      cmd += ` --exit-strategy ${req.query.exitStrategy}`;
    }
    if (req.query.startTime) {
      cmd += ` --start-time ${req.query.startTime}`;
    }
    if (req.query.endTime) {
      cmd += ` --end-time ${req.query.endTime}`;
    }
    if (req.query.aridLookback !== undefined) {
      cmd += ` --arid-lookback ${parseInt(req.query.aridLookback, 10)}`;
    }
    if (req.query.aridMaxOverlap !== undefined) {
      cmd += ` --arid-max-overlap ${parseFloat(req.query.aridMaxOverlap)}`;
    }
    if (req.query.aridMaxReversals !== undefined) {
      cmd += ` --arid-max-reversals ${parseInt(req.query.aridMaxReversals, 10)}`;
    }
    if (req.query.aridSlopeThreshold !== undefined) {
      cmd += ` --arid-slope-threshold ${parseFloat(req.query.aridSlopeThreshold)}`;
    }
    if (req.query.aridMinGap !== undefined) {
      cmd += ` --arid-min-gap ${parseFloat(req.query.aridMinGap)}`;
    }
    if (req.query.bounceType && ['all', 'yellow', 'green'].includes(req.query.bounceType)) {
      cmd += ` --bounce-type ${req.query.bounceType}`;
    }
    if (req.query.set3LeftLookback !== undefined) {
      cmd += ` --set3-left-lookback ${parseInt(req.query.set3LeftLookback, 10)}`;
    }
    if (req.query.set3MaxLeftOverlaps !== undefined) {
      cmd += ` --set3-max-left-overlaps ${parseInt(req.query.set3MaxLeftOverlaps, 10)}`;
    }
    if (req.query.set3SlopeThreshold !== undefined) {
      cmd += ` --set3-slope-threshold ${parseFloat(req.query.set3SlopeThreshold)}`;
    }
    if (req.query.set3MinGap !== undefined) {
      cmd += ` --set3-min-gap ${parseFloat(req.query.set3MinGap)}`;
    }
    if (req.query.set3SyntheticMinGap !== undefined) {
      cmd += ` --set3-synthetic-min-gap ${parseFloat(req.query.set3SyntheticMinGap)}`;
    }
    if (req.query.yellowSlopePeriod !== undefined) {
      cmd += ` --yellow-slope-period ${parseInt(req.query.yellowSlopePeriod, 10)}`;
    }
    if (req.query.yellowFastSlope !== undefined) {
      cmd += ` --yellow-fast-slope ${parseFloat(req.query.yellowFastSlope)}`;
    }
    if (req.query.yellowSlowSlope !== undefined) {
      cmd += ` --yellow-slow-slope ${parseFloat(req.query.yellowSlowSlope)}`;
    }
    if (req.query.yellowMinGap !== undefined) {
      cmd += ` --yellow-min-gap ${parseFloat(req.query.yellowMinGap)}`;
    }
    if (req.query.yellowMinPenetration !== undefined) {
      cmd += ` --yellow-min-penetration ${parseFloat(req.query.yellowMinPenetration)}`;
    }
    if (req.query.yellowMinTail !== undefined) {
      cmd += ` --yellow-min-tail ${parseFloat(req.query.yellowMinTail)}`;
    }
    if (req.query.yellowArityLookback !== undefined) {
      cmd += ` --yellow-arity-lookback ${parseInt(req.query.yellowArityLookback, 10)}`;
    }
    if (req.query.yellowMaxOverlap !== undefined) {
      cmd += ` --yellow-max-overlap ${parseFloat(req.query.yellowMaxOverlap)}`;
    }
    if (req.query.yellowMaxReversals !== undefined) {
      cmd += ` --yellow-max-reversals ${parseInt(req.query.yellowMaxReversals, 10)}`;
    }
    exec(cmd, { maxBuffer: 50 * 1024 * 1024 }, (error, stdout, stderr) => {
      if (error) {
        console.error('Backtester error:', error, stderr);
        return res.status(500).json({ error: 'Failed to run backtester', details: stderr || error.message });
      }
      try {
        const results = JSON.parse(stdout);
        res.json(results);
      } catch (parseError) {
        console.error('Failed to parse backtester JSON output:', stdout);
        res.status(500).json({ error: 'Failed to parse backtester output', details: parseError.message, stdout });
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Server error during backtest initiation', details: error.message });
  }
});

// Endpoint: Run Yellow Momentum 1:1 optimization
app.get('/api/charts/:name/optimize-yellow-momentum', (req, res) => {
  try {
    const chartName = req.params.name;
    const pythonScript = path.join(__dirname, '..', 'backend', 'backtester.py');
    let cmd = `python3 "${pythonScript}" --chart "${chartName}" --optimize-yellow-momentum`;
    if (req.query.startTime) {
      cmd += ` --start-time ${req.query.startTime}`;
    }
    if (req.query.endTime) {
      cmd += ` --end-time ${req.query.endTime}`;
    }
    
    exec(cmd, { maxBuffer: 50 * 1024 * 1024 }, (error, stdout, stderr) => {
      if (error) {
        console.error('Yellow Momentum optimizer error:', error, stderr);
        return res.status(500).json({ error: 'Failed to run Yellow Momentum optimizer', details: stderr || error.message });
      }
      try {
        const results = JSON.parse(stdout);
        res.json(results);
      } catch (parseError) {
       console.error('Failed to parse Yellow Momentum optimizer JSON output:', stdout);
        res.status(500).json({ error: 'Failed to parse Yellow Momentum optimizer output', details: parseError.message, stdout });
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Server error during Yellow Momentum optimization initiation', details: error.message });
  }
});

// Endpoint: Run backtester optimization
app.get('/api/charts/:name/optimize', (req, res) => {
  try {
    const chartName = req.params.name;
    const pythonScript = path.join(__dirname, '..', 'backend', 'backtester.py');
    const cmd = `python3 "${pythonScript}" --chart "${chartName}" --optimize`;
    
    exec(cmd, { maxBuffer: 50 * 1024 * 1024 }, (error, stdout, stderr) => {
      if (error) {
        console.error('Optimizer error:', error, stderr);
        return res.status(500).json({ error: 'Failed to run optimizer', details: stderr || error.message });
      }
      try {
        const results = JSON.parse(stdout);
        res.json(results);
      } catch (parseError) {
        console.error('Failed to parse optimizer JSON output:', stdout);
        res.status(500).json({ error: 'Failed to parse optimizer output', details: parseError.message, stdout });
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Server error during optimization initiation', details: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});