const fetch = require('node-fetch');
const { STOCKBIT_API, EXODUS_API } = require('./auth');

/**
 * Delay helper
 */
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Format date to YYYY-MM-DD
 */
function formatDate(date) {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Fetch broker summary dari Exodus Market Detector API (Sesuai browser)
 */
async function fetchMarketDetector(auth, symbol, fromDate, toDate) {
  const headers = await auth.getHeaders();
  
  const url = `${EXODUS_API}/marketdetectors/${symbol.toUpperCase()}?from=${fromDate}&to=${toDate}&transaction_type=TRANSACTION_TYPE_NET&market_board=MARKET_BOARD_REGULER&investor_type=INVESTOR_TYPE_ALL&limit=100`;

  console.log(`📡 Fetching market detector: ${symbol} (${fromDate} → ${toDate})`);
  const res = await fetch(url, { headers });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Gagal fetch market detector (${res.status}): ${body}`);
  }

  const json = await res.json();
  
  // Mencari data secara rekursif (bisa di data.broker_summary, data.market_detector, atau langsung di data)
  const data = json.data || json;
  const md = data.broker_summary || data.market_detector || data;
  const buy = md.brokers_buy || md.buy || [];
  const sell = md.brokers_sell || md.sell || [];

  if (!Array.isArray(buy) || !Array.isArray(sell) || (buy.length === 0 && sell.length === 0)) {
    console.warn(`⚠️  Stockbit memberikan response kosong untuk ${symbol}.`);
    // console.log('MD Keys:', md ? Object.keys(md) : 'md is null');
  }

  return json;
}

/**
 * Fetch broker summary dari Stockbit API (Legacy)
 */
async function fetchBrokerSummary(auth, symbol, fromDate, toDate) {
  const headers = await auth.getHeaders();
  const url = `${STOCKBIT_API}/v2/insider/broker-summary/?symbol=${encodeURIComponent(symbol.toUpperCase())}&from_date=${fromDate}&to_date=${toDate}`;

  console.log(`📡 Fetching broker summary: ${symbol} (${fromDate} → ${toDate})`);
  const res = await fetch(url, { headers });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Gagal fetch broker summary (${res.status}): ${body}`);
  }

  const json = await res.json();
  return json;
}

/**
 * Fetch broker summary per hari dalam range
 */
async function fetchBrokerSummaryDaily(auth, symbol, fromDate, toDate, delayMs = 1500) {
  const start = new Date(fromDate);
  const end = new Date(toDate);
  const results = [];

  let current = new Date(start);
  while (current <= end) {
    const dayOfWeek = current.getDay();
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      const dateStr = formatDate(current);
      try {
        const data = await fetchBrokerSummary(auth, symbol, dateStr, dateStr);
        results.push({ date: dateStr, data: data });
      } catch (err) {
        console.warn(`⚠️  Error untuk ${dateStr}: ${err.message}`);
        results.push({ date: dateStr, data: null, error: err.message });
      }
      if (delayMs > 0) await delay(delayMs);
    }
    current.setDate(current.getDate() + 1);
  }

  return results;
}

/**
 * Validate date range (max 3 months)
 */
function validateDateRange(fromDate, toDate) {
  const start = new Date(fromDate);
  const end = new Date(toDate);
  if (isNaN(start.getTime()) || isNaN(end.getTime())) throw new Error('Format tanggal tidak valid');
  if (start > end) throw new Error('Tanggal mulai harus sebelum tanggal akhir');
  const diffDays = Math.ceil((end - start) / (1000 * 60 * 60 * 24));
  if (diffDays > 92) throw new Error('Rentang waktu maksimal 3 bulan');
  return { start, end, diffDays };
}

module.exports = {
  fetchBrokerSummary,
  fetchMarketDetector,
  fetchBrokerSummaryDaily,
  validateDateRange,
  formatDate,
};
