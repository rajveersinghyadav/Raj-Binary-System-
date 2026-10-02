class CryptoIDXStreamer {
    constructor(onUpdate) {
        this.onUpdate = onUpdate;
        this.streamsData = {
            btc: { buyCount: 0, sellCount: 0, buyVol: 0, sellVol: 0, price: 0 },
            eth: { buyCount: 0, sellCount: 0, buyVol: 0, sellVol: 0, price: 0 },
            ltc: { buyCount: 0, sellCount: 0, buyVol: 0, sellVol: 0, price: 0 },
            zec: { buyCount: 0, sellCount: 0, buyVol: 0, sellVol: 0, price: 0 }
        };
        this.ws = null;
    }

    connect() {
        // Pure Real Executed Trades Stream (@aggTrade)
        const streams = [
            "btcusdt@aggTrade",
            "ethusdt@aggTrade",
            "ltcusdt@aggTrade",
            "zecusdt@aggTrade"
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

                // REAL EXECUTED TRADE DATA PROCESSING
                const qty = parseFloat(d.q || 0);
                const price = parseFloat(d.p || 0);
                const val = qty * price;

                this.streamsData[coin].price = price;

                // d.m = true means Buyer was Passive and Seller hit the Bid (SELLER TRADE)
                // d.m = false means Seller was Passive and Buyer hit the Ask (BUYER TRADE)
                if (d.m) {
                    this.streamsData[coin].sellCount += 1;
                    this.streamsData[coin].sellVol += val;
                } else {
                    this.streamsData[coin].buyCount += 1;
                    this.streamsData[coin].buyVol += val;
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
            this.streamsData[coin].buyCount = 0;
            this.streamsData[coin].sellCount = 0;
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
        this.buyCount = 0;
        this.sellCount = 0;
        this.buyVol = 0;
        this.sellVol = 0;
        this.depthData = { buyCount: 0, sellCount: 0, buyVol: 0, sellVol: 0, price: 0 };
    }

    start() {
        if (this.config.isForex) {
            this.startYahooStream();
            return;
        }

        const symbol = (this.config.streamSymbol || 'btcusdt').toLowerCase();
        const url = `wss://stream.binance.com:9443/ws/${symbol}@aggTrade`;

        this.ws = new WebSocket(url);

        this.ws.onmessage = (event) => {
            const data = JSON.parse(event.data);
            if (data.e === 'aggTrade') {
                const price = parseFloat(data.p || 0);
                const qty = parseFloat(data.q || 0) * price;
                
                this.onPrice(price);
                this.depthData.price = price;

                if (data.m) {
                    this.sellCount += 1;
                    this.sellVol += qty;
                } else {
                    this.buyCount += 1;
                    this.buyVol += qty;
                }

                this.depthData.buyCount = this.buyCount;
                this.depthData.sellCount = this.sellCount;
                this.depthData.buyVol = this.buyVol;
                this.depthData.sellVol = this.sellVol;

                this.onDepth(this.depthData);
            }
        };

        this.ws.onerror = () => setTimeout(() => this.start(), 2000);
        this.ws.onclose = () => setTimeout(() => this.start(), 2000);
    }

    startYahooStream() {
        const mockPrice = 1.0850;
        this.onPrice(mockPrice);
        this.depthData = {
            buyCount: 50,
            sellCount: 50,
            buyVol: 500,
            sellVol: 500,
            price: mockPrice
        };
        this.onDepth(this.depthData);
    }

    resetTicks() {
        this.buyCount = 0;
        this.sellCount = 0;
        this.buyVol = 0;
        this.sellVol = 0;
    }
}
