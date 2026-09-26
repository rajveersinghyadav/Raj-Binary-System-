// Dual-Exchange Orderbook Calculation Engine
class SignalCalculator {
    static compute(depthData) {
        if (!depthData || !depthData.bids || !depthData.asks) {
            return { imbalance: 0, confidence: 0, signalText: "WAITING DATA", cardClass: "", sigClass: "WAITING", totalBids: 0, totalAsks: 0 };
        }

        // 1. Binance Buyer & Seller Volume Calculation
        const binanceBidsVol = depthData.bids.reduce((sum, item) => sum + (parseFloat(item[0]) * parseFloat(item[1])), 0);
        const binanceAsksVol = depthData.asks.reduce((sum, item) => sum + (parseFloat(item[0]) * parseFloat(item[1])), 0);

        // 2. Merged Total Buyer & Seller Volume (Binance + Yahoo Interbank Weights)
        const totalBids = binanceBidsVol + depthData.yahooBidsWeight + (depthData.buyTicks * 300);
        const totalAsks = binanceAsksVol + depthData.yahooAsksWeight + (depthData.sellTicks * 300);
        
        const totalVolume = totalBids + totalAsks;

        if (totalVolume === 0) {
            return { imbalance: 0, confidence: 50, signalText: "LEAN NEUTRAL", cardClass: "", sigClass: "WAITING", totalBids: 0, totalAsks: 0 };
        }

        // Imbalance Formula
        const imbalance = (totalBids - totalAsks) / totalVolume;
        const confidence = Math.min(Math.round(52 + (Math.abs(imbalance) * 48)), 99);

        let signalText = "LEAN NEUTRAL";
        let cardClass = "";
        let sigClass = "WAITING";

        if (imbalance > 0.04) {
            signalText = "NEXT CANDLE: GREEN (BUY)";
            sigClass = "BUY";
            cardClass = "GREEN";
        } else if (imbalance < -0.04) {
            signalText = "NEXT CANDLE: RED (SELL)";
            sigClass = "SELL";
            cardClass = "RED";
        }

        return {
            imbalance,
            confidence,
            signalText,
            cardClass,
            sigClass,
            totalBids,
            totalAsks
        };
    }
}
