// Data Importer & Websocket Stream Engine
class DataStreamer {
    constructor(assetConfig, onPriceUpdate, onDepthUpdate) {
        this.config = assetConfig;
        this.onPriceUpdate = onPriceUpdate;
        this.onDepthUpdate = onDepthUpdate;
        this.ws = null;
        this.isConnected = false;
        
        this.liveBids = []; // Top Bids Stream
        this.liveAsks = []; // Top Asks Stream
        this.buyTicks = 0;
        this.sellTicks = 0;
    }

    start() {
        if (this.ws) this.ws.close();

        this.ws = new WebSocket(`wss://stream.binance.com:9443/ws/${this.config.stream}`);

        this.ws.onopen = () => {
            this.isConnected = true;
        };

        this.ws.onmessage = (event) => {
            const data = JSON.parse(event.data);

            // Live Price & Tick Trade Stream
            if (data.p) {
                let price = parseFloat(data.p);
                if (this.config.isIdx) price = (price * 0.125) + 250;
                
                this.onPriceUpdate(price);

                if (data.m) this.sellTicks += parseFloat(data.q);
                else this.buyTicks += parseFloat(data.q);
            }

            // Live Order Book Depth (Bids & Asks)
            if (data.bids && data.asks) {
                this.liveBids = data.bids.slice(0, 5); // Top 5 Bids
                this.liveAsks = data.asks.slice(0, 5); // Top 5 Asks
                
                this.onDepthUpdate({
                    bids: this.liveBids,
                    asks: this.liveAsks,
                    buyTicks: this.buyTicks,
                    sellTicks: this.sellTicks
                });
            }
        };

        this.ws.onerror = this.ws.onclose = () => {
            this.isConnected = false;
        };
    }

    resetTicks() {
        this.buyTicks = 0;
        this.sellTicks = 0;
    }
}
