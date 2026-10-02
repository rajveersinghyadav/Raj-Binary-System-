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
        let activeCoinsCount = 0;

        for (let coin in weights) {
            const data = multiStreamData[coin];
            
            if (data && (data.buyCount > 0 || data.sellCount > 0)) {
                activeCoinsCount++;

                totalWeightedBuyCount += (data.buyCount || 0) * weights[coin];
                totalWeightedSellCount += (data.sellCount || 0) * weights[coin];

                totalWeightedBuyVol += (data.buyVol || 0) * weights[coin];
                totalWeightedSellVol += (data.sellVol || 0) * weights[coin];
            }
        }

        if (activeCoinsCount < 2) {
            return this.getEmptyState("ACCUMULATING SPEED DATA...");
        }

        // 1. TRADER COUNT SPEED DELTA (-1.0 to +1.0)
        const totalTradesCount = totalWeightedBuyCount + totalWeightedSellCount;
        const traderRatio = totalTradesCount > 0 ? (totalWeightedBuyCount - totalWeightedSellCount) / totalTradesCount : 0;

        // 2. EXECUTED VOLUME DELTA (-1.0 to +1.0)
        const totalTradeVol = totalWeightedBuyVol + totalWeightedSellVol;
        const volumeRatio = totalTradeVol > 0 ? (totalWeightedBuyVol - totalWeightedSellVol) / totalTradeVol : 0;

        // 3. COMBINED MOMENTUM SCORE (60% Speed + 40% Volume)
        const compositeScore = (traderRatio * 0.60) + (volumeRatio * 0.40);

        let signalText = "NEUTRAL / NO ENTRY";
        let sigClass = "WAITING";
        let cardClass = "";
        let confidence = 50;

        const isStrongBuy = (compositeScore >= 0.15);
        const isStrongSell = (compositeScore <= -0.15);

        if (isStrongBuy) {
            signalText = "NEXT CANDLE: CALL (BUY)";
            sigClass = "BUY";
            cardClass = "GREEN";
            confidence = Math.min(99, Math.round(80 + (compositeScore * 35)));
        } else if (isStrongSell) {
            signalText = "NEXT CANDLE: PUT (SELL)";
            sigClass = "SELL";
            cardClass = "RED";
            confidence = Math.min(99, Math.round(80 + (Math.abs(compositeScore) * 35)));
        }

        return {
            imbalance: traderRatio,
            aggressionRatio: volumeRatio,
            compositeScore: compositeScore,
            totalBids: totalWeightedBuyCount,
            totalAsks: totalWeightedSellCount,
            buyVol: totalWeightedBuyVol,
            sellVol: totalWeightedSellVol,
            buyerAggressive: compositeScore > 0.15,
            sellerAggressive: compositeScore < -0.15,
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

class SignalCalculator {
    static compute(data, isForex) {
        if (!data) return CryptoIDXCalculator.getEmptyState("NO TRADE STREAM");

        const buyCount = data.buyCount || 0;
        const sellCount = data.sellCount || 0;
        const buyVol = data.buyVol || 0;
        const sellVol = data.sellVol || 0;

        const totalTrades = buyCount + sellCount;
        const traderRatio = totalTrades > 0 ? (buyCount - sellCount) / totalTrades : 0;

        const totalVol = buyVol + sellVol;
        const volRatio = totalVol > 0 ? (buyVol - sellVol) / totalVol : 0;

        const score = (traderRatio * 0.6) + (volRatio * 0.4);

        let signalText = "NEUTRAL / NO ENTRY";
        let sigClass = "WAITING";
        let cardClass = "";
        let confidence = 50;

        if (score >= 0.15) {
            signalText = "NEXT CANDLE: CALL (BUY)";
            sigClass = "BUY";
            cardClass = "GREEN";
            confidence = Math.min(99, Math.round(80 + (score * 35)));
        } else if (score <= -0.15) {
            signalText = "NEXT CANDLE: PUT (SELL)";
            sigClass = "SELL";
            cardClass = "RED";
            confidence = Math.min(99, Math.round(80 + (Math.abs(score) * 35)));
        }

        return {
            imbalance: traderRatio,
            aggressionRatio: volRatio,
            compositeScore: score,
            totalBids: buyCount,
            totalAsks: sellCount,
            buyVol: buyVol,
            sellVol: sellVol,
            buyerAggressive: score > 0.15,
            sellerAggressive: score < -0.15,
            signalText: signalText,
            confidence: confidence,
            sigClass: sigClass,
            cardClass: cardClass
        };
    }
}
