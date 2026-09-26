// Continuous Real-Time Streaming Engine
class DataStreamer {
    constructor(assetConfig, onPriceUpdate, onDepthUpdate) {
        this.config = assetConfig;
        this.onPriceUpdate = onPriceUpdate;
        this.onDepthUpdate = onDepthUpdate;
        this.ws = null;
        this.isConnected = false;
        
        this.liveBids = [];
        this.liveAsks = [];
        this.buyTicks = 0;
        this.sellTicks = 0;
    }

    start() {
        if (this.ws) {
            this.ws.close();
        }

        // Dedicated Live Order Book Stream (100ms Ultra-Fast Updates)
        this.ws = new WebSocket(`wss://stream.binance.com:9443/ws/${this.config.streamSymbol}@depth10@100ms/${this.config.streamSymbol}@trade`);

        this.ws.onopen = () => {
            this.isConnected = true;
        };

        this.ws.onmessage = (event) => {
            const data = JSON.parse(event.data);

            // 1. Continuous Live Price & Tick Trade Stream
            if (data.p) {
                let price = parseFloat(data.p);
                if (this.config.isIdx) price = (price * 0.125) + 250;
                
                this.onPriceUpdate(price);

                if (data.m) this.sellTicks += parseFloat(data.q);
                else this.buyTicks += parseFloat(data.q);
            }

            // 2. Non-Stop Order Book Depth Streaming (Bids & Asks)
            if (data.bids || data.b) {
                const bidsArr = data.bids || data.b;
                const asksArr = data.asks || data.a;

                if (bidsArr && bidsArr.length > 0) this.liveBids = bidsArr.slice(0, 5);
                if (asksArr && asksArr.length > 0) this.liveAsks = asksArr.slice(0, 5);
                
                // Continuous Callback to UI
                this.onDepthUpdate({
                    bids: this.liveBids,
                    asks: this.liveAsks,
                    buyTicks: this.buyTicks,
                    sellTicks: this.sellTicks
                });
            }
        };

        // Auto-Reconnect if stream drops
        this.ws.onerror = this.ws.onclose = () => {
            this.isConnected = false;
            setTimeout(() => this.start(), 1000);
        };
    }

    resetTicks() {
        this.buyTicks = 0;
        this.sellTicks = 0;
    }
}
