// Order Book Imbalance & Signal Calculation Engine
class SignalCalculator {
    static compute(depthData) {
        if (!depthData || !depthData.bids || !depthData.asks) {
            return { imbalance: 0, confidence: 0, signalText: "WAITING DATA", cardClass: "", sigClass: "WAITING", totalBids: 0, totalAsks: 0 };
        }

        // Real Volume Calculation from Live Stream
        const totalBids = depthData.bids.reduce((sum, item) => sum + (parseFloat(item[0]) * parseFloat(item[1])), 0) + (depthData.buyTicks * 300);
        const totalAsks = depthData.asks.reduce((sum, item) => sum + (parseFloat(item[0]) * parseFloat(item[1])), 0) + (depthData.sellTicks * 300);
        const totalVolume = totalBids + totalAsks;

        if (totalVolume === 0) {
            return { imbalance: 0, confidence: 50, signalText: "LEAN NEUTRAL", cardClass: "", sigClass: "WAITING", totalBids: 0, totalAsks: 0 };
        }

        // Imbalance Ratio (-1.000 to +1.000)
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
