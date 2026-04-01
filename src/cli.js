require('dotenv').config();
const { StockbitAuth } = require('./auth');
const { fetchBrokerSummary, validateDateRange } = require('./brokerSummary');
const { aggregateBrokerData } = require('./aggregator');

/**
 * CLI Tool to display Broker Summary in terminal
 * Usage: node src/cli.js <SYMBOL> <START_DATE> <END_DATE> [--json]
 * Example: node src/cli.js BBCA 2026-03-01 2026-03-31 --json
 */

async function main() {
  const args = process.argv.slice(2);
  // Ambil argumen non-flag
  const regularArgs = args.filter(a => !a.startsWith('--'));
  
  const symbol = regularArgs[0];
  const startDate = regularArgs[1];
  const endDate = regularArgs[2] || startDate; // Fallback ke startDate jika tidak ada endDate
  const isJson = args.includes('--json');

  if (!symbol || !startDate) {
    console.log('❌ Penggunaan: npm run cli -- <SYMBOL> <START_DATE> [END_DATE]');
    console.log('Contoh (1 Hari): npm run cli -- BBCA 2026-03-31');
    console.log('Contoh (Range) : npm run cli -- BBCA 2026-03-01 2026-03-31');
    process.exit(1);
  }

  const auth = new StockbitAuth();

  try {
    const username = process.env.STOCKBIT_USERNAME;
    const password = process.env.STOCKBIT_PASSWORD;
    const playerId = process.env.STOCKBIT_PLAYER_ID;

    if (username && password) {
      if (!isJson) console.log('🔄 Sedang login ke Stockbit...');
      await auth.ensureAuthenticated(username, password, playerId);
      if (!isJson) console.log('✅ Login berhasil!');
    } else {
      await auth.ensureAuthenticated();
    }

    // 2. Validate range
    validateDateRange(startDate, endDate);

    // 3. Fetch
    if (!isJson) console.log(`📡 Mengambil data ${symbol} dari ${startDate} sampai ${endDate}...`);
    const { fetchMarketDetector } = require('./brokerSummary');
    const rawData = await fetchMarketDetector(auth, symbol, startDate, endDate);

    // 4. Aggregate
    const { brokers, summary } = aggregateBrokerData(rawData);

    // 5. Output JSON if requested
    if (isJson) {
      console.log(JSON.stringify({
        symbol: symbol.toUpperCase(),
        start_date: startDate,
        end_date: endDate,
        summary,
        brokers
      }, null, 2));
      return;
    }

    // 6. Display Summary (Terminal Report)
    const analysis = summary.analysis;
    const gradeColor = analysis.grade.includes('ACC') ? '🟢' : (analysis.grade.includes('DIST') ? '🔴' : '⚪');

    console.log('\n' + '='.repeat(60));
    console.log(`📊 BROKER SUMMARY: ${symbol.toUpperCase()}`);
    console.log(`📅 Periode: ${startDate} s/d ${endDate}`);
    console.log(`🔍 Analisis: ${gradeColor} ${analysis.grade}`);
    console.log('='.repeat(60));
    console.log(`Total Buy Value : Rp ${summary.total_buy_val.toLocaleString('id-ID')}`);
    console.log(`Total Sell Value: Rp ${summary.total_sell_val.toLocaleString('id-ID')}`);
    console.log(`Net Value       : Rp ${summary.net_val.toLocaleString('id-ID')} (${summary.net_val >= 0 ? '+' : ''})`);
    console.log(`Total Brokers   : ${summary.total_brokers} (Buyer: ${summary.net_buyer_count}, Seller: ${summary.net_seller_count})`);
    console.log('-'.repeat(60));
    console.log(`Dominasi Buyer  : Top1: ${(analysis.buyer_ratios.top1 * 100).toFixed(1)}% | Top3: ${(analysis.buyer_ratios.top3 * 100).toFixed(1)}% | Top5: ${(analysis.buyer_ratios.top5 * 100).toFixed(1)}%`);
    console.log(`Dominasi Seller : Top1: ${(analysis.seller_ratios.top1 * 100).toFixed(1)}% | Top3: ${(analysis.seller_ratios.top3 * 100).toFixed(1)}% | Top5: ${(analysis.seller_ratios.top5 * 100).toFixed(1)}%`);
    console.log('-'.repeat(60));

    // 6. Optional: Daily Breakdown
    const diff = Math.ceil((new Date(endDate) - new Date(startDate)) / (1000 * 60 * 60 * 24));
    if (diff > 1) {
      console.log('\n📅 DAILY BREAKDOWN (Net Value):');
      const { fetchBrokerSummaryDaily } = require('./brokerSummary');
      const { aggregateDailyData } = require('./aggregator');
      
      console.log('🔄 Fetching daily data (this may take a moment)...');
      const dailyResults = await fetchBrokerSummaryDaily(auth, symbol, startDate, endDate);
      const dailyAggregated = aggregateDailyData(dailyResults);
      
      console.log('DATE       | Net Value      | Grade');
      console.log('-'.repeat(40));
      dailyAggregated.forEach(d => {
        const gLimit = d.summary.analysis.grade.split(' ')[0];
        console.log(`${d.date} | ${d.summary.net_val.toLocaleString('id-ID').padStart(14)} | ${gLimit}`);
      });
      console.log('-'.repeat(40));
    }

    // 7. Display Top 10 Brokers
    console.log('\n🏆 TOP BROKERS (by Net Value):');
    console.log('CODE | Side | Net Lot      | Net Value      | Avg');
    console.log('-'.repeat(60));

    const topBrokers = brokers.slice(0, 10);
    // Add bottom sellers if needed
    const bottomSellers = brokers.slice(-5).reverse();

    function formatBroker(b) {
      const side = b.net_val >= 0 ? 'BUY ' : 'SELL';
      const sideColor = b.net_val >= 0 ? '+' : '';
      return `${b.broker_code.padEnd(4)} | ${side} | ${b.net_lot.toLocaleString('id-ID').padStart(12)} | ${b.net_val.toLocaleString('id-ID').padStart(14)} | ${b.buy_avg || b.sell_avg}`;
    }

    topBrokers.filter(b => b.net_val > 0).forEach(b => console.log(formatBroker(b)));
    console.log('...');
    bottomSellers.filter(b => b.net_val < 0).forEach(b => console.log(formatBroker(b)));

    console.log('='.repeat(60) + '\n');

  } catch (err) {
    console.error('\n❌ Error:', err.message);
    process.exit(1);
  }
}

main();
