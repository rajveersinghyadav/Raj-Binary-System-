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

                const s = raw.stream;
                const d = raw.data;

                let coin = "";
                if (s.startsWith("btcusdt")) coin = "btc";
                else if (s.startsWith("ethusdt")) coin = "eth";
                else if (s.startsWith("ltcusdt")) coin = "ltc";
                else if (s.startsWith("zecusdt")) coin = "zec";

                if (!coin) return;

                if (s.includes("@depth")) {
                    this.streamsData[coin].bids = d.bids || [];
                    this.streamsData[coin].asks = d.asks || [];
                } else if (s.includes("@trade")) {
                    const qty = parseFloat(d.q || 0);
                    const price = parseFloat(d.p || 1);
                    const val = qty * price;

                    if (d.m) {
                        this.streamsData[coin].sellVol += val;
                    } else {
                        this.streamsData[coin].buyVol += val;
                    }
                }

                if (this.onUpdate) {
                    this.onUpdate(this.streamsData);
                }
            } catch (err) {
                console.error("Stream parse error:", err);
            }
        };

        this.ws.onerror = () => setTimeout(() => this.connect(), 2000);
        this.ws.onclose = () => setTimeout(() => this.connect(), 2000);
    }

    resetTradeVolumes() {
        for (let coin in this.streamsData) {
            this.streamsData[coin].buyVol = 0;
            this.streamsData[coin].sellVol = 0;
        }
    }
}

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
                const qty = parseFloat(data.q) * parseFloat(data.p || 1);
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
