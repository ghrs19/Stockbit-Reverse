const fetch = require('node-fetch');

/**
 * Valid Investor Types
 */
const VALID_INVESTOR_TYPES = [
  'INVESTOR_TYPE_ALL',
  'INVESTOR_TYPE_DOMESTIC',
  'INVESTOR_TYPE_FOREIGN'
];

/**
 * Valid Market Boards
 */
const VALID_MARKET_BOARDS = [
  'BOARD_TYPE_ALL',
  'BOARD_TYPE_REGULAR',
  'BOARD_TYPE_CASH',
  'BOARD_TYPE_NEGOTIATION'
];

/**
 * Fetch Broker Flow Chart dari Stockbit API
 * Endpoint: /order-trade/running-trade/chart/{symbol}?from={fromDate}&to={toDate}&investor_type={investorType}&market_board={marketBoard}
 * 
 * @param {StockbitAuth} auth - Instance valid dari auth manager
 * @param {string} symbol - Kode saham, misal: 'MSTI'
 * @param {string} fromDate - Tanggal awal YYYY-MM-DD
 * @param {string} toDate - Tanggal akhir YYYY-MM-DD
 * @param {string} investorType - (Opsional) Filter tipe investor
 * @param {string} marketBoard - (Opsional) Filter tipe board
 */
async function fetchBrokerFlowChart(
  auth, 
  symbol, 
  fromDate, 
  toDate, 
  investorType = 'INVESTOR_TYPE_ALL', 
  marketBoard = 'BOARD_TYPE_REGULAR'
) {
  // Validasi Enumerasi
  if (!VALID_INVESTOR_TYPES.includes(investorType)) {
    throw new Error(`Tipe investor tidak valid. Pilih salah satu: ${VALID_INVESTOR_TYPES.join(', ')}`);
  }
  if (!VALID_MARKET_BOARDS.includes(marketBoard)) {
    throw new Error(`Tipe market board tidak valid. Pilih salah satu: ${VALID_MARKET_BOARDS.join(', ')}`);
  }

  const headers = await auth.getHeaders();
  
  // URL Endpoint persis seperti yang direquest dari Network Browser
  const url = `https://exodus.stockbit.com/order-trade/running-trade/chart/${symbol.toUpperCase()}?from=${fromDate}&to=${toDate}&investor_type=${investorType}&market_board=${marketBoard}`;

  console.log(`📡 Fetching broker flow chart: ${symbol} (${fromDate} → ${toDate})`);
  
  const res = await fetch(url, { headers });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Gagal fetch broker flow chart (${res.status}): ${body}`);
  }

  const json = await res.json();
  return json;
}

module.exports = {
  fetchBrokerFlowChart,
  VALID_INVESTOR_TYPES,
  VALID_MARKET_BOARDS
};
