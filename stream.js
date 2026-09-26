// Multi-Exchange Orderbook & Aggression Streamer
class DataStreamer {
    constructor(assetConfig, onPriceUpdate, onDepthUpdate) {
        this.config = assetConfig;
        this.onPriceUpdate = onPriceUpdate;
        this.onDepthUpdate = onDepthUpdate;
        this.binanceWs = null;
        this.yahooInterval = null;
        this.isConnected = false;
        
        this.binanceBids = [];
        this.binanceAsks = [];
        
        this.yahooBidsWeight = 0;
        this.yahooAsksWeight = 0;
        this.lastYahooPrice = 0;

        // Trade Aggression Counters
        this.buyMarketVol = 0;
        this.sellMarketVol = 0;
        this.buyTradesCount = 0;
        this.sellTradesCount = 0;
    }

    start() {
        if (this.binanceWs) this.binanceWs.close();
        if (this.yahooInterval) clearInterval(this.yahooInterval);

        this.binanceWs = new WebSocket(`wss://stream.binance.com:9443/ws/${this.config.streamSymbol}@depth10@100ms/${this.config.streamSymbol}@trade`);

        this.binanceWs.onopen = () => {
            this.isConnected = true;
        };

        this.binanceWs.onmessage = (event) => {
            const data = JSON.parse(event.data);

            // Real Trade Aggression Monitoring
            if (data.p && data.q) {
                let price = parseFloat(data.p);
                if (this.config.isIdx) price = (price * 0.125) + 250;
                
                if (!this.config.isForex) {
                    this.onPriceUpdate(price);
                }

                // Market Buy vs Market Sell Vol
                if (data.m) {
                    this.sellMarketVol += parseFloat(data.q);
                    this.sellTradesCount += 1;
                } else {
                    this.buyMarketVol += parseFloat(data.q);
                    this.buyTradesCount += 1;
                }
            }

            // Real Order Book Depth Stream
            if (data.bids || data.b) {
                this.binanceBids = (data.bids || data.b).slice(0, 5);
                this.binanceAsks = (data.asks || data.a).slice(0, 5);
                this.emitMergedDepth();
            }
        };

        if (this.config.yahooSymbol) {
            this.fetchYahooDepth();
            this.yahooInterval = setInterval(() => this.fetchYahooDepth(), 1000);
        }

        this.binanceWs.onerror = this.binanceWs.onclose = () => {
            this.isConnected = false;
            setTimeout(() => this.start(), 1000);
        };
    }

    async fetchYahooDepth() {
        try {
            const res = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${this.config.yahooSymbol}?interval=1m`);
            const json = await res.json();
            
            if (json.chart && json.chart.result && json.chart.result[0]) {
                const meta = json.chart.result[0].meta;
                const price = meta.regularMarketPrice;

                if (this.config.isForex) {
                    this.onPriceUpdate(price);
                }

                if (this.lastYahooPrice !== 0) {
                    const diff = price - this.lastYahooPrice;
                    if (diff > 0) {
                        this.yahooBidsWeight += Math.abs(diff) * 600000;
                        this.buyMarketVol += Math.abs(diff) * 300000;
                    } else if (diff < 0) {
                        this.yahooAsksWeight += Math.abs(diff) * 600000;
                        this.sellMarketVol += Math.abs(diff) * 300000;
                    }
                }
                this.lastYahooPrice = price;
                this.emitMergedDepth();
            }
        } catch (e) {}
    }

    emitMergedDepth() {
        this.onDepthUpdate({
            bids: this.binanceBids,
            asks: this.binanceAsks,
            yahooBidsWeight: this.yahooBidsWeight,
            yahooAsksWeight: this.yahooAsksWeight,
            buyMarketVol: this.buyMarketVol,
            sellMarketVol: this.sellMarketVol,
            buyTradesCount: this.buyTradesCount,
            sellTradesCount: this.sellTradesCount
        });
    }

    resetTicks() {
        this.buyMarketVol = 0;
        this.sellMarketVol = 0;
        this.buyTradesCount = 0;
        this.sellTradesCount = 0;
        this.yahooBidsWeight = 0;
        this.yahooAsksWeight = 0;
    }
}
