class CryptoIDXCalculator {
    static compute(multiStreamData) {
        if (!multiStreamData) {
            return this.getEmptyState("WAITING STREAM DATA");
        }

        // Binomo Crypto IDX Weightage
        const weights = {
            btc: 0.40,
            eth: 0.30,
            ltc: 0.15,
            zec: 0.15
        };

        let totalWeightedBidsVal = 0;
        let totalWeightedAsksVal = 0;
        let totalWeightedBuyVol = 0;
        let totalWeightedSellVol = 0;
        let activeCoinsCount = 0;

        for (let coin in weights) {
            const data = multiStreamData[coin];
            
            if (data && data.bids && data.asks && data.bids.length > 0) {
                activeCoinsCount++;

                let coinBidsValue = 0;
                let coinAsksValue = 0;

                // Top 5 Depth Dollar Volume
                for (let i = 0; i < Math.min(5, data.bids.length); i++) {
                    coinBidsValue += parseFloat(data.bids[i][0]) * parseFloat(data.bids[i][1]);
                }

                for (let i = 0; i < Math.min(5, data.asks.length); i++) {
                    coinAsksValue += parseFloat(data.asks[i][0]) * parseFloat(data.asks[i][1]);
                }

                totalWeightedBidsVal += coinBidsValue * weights[coin];
                totalWeightedAsksVal += coinAsksValue * weights[coin];

                totalWeightedBuyVol += (data.buyVol || 0) * weights[coin];
                totalWeightedSellVol += (data.sellVol || 0) * weights[coin];
            }
        }

        if (activeCoinsCount < 2) {
            return this.getEmptyState("SYNCING 4 STREAMS...");
        }

        // 1. DEPTH IMBALANCE RATIO (-1.0 to +1.0)
        const totalDepthVal = totalWeightedBidsVal + totalWeightedAsksVal;
        const imbalance = totalDepthVal > 0 ? (totalWeightedBidsVal - totalWeightedAsksVal) / totalDepthVal : 0;

        // 2. TRADE AGGRESSION RATIO (-1.0 to +1.0)
        const totalTradeVol = totalWeightedBuyVol + totalWeightedSellVol;
        const aggressionRatio = totalTradeVol > 0 ? (totalWeightedBuyVol - totalWeightedSellVol) / totalTradeVol : 0;

        // 3. COMPOSITE SCORE (50% Orderbook + 50% Active Trades)
        const compositeScore = (imbalance * 0.50) + (aggressionRatio * 0.50);

        let signalText = "NEUTRAL / NO HIGH-CONFIDENCE ENTRY";
        let sigClass = "WAITING";
        let cardClass = "";
        let confidence = 50;

        // --- ULTRA-STRICT 75:25 THRESHOLD FILTERS ---
        // BUY RULE: Composite Score >= +0.25 AND Imbalance >= +0.15 AND Aggression >= +0.15
        const isUltraBuy = (compositeScore >= 0.25) && (imbalance >= 0.15) && (aggressionRatio >= 0.15);
        
        // SELL RULE: Composite Score <= -0.25 AND Imbalance <= -0.15 AND Aggression <= -0.15
        const isUltraSell = (compositeScore <= -0.25) && (imbalance <= -0.15) && (aggressionRatio <= -0.15);

        if (isUltraBuy) {
            signalText = "NEXT CANDLE: ULTRA CALL (STRONG BUY)";
            sigClass = "BUY";
            cardClass = "GREEN";
            confidence = Math.min(99, Math.round(85 + (compositeScore * 50)));
        } else if (isUltraSell) {
            signalText = "NEXT CANDLE: ULTRA PUT (STRONG SELL)";
            sigClass = "SELL";
            cardClass = "RED";
            confidence = Math.min(99, Math.round(85 + (Math.abs(compositeScore) * 50)));
        }

        return {
            imbalance: imbalance,
            aggressionRatio: aggressionRatio,
            compositeScore: compositeScore,
            totalBids: totalWeightedBidsVal,
            totalAsks: totalWeightedAsksVal,
            buyVol: totalWeightedBuyVol,
            sellVol: totalWeightedSellVol,
            buyerAggressive: aggressionRatio > 0.15,
            sellerAggressive: aggressionRatio < -0.15,
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
