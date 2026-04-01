/**
 * Aggregate broker summary data dari multi-day responses
 * Menghitung total buy/sell lot, value, dan net per broker
 */

function aggregateBrokerData(rawData) {
  const brokerMap = new Map();

  // Helper untuk memproses baris data
  const processEntry = (entry, side) => {
    // Mapping field sesuai Exodus API (netbs_broker_code, blot, slot, bval, sval)
    const code = entry.netbs_broker_code || entry.broker_code || entry.code || entry.broker || '';
    if (!code) return;

    if (!brokerMap.has(code)) {
      brokerMap.set(code, {
        broker_code: code,
        buy_lot: 0, buy_val: 0, buy_count: 0,
        sell_lot: 0, sell_val: 0, sell_count: 0,
      });
    }

    const b = brokerMap.get(code);
    const lot = Math.abs(Number(entry.blot || entry.slot || entry.lot || entry.volume || 0));
    const val = Math.abs(Number(entry.bval || entry.sval || entry.val || entry.value || 0));

    if (side === 'buy') {
      b.buy_lot += lot;
      b.buy_val += val;
      b.buy_count += 1;
    } else {
      b.sell_lot += lot;
      b.sell_val += val;
      b.sell_count += 1;
    }
  };

  // Navigasi ke data inti
  const root = rawData?.data || rawData;
  const md = root?.broker_summary || root?.market_detector || root;

  // 1. Cek format brokers_buy/sell (Exodus)
  if (Array.isArray(md?.brokers_buy)) {
    md.brokers_buy.forEach(e => processEntry(e, 'buy'));
  }
  if (Array.isArray(md?.brokers_sell)) {
    md.brokers_sell.forEach(e => processEntry(e, 'sell'));
  }

  // 2. Cek format buy/sell (Legacy)
  if (Array.isArray(root?.buy)) {
    root.buy.forEach(e => processEntry(e, 'buy'));
  }
  if (Array.isArray(root?.sell)) {
    root.sell.forEach(e => processEntry(e, 'sell'));
  }

  // 3. Cek format Daily List (Array)
  if (Array.isArray(root)) {
    root.forEach(day => {
      const d = day?.data?.broker_summary || day?.data?.market_detector || day?.data || day;
      if (Array.isArray(d?.brokers_buy)) d.brokers_buy.forEach(e => processEntry(e, 'buy'));
      if (Array.isArray(d?.brokers_sell)) d.brokers_sell.forEach(e => processEntry(e, 'sell'));
      if (Array.isArray(d?.buy)) d.buy.forEach(e => processEntry(e, 'buy'));
      if (Array.isArray(d?.sell)) d.sell.forEach(e => processEntry(e, 'sell'));
    });
  }

  // Final mapping ke array
  const brokers = Array.from(brokerMap.values()).map(b => {
    const net_lot = b.buy_lot - b.sell_lot;
    const net_val = b.buy_val - b.sell_val;
    return {
      ...b,
      net_lot,
      net_val,
      buy_avg: b.buy_lot > 0 ? Math.round(b.buy_val / b.buy_lot) : 0,
      sell_avg: b.sell_lot > 0 ? Math.round(b.sell_val / b.sell_lot) : 0,
    };
  });

  // Urutan: Net Buyer terbesar di atas
  brokers.sort((a, b) => b.net_lot - a.net_lot);

  const summary = calculateSummary(brokers);
  return { brokers, summary };
}

function calculateSummary(brokers) {
  let totals = { bl: 0, bv: 0, sl: 0, sv: 0 };
  
  brokers.forEach(b => {
    totals.bl += b.buy_lot;
    totals.bv += b.buy_val;
    totals.sl += b.sell_lot;
    totals.sv += b.sell_val;
  });

  const netBuyers = brokers.filter(b => b.net_lot > 0);
  const netSellers = brokers.filter(b => b.net_lot < 0).sort((a, b) => a.net_lot - b.net_lot);

  const totalNetBVal = netBuyers.reduce((s, b) => s + b.net_val, 0);
  const totalNetSVal = Math.abs(netSellers.reduce((s, b) => s + b.net_val, 0));

  const getRatio = (list, count, total) => {
    if (total === 0 || list.length === 0) return 0;
    return list.slice(0, count).reduce((s, b) => s + Math.abs(b.net_val), 0) / total;
  };

  const buyerRatios = {
    top1: getRatio(netBuyers, 1, totalNetBVal),
    top3: getRatio(netBuyers, 3, totalNetBVal),
    top5: getRatio(netBuyers, 5, totalNetBVal),
  };

  const sellerRatios = {
    top1: getRatio(netSellers, 1, totalNetSVal),
    top3: getRatio(netSellers, 3, totalNetSVal),
    top5: getRatio(netSellers, 5, totalNetSVal),
  };

  let grade = 'NEUTRAL';
  if (buyerRatios.top3 > 0.6 || buyerRatios.top1 > 0.4) grade = 'BIG ACCUMULATION';
  else if (buyerRatios.top3 > 0.4 || buyerRatios.top1 > 0.2) grade = 'ACCUMULATION';
  else if (sellerRatios.top3 > 0.6 || sellerRatios.top1 > 0.4) grade = 'BIG DISTRIBUTION';
  else if (sellerRatios.top3 > 0.4 || sellerRatios.top1 > 0.2) grade = 'DISTRIBUTION';

  return {
    total_buy_lot: totals.bl,
    total_buy_val: totals.bv,
    total_sell_lot: totals.sl,
    total_sell_val: totals.sv,
    net_lot: totals.bl - totals.sl,
    net_val: totals.bv - totals.sv,
    total_brokers: brokers.length,
    net_buyer_count: netBuyers.length,
    net_seller_count: netSellers.length,
    top_buyer: netBuyers[0] || null,
    top_seller: netSellers[0] || null,
    top_5_buyers: netBuyers.slice(0, 5),
    top_5_sellers: netSellers.slice(0, 5),
    analysis: { grade, buyer_ratios: buyerRatios, seller_ratios: sellerRatios }
  };
}

function aggregateDailyData(dailyResults) {
  return dailyResults
    .filter(d => d.data && !d.error)
    .map(d => ({ date: d.date, ...aggregateBrokerData(d.data) }));
}

module.exports = { aggregateBrokerData, aggregateDailyData, calculateSummary };
