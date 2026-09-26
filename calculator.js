class CryptoIDXCalculator {
    static compute(multiStreamData) {
        if (!multiStreamData) {
            return this.getEmptyState("WAITING STREAM DATA");
        }

        // Binomo Crypto IDX Exact Weights
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

                // Orderbook Dollar Volume (Price * Quantity)
                let coinBidsValue = 0;
                let coinAsksValue = 0;

                for (let i = 0; i < Math.min(5, data.bids.length); i++) {
                    coinBidsValue += parseFloat(data.bids[i][0]) * parseFloat(data.bids[i][1]);
                }

                for (let i = 0; i < Math.min(5, data.asks.length); i++) {
                    coinAsksValue += parseFloat(data.asks[i][0]) * parseFloat(data.asks[i][1]);
                }

                totalWeightedBidsVal += coinBidsValue * weights[coin];
                totalWeightedAsksVal += coinAsksValue * weights[coin];

                // Aggression Trade Volume
                totalWeightedBuyVol += (data.buyVol || 0) * weights[coin];
                totalWeightedSellVol += (data.sellVol || 0) * weights[coin];
            }
        }

        if (activeCoinsCount === 0) {
            return this.getEmptyState("SYNCING 4 STREAMS...");
        }

        // Combined Depth Imbalance (-1.0 to +1.0)
        const totalDepthVal = totalWeightedBidsVal + totalWeightedAsksVal;
        const imbalance = totalDepthVal > 0 ? (totalWeightedBidsVal - totalWeightedAsksVal) / totalDepthVal : 0;

        // Combined Trade Aggression (-1.0 to +1.0)
        const totalTradeVol = totalWeightedBuyVol + totalWeightedSellVol;
        const aggressionRatio = totalTradeVol > 0 ? (totalWeightedBuyVol - totalWeightedSellVol) / totalTradeVol : 0;

        // Final Composite Score (40% Orderbook Depth + 60% Trades Aggression)
        const compositeScore = (imbalance * 0.40) + (aggressionRatio * 0.60);

        let signalText = "WAITING / NEUTRAL";
        let sigClass = "WAITING";
        let cardClass = "";
        let confidence = 50;

        // Strict Signal Threshold to Prevent Losses
        if (compositeScore > 0.08 && imbalance > 0.02) {
            signalText = "NEXT CANDLE: CALL (GREEN)";
            sigClass = "BUY";
            cardClass = "GREEN";
            confidence = Math.min(98, Math.round(75 + (compositeScore * 100)));
        } else if (compositeScore < -0.08 && imbalance < -0.02) {
            signalText = "NEXT CANDLE: PUT (RED)";
            sigClass = "SELL";
            cardClass = "RED";
            confidence = Math.min(98, Math.round(75 + (Math.abs(compositeScore) * 100)));
        }

        return {
            imbalance: imbalance,
            aggressionRatio: aggressionRatio,
            compositeScore: compositeScore,
            totalBids: totalWeightedBidsVal,
            totalAsks: totalWeightedAsksVal,
            buyVol: totalWeightedBuyVol,
            sellVol: totalWeightedSellVol,
            buyerAggressive: aggressionRatio > 0.1,
            sellerAggressive: aggressionRatio < -0.1,
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
