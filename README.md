# Polymarket Bot | Polymarket Trading Bot | Polymarket Copy Trading Bot

Polymarket Bot Polymarket Trading Bot Polymarket Automatic Trading Bot Advanced Polymarket Trading Bot Polymarket Copy Trading Bot is an automated trade replication system that mirrors the activity of consistently profitable Polymarket participants. It operates continuously, dynamically scales position sizes relative to available capital, and executes trades in real time to ensure alignment with source strategies.

**Copy the best. Trade with confidence.**

An open-source bot that automatically copies trades from top Polymarket traders to your wallet—so you can follow proven strategies 24/7 without watching the market yourself.

Whether you're new to prediction markets or you want to scale your copy-trading across multiple wallets, this bot is built to be **simple to run**, **transparent**, and **under your control**.

---

## ✨ Why use this bot?

- **Real copy trading** — Mirrors every trade from the proxy wallets you choose (buy, sell, merge).
- **Your keys, your rules** — Runs on your machine with your wallet; no custody, no middleman.
- **Flexible sizing** — Copy by **percentage** of the trader’s order, or a **fixed USD amount** per trade.
- **Multi-wallet** — Run one executor and copy into several follower wallets at once.
- **Monitor + Executor** — Run a **monitor** (sleuth) to watch traders and fill the DB, and a separate **executor** to place orders (great for scaling or separating concerns).
- **PnL at a glance** — Check copy-trading performance with `npm run check-copy-pnl`.
- **Preview mode** — Dry-run: see what *would* be traded without sending real orders.

---

## 🔗 Links

| Link | Description |
|------|-------------|
| **[Polymarket](https://polymarket.com)** | Trade prediction markets |
| **[Polymarket Leaderboard](https://polymarket.com/leaderboard)** | Find top traders to copy |
| **[Polygon (USDC)](https://polygon.technology/)** | Network and stablecoin used for trading |
| **[Getting Started Guide](docs/GETTING_STARTED.md)** | Step-by-step setup (if present) |
| **[Repository](https://github.com/Gabagool2-2/polymarket-Copy-trading-bot)** | Source code and issues |

---

## 🚀 Quick start

### Prerequisites

- **Node.js 18+** — [Download Node.js](https://nodejs.org/)
- **MongoDB** — [MongoDB Atlas (free tier)](https://www.mongodb.com/cloud/atlas) works great
- **Ethereum wallet** with some **USDC on Polygon** for trading
- **Polymarket** account (you’ll use the same wallet)

### 1. Clone and install

```bash
git clone https://github.com/Gabagool2-2/polymarket-Copy-trading-bot
cd Copy-trading-bot-polymarket
npm install
```

### 2. Configure

**Easiest:** run the setup wizard and follow the prompts:

```bash
npm run setup
```

**Or** copy `.env.example` to `.env` and fill in your values (see [Configuration](#-configuration) below).

### 3. Health check

```bash
npm run health-check
```

Fix any reported issues before going live.

### 4. Run the bot

**All-in-one (monitor + executor in one process):**

```bash
npm run dev
# or, after building:  npm start
```

**Or split monitor and executor** (e.g. one machine watches, another executes):

```bash
# Terminal 1: only watch traders and write to DB
npm run monitor

# Terminal 2: only read from DB and place orders
npm run executor
```

**First time?** Try **preview mode** so no real orders are sent:

- In `.env` set `PREVIEW_MODE=true`
- Run the bot; it will log “Would execute…” instead of sending orders.

---

## 📋 What you need

| Component | Purpose |
|-----------|--------|
| Node.js 18+ | Run the bot |
| MongoDB | Store trades and state |
| Ethereum wallet | Your trading wallet (Polygon) |
| USDC on Polygon | Trading capital |
| RPC endpoint | e.g. [Infura](https://infura.io), [Alchemy](https://www.alchemy.com) (Polygon) |

---

## 🏗️ How it works

```
┌──────────────────┐     ┌──────────────────┐     ┌──────────────────┐
│  Trade Monitor   │────▶│     MongoDB      │◀────│ Trade Executor   │
│  (sleuth)        │     │  (pending trades)│     │ (places orders)   │
│  • Polls API     │     │                  │     │ • Validates       │
│  • Saves trades  │     │                  │     │ • Copy % or $     │
└──────────────────┘     └──────────────────┘     │ • Multi-wallet   │
        │                          │               └────────┬─────────┘
        │                          │                        │
        ▼                          ▼                        ▼
  Polymarket API            Your config              Polymarket CLOB
  (activity, positions)      (COPY_STRATEGY, etc.)    (orders)
```

- **Monitor** fetches target traders’ activity and positions, deduplicates, and stores new trades.
- **Executor** reads pending trades, applies your copy strategy (percentage or fixed size), validates balance/positions, and posts orders for each follower wallet.
- You can run **monitor** and **executor** together (`npm run dev`) or **separately** (`npm run monitor` + `npm run executor`).

---

## ⚙️ Configuration

### Essential env vars

| Variable | Description |
|----------|-------------|
| `USER_ADDRESSES` | Trader(s) to copy — comma-separated or JSON array |
| `PROXY_WALLET` | Your wallet address (Polygon) |
| `PRIVATE_KEY` | Wallet private key (no `0x` prefix) |
| `MONGO_URI` | MongoDB connection string |
| `CLOB_HTTP_URL` | Polymarket CLOB API (default: `https://clob.polymarket.com/`) |
| `RPC_URL` | Polygon RPC URL |
| `USDC_CONTRACT_ADDRESS` | USDC on Polygon (default in `.env.example`) |

### Copy strategy (optional)

| Variable | Default | Description |
|----------|---------|-------------|
| `COPY_STRATEGY` | `PERCENTAGE` | `PERCENTAGE`, `FIXED`, or `ADAPTIVE` |
| `COPY_SIZE` | `10.0` | For PERCENTAGE: % of trader order; for FIXED: USD per trade |
| `MAX_ORDER_SIZE_USD` | `100.0` | Cap per order |
| `MIN_ORDER_SIZE_USD` | `1.0` | Minimum (Polymarket requirement) |

### Multi-wallet (optional)

Set `FOLLOWER_WALLETS` to a JSON array of `{ "address": "0x...", "privateKey": "..." }`. The executor will copy each pending trade to every listed wallet. If unset, the bot uses `PROXY_WALLET` + `PRIVATE_KEY` as a single follower.

### Preview and run mode

- `PREVIEW_MODE=true` — Executor logs “Would execute…” and does **not** send orders.
- Run **monitor only**: `npm run monitor`
- Run **executor only**: `npm run executor`
- Run **both**: `npm run dev` or `npm start`

See `.env.example` for all options and comments.

---

## 📖 Useful commands

```bash
npm run setup          # Interactive config
npm run health-check  # Check DB, RPC, API
npm run help           # List all scripts

# Copy-trading
npm run dev            # Monitor + executor (dev)
npm start              # Monitor + executor (production build)
npm run monitor        # Monitor only (sleuth)
npm run executor       # Executor only
npm run check-copy-pnl # PnL for your copy-trading wallet(s)

# Positions and safety
npm run check-stats    # Your stats
npm run check-allowance # USDC allowance
npm run close-resolved # Close resolved markets
```

---

## 📊 PnL and monitoring

- **Copy-trading PnL** — Run `npm run check-copy-pnl` to see value, initial cost, unrealized/realized PnL, and position count for your follower wallet(s). Data comes from the Polymarket positions API.
- **Logs** — The bot logs trades, balance checks, and errors; use your normal process (e.g. `logs/` directory, PM2, Docker logs) to monitor.

---

## 🔒 Security and safety

- **Private keys** — Stored only in your `.env`; never committed. Use a dedicated wallet with limited funds.
- **Preview mode** — Use `PREVIEW_MODE=true` to test without sending orders.
- **Limits** — `MAX_ORDER_SIZE_USD`, `MIN_ORDER_SIZE_USD`, and optional `MAX_POSITION_SIZE_USD` / `MAX_DAILY_VOLUME_USD` help cap risk.

---

## 🤝 Contributing and support

- **Bugs and ideas** — Open an [issue](https://github.com/Gabagool2-2/polymarket-Copy-trading-bot/issues) on GitHub.
- **Improvements** — Pull requests are welcome. Keep changes focused and, when possible, add or update tests.
- **Docs** — `docs/GETTING_STARTED.md`, `docs/QUICK_START.md`, and `.env.example` are there to help.

---

## 📄 License and disclaimer

This project is licensed under the **ISC License** — see [LICENSE](LICENSE).

**Disclaimer:** This software is for education and personal use. Prediction markets and crypto trading involve real risk. Only use funds you can afford to lose. The authors are not responsible for any financial losses from using this bot.

---

## 💬 Contact

- **Email:** benjamin.bigdev@gmail.com  
- **Telegram:** [@BenjaminCup](https://t.me/BenjaminCup)  
- **X (Twitter):** [@benjaminccup](https://x.com/benjaminccup)

---

**Thanks for trying the bot. We hope it helps you copy the best and trade a bit more confidently. 🚀**

**[⬆ Back to top](#-polymarket-copy-trading-bot)**
