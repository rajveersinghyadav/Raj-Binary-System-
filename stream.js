class CryptoIDXStreamer {
    constructor(onUpdate) {
        this.onUpdate = onUpdate;
        this.streamsData = {
            btc: { bids: [], asks: [], buyVol: 0, sellVol: 0 },
            eth: { bids: [], asks: [], buyVol: 0, sellVol: 0 },
            ltc: { bids: [], asks: [], buyVol: 0, sellVol: 0 },
            zec: { bids: [], asks: [], buyVol: 0, sellVol: 0 }
        };
        this.ws = null;
    }

    connect() {
        const streams = [
            "btcusdt@depth5@100ms", "btcusdt@trade",
            "ethusdt@depth5@100ms", "ethusdt@trade",
            "ltcusdt@depth5@100ms", "ltcusdt@trade",
            "zecusdt@depth5@100ms", "zecusdt@trade"
        ].join("/");

        const url = `wss://stream.binance.com:9443/stream?streams=${streams}`;
        this.ws = new WebSocket(url);

        this.ws.onmessage = (event) => {
            try {
                const raw = JSON.parse(event.data);
                if (!raw || !raw.stream || !raw.data) return;

                const streamName = raw.stream;
                const data = raw.data;

                let coin = "";
                if (streamName.startsWith("btcusdt")) coin = "btc";
                else if (streamName.startsWith("ethusdt")) coin = "eth";
                else if (streamName.startsWith("ltcusdt")) coin = "ltc";
                else if (streamName.startsWith("zecusdt")) coin = "zec";

                if (!coin) return;

                // Depth Updates
                if (streamName.includes("@depth")) {
                    if (data.bids) this.streamsData[coin].bids = data.bids;
                    if (data.asks) this.streamsData[coin].asks = data.asks;
                } 
                // Trade Volume Updates
                else if (streamName.includes("@trade")) {
                    const qty = parseFloat(data.q || 0);
                    if (data.m) {
                        this.streamsData[coin].sellVol += qty;
                    } else {
                        this.streamsData[coin].buyVol += qty;
                    }
                }

                if (this.onUpdate) {
                    this.onUpdate(this.streamsData);
                }
            } catch (err) {
                console.error("Stream parsing error:", err);
            }
        };

        this.ws.onerror = () => setTimeout(() => this.connect(), 3000);
        this.ws.onclose = () => setTimeout(() => this.connect(), 3000);
    }

    resetTradeVolumes() {
        for (let coin in this.streamsData) {
            this.streamsData[coin].buyVol = 0;
            this.streamsData[coin].sellVol = 0;
        }
    }
}

// Single Asset Streamer (BTC, ETH, SOL, Forex)
class DataStreamer {
    constructor(config, onPrice, onDepth) {
        this.config = config;
        this.onPrice = onPrice;
        this.onDepth = onDepth;
        this.ws = null;
        this.buyVol = 0;
        this.sellVol = 0;
        this.depthData = { bids: [], asks: [], buyVol: 0, sellVol: 0 };
    }

    start() {
        if (this.config.isForex) {
            this.startYahooStream();
            return;
        }

        const symbol = (this.config.streamSymbol || 'btcusdt').toLowerCase();
        const url = `wss://stream.binance.com:9443/ws/${symbol}@depth10@100ms/${symbol}@trade`;

        this.ws = new WebSocket(url);

        this.ws.onmessage = (event) => {
            const data = JSON.parse(event.data);
            if (data.bids && data.asks) {
                this.depthData.bids = data.bids;
                this.depthData.asks = data.asks;
                if (data.bids[0]) this.onPrice(parseFloat(data.bids[0][0]));
            } else if (data.e === 'trade') {
                const qty = parseFloat(data.q);
                if (data.m) this.sellVol += qty;
                else this.buyVol += qty;
            }

            this.depthData.buyVol = this.buyVol;
            this.depthData.sellVol = this.sellVol;
            this.onDepth(this.depthData);
        };

        this.ws.onerror = () => setTimeout(() => this.start(), 2000);
        this.ws.onclose = () => setTimeout(() => this.start(), 2000);
    }

    startYahooStream() {
        const mockPrice = 1.0850;
        this.onPrice(mockPrice);
        this.depthData = {
            bids: [[mockPrice - 0.0001, 100]],
            asks: [[mockPrice + 0.0001, 100]],
            buyVol: 50,
            sellVol: 50
        };
        this.onDepth(this.depthData);
    }

    resetTicks() {
        this.buyVol = 0;
        this.sellVol = 0;
    }
}
