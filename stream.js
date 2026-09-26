// SINGLE ASSET STREAMER (For BTCUSDT, ETHUSDT, SOLUSDT, Forex)
class DataStreamer {
    constructor(config, onPrice, onDepth) {
        this.config = config;
        this.onPrice = onPrice;
        this.onDepth = onDepth;
        this.ws = null;
        this.isConnected = false;
        this.buyVol = 0;
        this.sellVol = 0;
        this.depthData = { bids: [], asks: [], buyVol: 0, sellVol: 0 };
    }

    start() {
        if (this.config.isForex) {
            this.startYahooStream();
        } else {
            this.startBinanceStream();
        }
    }

    startBinanceStream() {
        const symbol = (this.config.streamSymbol || 'btcusdt').toLowerCase();
        const url = `wss://stream.binance.com:9443/ws/${symbol}@depth10@100ms/${symbol}@trade`;

        this.ws = new WebSocket(url);

        this.ws.onopen = () => { this.isConnected = true; };

        this.ws.onmessage = (event) => {
            const data = JSON.parse(event.data);
            
            // Depth Data
            if (data.bids && data.asks) {
                this.depthData.bids = data.bids;
                this.depthData.asks = data.asks;
                if (data.bids[0]) {
                    this.onPrice(parseFloat(data.bids[0][0]));
                }
            } 
            // Trade Data
            else if (data.e === 'trade') {
                const qty = parseFloat(data.q);
                if (data.m) {
                    this.sellVol += qty;
                } else {
                    this.buyVol += qty;
                }
            }

            this.depthData.buyVol = this.buyVol;
            this.depthData.sellVol = this.sellVol;
            this.onDepth(this.depthData);
        };

        this.ws.onerror = () => setTimeout(() => this.startBinanceStream(), 2000);
        this.ws.onclose = () => setTimeout(() => this.startBinanceStream(), 2000);
    }

    startYahooStream() {
        // Fallback or CORS Yahoo Proxy for Forex
        this.isConnected = true;
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


// BINOMO CRYPTO IDX 4-ASSET MULTI-STREAMER (BTC, ETH, LTC, ZEC)
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
        this.isConnected = false;
    }

    connect() {
        // Safe Combined WebSocket Stream URL Format
        const streams = [
            "btcusdt@depth5@100ms", "btcusdt@trade",
            "ethusdt@depth5@100ms", "ethusdt@trade",
            "ltcusdt@depth5@100ms", "ltcusdt@trade",
            "zecusdt@depth5@100ms", "zecusdt@trade"
        ].join("/");

        const url = `wss://stream.binance.com:9443/stream?streams=${streams}`;
        this.ws = new WebSocket(url);

        this.ws.onopen = () => {
            this.isConnected = true;
            console.log("Crypto IDX 4-Asset WebSockets Connected Successfully");
        };

        this.ws.onmessage = (event) => {
            try {
                const raw = JSON.parse(event.data);
                if (!raw.stream || !raw.data) return;

                const stream = raw.stream;
                const data = raw.data;

                let coin = "";
                if (stream.includes("btcusdt")) coin = "btc";
                else if (stream.includes("ethusdt")) coin = "eth";
                else if (stream.includes("ltcusdt")) coin = "ltc";
                else if (stream.includes("zecusdt")) coin = "zec";

                if (!coin) return;

                // Depth Orderbook Updates
                if (stream.includes("@depth")) {
                    this.streamsData[coin].bids = data.bids || [];
                    this.streamsData[coin].asks = data.asks || [];
                } 
                // Trade Volume Updates
                else if (stream.includes("@trade")) {
                    const qty = parseFloat(data.q || 0);
                    const isBuyerMaker = data.m; // true = Sell, false = Buy

                    if (isBuyerMaker) {
                        this.streamsData[coin].sellVol += qty;
                    } else {
                        this.streamsData[coin].buyVol += qty;
                    }
                }

                if (this.onUpdate) {
                    this.onUpdate(this.streamsData);
                }
            } catch (err) {
                console.error("Parse Error", err);
            }
        };

        this.ws.onerror = (err) => {
            console.log("WS Error, Reconnecting...", err);
            setTimeout(() => this.connect(), 3000);
        };

        this.ws.onclose = () => {
            setTimeout(() => this.connect(), 3000);
        };
    }

    resetTradeVolumes() {
        for (let coin in this.streamsData) {
            this.streamsData[coin].buyVol = 0;
            this.streamsData[coin].sellVol = 0;
        }
    }
}
