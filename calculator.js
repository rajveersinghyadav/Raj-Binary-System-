// Dual-Filter Combination Signal Engine (Imbalance + Aggression)
class SignalCalculator {
    static compute(depthData) {
        if (!depthData || !depthData.bids || !depthData.asks) {
            return { imbalance: 0, aggressionRatio: 0, buyerAggressive: false, sellerAggressive: false, confidence: 0, signalText: "WAITING DATA", cardClass: "", sigClass: "WAITING", totalBids: 0, totalAsks: 0 };
        }

        // 1. Orderbook Depth Imbalance
        const binanceBidsVol = depthData.bids.reduce((sum, item) => sum + (parseFloat(item[0]) * parseFloat(item[1])), 0);
        const binanceAsksVol = depthData.asks.reduce((sum, item) => sum + (parseFloat(item[0]) * parseFloat(item[1])), 0);

        const totalBids = binanceBidsVol + depthData.yahooBidsWeight;
        const totalAsks = binanceAsksVol + depthData.yahooAsksWeight;
        const totalVolume = totalBids + totalAsks;

        const imbalance = totalVolume > 0 ? (totalBids - totalAsks) / totalVolume : 0;

        // 2. Buyer vs Seller Aggression Calculation
        const totalMarketVol = depthData.buyMarketVol + depthData.sellMarketVol;
        let aggressionRatio = 0;
        if (totalMarketVol > 0) {
            aggressionRatio = (depthData.buyMarketVol - depthData.sellMarketVol) / totalMarketVol;
        }

        const buyerAggressive = aggressionRatio > 0.08;
        const sellerAggressive = aggressionRatio < -0.08;

        // 3. COMBINATION SIGNAL GENERATION
        let signalText = "LEAN NEUTRAL";
        let cardClass = "";
        let sigClass = "WAITING";
        let confidence = 50;

        // Both Imbalance AND Trade Aggression must agree
        if (imbalance > 0.03 && buyerAggressive) {
            signalText = "NEXT CANDLE: GREEN (BUY)";
            sigClass = "BUY";
            cardClass = "GREEN";
            confidence = Math.min(Math.round(65 + (Math.abs(imbalance + aggressionRatio) * 30)), 99);
        } else if (imbalance < -0.03 && sellerAggressive) {
            signalText = "NEXT CANDLE: RED (SELL)";
            sigClass = "SELL";
            cardClass = "RED";
            confidence = Math.min(Math.round(65 + (Math.abs(imbalance + aggressionRatio) * 30)), 99);
        } else if (imbalance > 0.04) {
            signalText = "LEAN BUY (WEAK AGGRESSION)";
            sigClass = "BUY";
            confidence = 58;
        } else if (imbalance < -0.04) {
            signalText = "LEAN SELL (WEAK AGGRESSION)";
            sigClass = "SELL";
            confidence = 58;
        }

        return {
            imbalance,
            aggressionRatio,
            buyerAggressive,
            sellerAggressive,
            buyVol: depthData.buyMarketVol,
            sellVol: depthData.sellMarketVol,
            confidence,
            signalText,
            cardClass,
            sigClass,
            totalBids,
            totalAsks
        };
    }
}
