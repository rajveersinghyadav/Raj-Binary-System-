import asyncio
import json
import websockets

class OrderBookEngine:
    def __init__(self):
        self.binance_bids = 0.0
        self.binance_asks = 0.0
        self.delta_bids = 0.0
        self.delta_asks = 0.0

    async def connect_binance(self, symbol="btcusdt"):
        url = f"wss://stream.binance.com:9443/ws/{symbol}@depth10@100ms"
        async with websockets.connect(url) as ws:
            while True:
                data = json.loads(await ws.recv())
                self.binance_bids = sum([float(item[1]) for item in data.get('bids', [])])
                self.binance_asks = sum([float(item[1]) for item in data.get('asks', [])])

    async def connect_delta(self, symbol="BTC_USDT"):
        url = "wss://socket.delta.exchange"
        async with websockets.connect(url) as ws:
            subscribe_msg = {
                "type": "subscribe",
                "payload": {
                    "channels": [{"name": "l2orderbook", "symbols": [symbol]}]
                }
            }
            await ws.send(json.dumps(subscribe_msg))
            while True:
                res = await ws.recv()
                data = json.loads(res)
                if data.get('type') == 'l2orderbook':
                    bids = data.get('bids', [])
                    asks = data.get('asks', [])
                    self.delta_bids = sum([float(b.get('size', 0)) for b in bids])
                    self.delta_asks = sum([float(a.get('size', 0)) for a in asks])

    def get_merged_imbalance(self):
        total_bids = self.binance_bids + self.delta_bids
        total_asks = self.binance_asks + self.delta_asks
        total_volume = total_bids + total_asks

        if total_volume == 0:
            return 0.0, "NEUTRAL", 50

        # Imbalance Formula: (Bids - Asks) / Total
        imbalance = (total_bids - total_asks) / total_volume

        # Confidence Score Calculation
        confidence = int(50 + (abs(imbalance) * 50))

        if imbalance > 0.15:
            signal = "LEAN BUY"
        elif imbalance < -0.15:
            signal = "LEAN SELL"
        else:
            signal = "LEAN NEUTRAL"

        return round(imbalance, 3), signal, confidence

