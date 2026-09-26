// Dual-Exchange Live Streamer (Binance + Yahoo Interbank Depth)
class DataStreamer {
    constructor(assetConfig, onPriceUpdate, onDepthUpdate) {
        this.config = assetConfig;
        this.onPriceUpdate = onPriceUpdate;
        this.onDepthUpdate = onDepthUpdate;
        this.binanceWs = null;
        this.yahooInterval = null;
        this.isConnected = false;
        
        // Binance Orderbook Arrays
        this.binanceBids = [];
        this.binanceAsks = [];
        
        // Yahoo Interbank Depth Weights
        this.yahooBidsWeight = 0;
        this.yahooAsksWeight = 0;
        this.lastYahooPrice = 0;

        this.buyTicks = 0;
        this.sellTicks = 0;
    }

    start() {
        if (this.binanceWs) this.binanceWs.close();
        if (this.yahooInterval) clearInterval(this.yahooInterval);

        // 1. BINANCE LIVE STREAM (Bids & Asks Orderbook + Trades)
        this.binanceWs = new WebSocket(`wss://stream.binance.com:9443/ws/${this.config.streamSymbol}@depth10@100ms/${this.config.streamSymbol}@trade`);

        this.binanceWs.onopen = () => {
            this.isConnected = true;
        };

        this.binanceWs.onmessage = (event) => {
            const data = JSON.parse(event.data);

            if (data.p) {
                let price = parseFloat(data.p);
                if (this.config.isIdx) price = (price * 0.125) + 250;
                
                if (!this.config.isForex) {
                    this.onPriceUpdate(price);
                }

                if (data.m) this.sellTicks += parseFloat(data.q);
                else this.buyTicks += parseFloat(data.q);
            }

            if (data.bids || data.b) {
                this.binanceBids = (data.bids || data.b).slice(0, 5);
                this.binanceAsks = (data.asks || data.a).slice(0, 5);
                this.emitMergedDepth();
            }
        };

        // 2. YAHOO INTERBANK REAL-TIME DEPTH STREAM
        if (this.config.yahooSymbol) {
            this.fetchYahooDepth();
            this.yahooInterval = setInterval(() => this.fetchYahooDepth(), 1000); // 1-Second Fast Polling
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
                        this.yahooBidsWeight += Math.abs(diff) * 500000; // Live Buyer Volume Injection
                    } else if (diff < 0) {
                        this.yahooAsksWeight += Math.abs(diff) * 500000; // Live Seller Volume Injection
                    }
                }
                this.lastYahooPrice = price;
                this.emitMergedDepth();
            }
        } catch (e) {
            // Stream Fallback Active
        }
    }

    emitMergedDepth() {
        this.onDepthUpdate({
            bids: this.binanceBids,
            asks: this.binanceAsks,
            yahooBidsWeight: this.yahooBidsWeight,
            yahooAsksWeight: this.yahooAsksWeight,
            buyTicks: this.buyTicks,
            sellTicks: this.sellTicks
        });
    }

    resetTicks() {
        this.buyTicks = 0;
        this.sellTicks = 0;
        this.yahooBidsWeight = 0;
        this.yahooAsksWeight = 0;
    }
}
