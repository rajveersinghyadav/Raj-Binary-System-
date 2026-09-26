class CryptoIDXCalculator {
    static compute(multiStreamData) {
        if (!multiStreamData) {
            return { signalText: "WAITING DATA", confidence: 0, sigClass: "WAITING", cardClass: "" };
        }

        const weights = { btc: 0.40, eth: 0.30, ltc: 0.15, zec: 0.15 };

        let combinedImbalance = 0;
        let combinedAggression = 0;
        let activeCount = 0;

        for (let coin in weights) {
            const data = multiStreamData[coin];
            if (data && data.bids.length > 0 && data.asks.length > 0) {
                // Depth Imbalance Calculation
                const bidsVol = data.bids.reduce((sum, item) => sum + (parseFloat(item[0]) * parseFloat(item[1])), 0);
                const asksVol = data.asks.reduce((sum, item) => sum + (parseFloat(item[0]) * parseFloat(item[1])), 0);
                const totalDepth = bidsVol + asksVol;
                const coinImbalance = totalDepth > 0 ? (bidsVol - asksVol) / totalDepth : 0;

                // Aggression Volume Calculation
                const totalTrade = data.buyVol + data.sellVol;
                const coinAggression = totalTrade > 0 ? (data.buyVol - data.sellVol) / totalTrade : 0;

                // Weighted Accumulation
                combinedImbalance += coinImbalance * weights[coin];
                combinedAggression += coinAggression * weights[coin];
                activeCount++;
            }
        }

        if (activeCount < 2) {
            return { signalText: "CONNECTING WEBSOCKETS...", confidence: 0, sigClass: "WAITING", cardClass: "" };
        }

        // Final Composite Score (40% Orderbook Depth + 60% Live Aggression Trades)
        const compositeScore = (combinedImbalance * 0.4) + (combinedAggression * 0.6);

        let signalText = "WAITING DATA / NEUTRAL";
        let sigClass = "WAITING";
        let cardClass = "";
        let confidence = 50;

        // Next Candle Prediction Rule
        if (compositeScore > 0.02) {
            signalText = "NEXT CANDLE: GREEN (BUY)";
            sigClass = "BUY";
            cardClass = "GREEN";
            confidence = Math.min(Math.round(70 + (Math.abs(compositeScore) * 60)), 99);
        } else if (compositeScore < -0.02) {
            signalText = "NEXT CANDLE: RED (SELL)";
            sigClass = "SELL";
            cardClass = "RED";
            confidence = Math.min(Math.round(70 + (Math.abs(compositeScore) * 60)), 99);
        }

        return {
            combinedImbalance: (combinedImbalance * 100).toFixed(2) + "%",
            combinedAggression: (combinedAggression * 100).toFixed(2) + "%",
            compositeScore: compositeScore.toFixed(4),
            signalText,
            confidence,
            sigClass,
            cardClass
        };
    }
}
