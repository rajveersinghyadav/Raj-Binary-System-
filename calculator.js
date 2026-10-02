class CryptoIDXCalculator {
    static compute(multiStreamData) {
        if (!multiStreamData) {
            return this.getEmptyState("WAITING STREAM DATA");
        }

        const weights = {
            btc: 0.40,
            eth: 0.30,
            ltc: 0.15,
            zec: 0.15
        };

        let totalWeightedBuyCount = 0;
        let totalWeightedSellCount = 0;
        let totalWeightedBuyVol = 0;
        let totalWeightedSellVol = 0;
        let totalWeightedDepthBids = 0;
        let totalWeightedDepthAsks = 0;
        let activeCoinsCount = 0;

        for (let coin in weights) {
            const data = multiStreamData[coin];
            
            if (data && (data.buyCount > 0 || data.sellCount > 0)) {
                activeCoinsCount++;

                // Executed Trades Stats
                totalWeightedBuyCount += (data.buyCount || 0) * weights[coin];
                totalWeightedSellCount += (data.sellCount || 0) * weights[coin];

                totalWeightedBuyVol += (data.buyVol || 0) * weights[coin];
                totalWeightedSellVol += (data.sellVol || 0) * weights[coin];

                // Order Book Depth Stats (if available in stream data)
                totalWeightedDepthBids += (data.depthBids || data.buyVol || 0) * weights[coin];
                totalWeightedDepthAsks += (data.depthAsks || data.sellVol || 0) * weights[coin];
            }
        }

        if (activeCoinsCount < 2) {
            return this.getEmptyState("ACCUMULATING HYBRID DATA...");
        }

        // 1. EXECUTED TRADES SPEED & VOLUME SCORE (-1.0 to +1.0)
        const totalTradesCount = totalWeightedBuyCount + totalWeightedSellCount;
        const traderRatio = totalTradesCount > 0 ? (totalWeightedBuyCount - totalWeightedSellCount) / totalTradesCount : 0;

        const totalTradeVol = totalWeightedBuyVol + totalWeightedSellVol;
        const volumeRatio = totalTradeVol > 0 ? (totalWeightedBuyVol - totalWeightedSellVol) / totalTradeVol : 0;

        const executedMomentum = (traderRatio * 0.60) + (volumeRatio * 0.40);

        // 2. ORDER BOOK DEPTH IMBALANCE SCORE (-1.0 to +1.0)
        const totalDepth = totalWeightedDepthBids + totalWeightedDepthAsks;
        const depthImbalance = totalDepth > 0 ? (totalWeightedDepthBids - totalWeightedDepthAsks) / totalDepth : 0;

        // 3. MERGED HYBRID SCORE (60% Executed Tape + 40% Order Book Depth)
        const hybridScore = (executedMomentum * 0.60) + (depthImbalance * 0.40);

        let signalText = "NEUTRAL / NO ENTRY";
        let sigClass = "WAITING";
        let cardClass = "";
        let confidence = 50;

        // Strict Filters for Strong Signal
        if (hybridScore >= 0.12) {
            signalText = "NEXT CANDLE: CALL (BUY)";
            sigClass = "BUY";
            cardClass = "GREEN";
            confidence = Math.min(99, Math.round(80 + (hybridScore * 40)));
        } else if (hybridScore <= -0.12) {
            signalText = "NEXT CANDLE: PUT (SELL)";
            sigClass = "SELL";
            cardClass = "RED";
            confidence = Math.min(99, Math.round(80 + (Math.abs(hybridScore) * 40)));
        }

        return {
            imbalance: traderRatio,
            aggressionRatio: volumeRatio,
            depthImbalance: depthImbalance,
            compositeScore: hybridScore,
            totalBids: totalWeightedBuyCount,
            totalAsks: totalWeightedSellCount,
            buyVol: totalWeightedBuyVol,
            sellVol: totalWeightedSellVol,
            buyerAggressive: hybridScore >= 0.12,
            sellerAggressive: hybridScore <= -0.12,
            signalText: signalText,
            confidence: confidence,
            sigClass: sigClass,
            cardClass: cardClass
        };
    }

    static getEmptyState(msg) {
        return {
            signalText: msg,
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
}
