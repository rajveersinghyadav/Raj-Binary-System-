// Streamer for BTC, ETH, LTC, ZEC (Binomo Crypto IDX Core Assets)
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
            "btcusdt@depth10@100ms", "btcusdt@trade",
            "ethusdt@depth10@100ms", "ethusdt@trade",
            "ltcusdt@depth10@100ms", "ltcusdt@trade",
            "zecusdt@depth10@100ms", "zecusdt@trade"
        ].join("/");

        const url = `wss://stream.binance.com:9443/ws/${streams}`;
        this.ws = new WebSocket(url);

        this.ws.onmessage = (event) => {
            const msg = JSON.parse(event.data);
            if (!msg.stream) return;

            const stream = msg.stream;
            const data = msg.data;

            let coin = "";
            if (stream.startsWith("btcusdt")) coin = "btc";
            else if (stream.startsWith("ethusdt")) coin = "eth";
            else if (stream.startsWith("ltcusdt")) coin = "ltc";
            else if (stream.startsWith("zecusdt")) coin = "zec";

            if (!coin) return;

            // Depth Bids & Asks Update
            if (stream.includes("@depth")) {
                this.streamsData[coin].bids = data.bids || [];
                this.streamsData[coin].asks = data.asks || [];
            } 
            // Trade Volume Aggression Update
            else if (stream.includes("@trade")) {
                const qty = parseFloat(data.q);
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
