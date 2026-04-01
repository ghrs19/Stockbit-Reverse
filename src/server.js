require('dotenv').config();

const express = require('express');
const cors = require('cors');
const path = require('path');
const { StockbitAuth } = require('./auth');
const { fetchBrokerSummary, validateDateRange } = require('./brokerSummary');
const { aggregateBrokerData } = require('./aggregator');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

// Auth instance
const auth = new StockbitAuth();

// ─── Health Check ───────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    authenticated: auth.isAuthenticated,
    timestamp: new Date().toISOString(),
  });
});

// ─── Login ──────────────────────────────────────────────────────
app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    await auth.login(username, password);
    res.json({ success: true, message: 'Login berhasil' });
  } catch (err) {
    res.status(401).json({ error: err.message });
  }
});

// ─── Set Token Manually ─────────────────────────────────────────
app.post('/api/auth/token', (req, res) => {
  const { token } = req.body;
  if (!token) {
    return res.status(400).json({ error: 'Token diperlukan' });
  }
  auth.setToken(token);
  res.json({ success: true, message: 'Token berhasil di-set' });
});

// ─── Auth Status ────────────────────────────────────────────────
app.get('/api/auth/status', (req, res) => {
  res.json({ authenticated: auth.isAuthenticated });
});

// ─── Broker Summary (Aggregated) ────────────────────────────────
app.get('/api/broker-summary', async (req, res) => {
  try {
    const { symbol, date } = req.query;
    let { startDate, endDate } = req.query;

    if (!symbol) {
      return res.status(400).json({ error: 'Parameter "symbol" diperlukan' });
    }

    // Dukung parameter tunggal `date` untuk request 1-hari
    if (date && !startDate && !endDate) {
      startDate = date;
      endDate = date;
    }

    if (!startDate || !endDate) {
      return res.status(400).json({ error: 'Gunakan parameter "date" ATAU "startDate" & "endDate"' });
    }

    // Validate date range
    validateDateRange(startDate, endDate);

    // Fetch from Stockbit Market Detector (Exodus API, matched with browser)
    const { fetchMarketDetector } = require('./brokerSummary');
    const rawData = await fetchMarketDetector(auth, symbol, startDate, endDate);

    // Mengembalikan JSON sumber dari Stockbit apa adanya (tanpa agregasi)
    res.json(rawData);
  } catch (err) {
    console.error('❌ Error:', err.message);
    res.status(err.message.includes('401') ? 401 : 500).json({ error: err.message });
  }
});

// ─── Broker Flow Chart (Raw JSON) ───────────────────────────────
app.get('/api/broker-flow-chart', async (req, res) => {
  try {
    const { symbol, date, investorType, marketBoard } = req.query;
    let { startDate, endDate } = req.query;

    if (!symbol) {
      return res.status(400).json({ error: 'Parameter "symbol" diperlukan' });
    }

    if (date && !startDate && !endDate) {
      startDate = date;
      endDate = date;
    }

    if (!startDate || !endDate) {
      return res.status(400).json({ error: 'Gunakan parameter "date" ATAU "startDate" & "endDate"' });
    }

    // Validate date range
    validateDateRange(startDate, endDate);

    // Default values if not specified (according to user specs)
    const iType = investorType || 'INVESTOR_TYPE_ALL';
    const mBoard = marketBoard || 'BOARD_TYPE_REGULAR';

    const { fetchBrokerFlowChart } = require('./brokerFlowChart');
    const rawData = await fetchBrokerFlowChart(auth, symbol, startDate, endDate, iType, mBoard);

    res.json(rawData);
  } catch (err) {
    console.error('❌ Error Broker Flow Chart:', err.message);
    res.status(err.message.includes('401') ? 401 : 500).json({ error: err.message });
  }
});

// ─── Serve index.html for root ──────────────────────────────────
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

// ─── Start Server ───────────────────────────────────────────────
app.listen(PORT, async () => {
  console.log('');
  console.log('╔══════════════════════════════════════════════════╗');
  console.log('║   📊 Stockbit Broker Summary Viewer             ║');
  console.log(`║   🌐 http://localhost:${PORT}                       ║`);
  console.log('║                                                  ║');

  // Auto-login on startup
  const username = process.env.STOCKBIT_USERNAME;
  const password = process.env.STOCKBIT_PASSWORD;
  const playerId = process.env.STOCKBIT_PLAYER_ID;

  try {
    await auth.ensureAuthenticated(username, password, playerId);
    console.log('║   ✅ Autentikasi Berhasil!                      ║');
  } catch (err) {
    console.log('║   ❌ Autentikasi Gagal:                         ║');
    console.log(`║      ${err.message.substring(0, 40).padEnd(41)} ║`);
  }

  console.log('╚══════════════════════════════════════════════════╝');
  console.log('');
});
