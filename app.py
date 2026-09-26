import asyncio
from fastapi import FastAPI, Request
from fastapi.responses import HTMLResponse
from fastapi.templating import Jinja2Templates
from order_book import OrderBookEngine

app = FastAPI()
templates = Jinja2Templates(directory="templates")
engine = OrderBookEngine()

@app.on_event("startup")
async def startup_event():
    # Background tasks for Websockets
    asyncio.create_task(engine.connect_binance("btcusdt"))
    asyncio.create_task(engine.connect_delta("BTC_USDT"))

@app.get("/", response_class=HTMLResponse)
async def read_root(request: Request):
    return templates.TemplateResponse("index.html", {"request": request})

@app.get("/api/signal")
async def get_signal():
    imbalance, signal, confidence = engine.get_merged_imbalance()
    return {
        "symbol": "BTC/USDT",
        "signal": signal,
        "confidence": confidence,
        "imbalance": imbalance,
        "binance_status": "ON" if engine.binance_bids > 0 else "OFF",
        "delta_status": "ON" if engine.delta_bids > 0 else "OFF"
    }

