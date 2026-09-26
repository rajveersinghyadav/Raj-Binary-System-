class CryptoIDXCalculator {
    static compute(multiStreamData) {
        if (!multiStreamData) {
            return {
                signalText: "WAITING DATA",
                confidence: 0,
                sigClass: "WAITING",
                cardClass: "",
                buyerAggressive: false,
                sellerAggressive: false,
                buyVol: 0,
                sellVol: 0,
                aggressionRatio: 0,
                imbalance: 0,
                totalBids: 0,
                totalAsks: 0
            };
        }

        // Exact Binomo Crypto IDX Weightage Matrix
        const weights = {
            btc: 0.40,
            eth: 0.30,
            ltc: 0.15,
            zec: 0.15
        };

        let weightedTotalBids = 0;
        let weightedTotalAsks = 0;
        let weightedBuyVol = 0;
        let weightedSellVol = 0;
        let activeStreams = 0;

        // 1. ALL 4 ORDERBOOKS (BTC, ETH, LTC, ZEC) MERGED CALCULATION
        for (let coin in weights) {
            const data = multiStreamData[coin];
            if (data && data.bids && data.asks && data.bids.length > 0 && data.asks.length > 0) {
                // Individual Coin Bids & Asks Vol Calculation (Price * Qty)
                const coinBids = data.bids.reduce((sum, item) => sum + (parseFloat(item[0]) * parseFloat(item[1])), 0);
                const coinAsks = data.asks.reduce((sum, item) => sum + (parseFloat(item[0]) * parseFloat(item[1])), 0);

                // Multiply with Weightage Factor
                weightedTotalBids += coinBids * weights[coin];
                weightedTotalAsks += coinAsks * weights[coin];

                // Aggression Trade Volumes with Weightage
                weightedBuyVol += (data.buyVol || 0) * weights[coin];
                weightedSellVol += (data.sellVol || 0) * weights[coin];

                activeStreams++;
            }
        }

        if (activeStreams < 2) {
            return {
                signalText: "SYNCING 4 STREAMS...",
                confidence: 0,
                sigClass: "WAITING",
                cardClass: "",
                buyerAggressive: false,
                sellerAggressive: false,
                buyVol: 0,
                sellVol: 0,
                aggressionRatio: 0,
                imbalance: 0,
                totalBids: 0,
                totalAsks: 0
            };
        }

        // 2. COMBINED 4-ASSET NET IMBALANCE CALCULATION
        const grandTotalDepth = weightedTotalBids + weightedTotalAsks;
        const combinedImbalance = grandTotalDepth > 0 ? (weightedTotalBids - weightedTotalAsks) / grandTotalDepth : 0;

        // 3. COMBINED 4-ASSET AGGRESSION RATIO CALCULATION
        const grandTotalTrades = weightedBuyVol + weightedSellVol;
        const combinedAggression = grandTotalTrades > 0 ? (weightedBuyVol - weightedSellVol) / grandTotalTrades : 0;

        // 4. COMPOSITE INDEX SCORE (40% Orderbooks Imbalance + 60% Trades Aggression)
        const compositeScore = (combinedImbalance * 0.4) + (combinedAggression * 0.6);

        let signalText = "WAITING / NEUTRAL";
        let sigClass = "WAITING";
        let cardClass = "";
        let confidence = 50;

        let buyerAggressive = combinedAggression > 0.05;
        let sellerAggressive = combinedAggression < -0.05;

        // 5. NEXT CANDLE PREDICTION RULES
        if (compositeScore > 0.015 && combinedImbalance > 0) {
            signalText = "NEXT CANDLE: GREEN (BUY)";
            sigClass = "BUY";
            cardClass = "GREEN";
            confidence = Math.min(Math.round(70 + (Math.abs(compositeScore) * 80)), 98);
        } else if (compositeScore < -0.015 && combinedImbalance < 0) {
            signalText = "NEXT CANDLE: RED (SELL)";
            sigClass = "SELL";
            cardClass = "RED";
            confidence = Math.min(Math.round(70 + (Math.abs(compositeScore) * 80)), 98);
        }

        return {
            imbalance: combinedImbalance,
            aggressionRatio: combinedAggression,
            compositeScore: compositeScore,
            totalBids: weightedTotalBids,
            totalAsks: weightedTotalAsks,
            buyVol: weightedBuyVol,
            sellVol: weightedSellVol,
            buyerAggressive,
            sellerAggressive,
            signalText,
            confidence,
            sigClass,
            cardClass
        };
    }
}
