const express = require("express");
const cors = require("cors");
const axios = require("axios");
const path = require("path");
const WebSocket = require("ws");

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static("public"));

const PORT = process.env.PORT || 3000;

// ⭐ Put NEW Finnhub API key here
const FINNHUB_KEY = "d633h51r01qnpqnvm2t0d633h51r01qnpqnvm2tg";


// -----------------------------
// Portfolio (Memory)
// -----------------------------
let portfolio = [];


// -----------------------------
// Stock List
// -----------------------------
const stocks = [
  "RELIANCE.NS",
  "TCS.NS",
  "INFY.NS",
  "HDFCBANK.NS",
  "ICICIBANK.NS",
  "ITC.NS"
];


// ------------------------------------------------
// NSE FALLBACK (Accurate Indian Data)
// ------------------------------------------------
async function fetchFromNSE(symbol) {

  try {

    const cleanSymbol = symbol.replace(".NS", "");

    const response = await axios.get(
      `https://www.nseindia.com/api/quote-equity?symbol=${cleanSymbol}`,
      {
        headers: {
          "User-Agent": "Mozilla/5.0"
        }
      }
    );

    return response.data.priceInfo.lastPrice;

  } catch {
    return null;
  }
}


// ------------------------------------------------
// REST API → Initial Stock Load
// ------------------------------------------------
app.get("/stocks", async (req, res) => {

  try {

    const result = await Promise.all(
      stocks.map(async (symbol) => {

        let price = null;

        // Try Finnhub first
        try {
          const response = await axios.get(
            `https://finnhub.io/api/v1/quote?symbol=${symbol}&token=${FINNHUB_KEY}`
          );

          price = response.data.c;
        } catch {}

        // Fallback NSE
        if (!price) {
          price = await fetchFromNSE(symbol);
        }

        return {
          name: symbol,
          price
        };
      })
    );

    res.json(result);

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// ------------------------------------------------
// Portfolio APIs
// ------------------------------------------------
app.get("/portfolio", (req, res) => res.json(portfolio));

app.post("/buy", (req, res) => {

  portfolio.push(req.body);

  res.json({
    message: "Stock Bought Successfully",
    portfolio
  });
});

app.post("/sell", (req, res) => {

  portfolio = portfolio.filter(
    s => s.name !== req.body.name
  );

  res.json({
    message: "Stock Sold Successfully",
    portfolio
  });
});


// ------------------------------------------------
// SINGLE Finnhub WebSocket Connection
// ------------------------------------------------
const wss = new WebSocket.Server({ port: 4000 });

let clients = [];

const finnhubSocket = new WebSocket(
  `wss://ws.finnhub.io?token=${FINNHUB_KEY}`
);


// Connect to Finnhub once
finnhubSocket.on("open", () => {

  console.log("Connected to Finnhub WebSocket");

  stocks.forEach(symbol => {

    finnhubSocket.send(
      JSON.stringify({
        type: "subscribe",
        symbol
      })
    );

  });
});


// Broadcast data to frontend clients
finnhubSocket.on("message", (data) => {

  clients.forEach(client => {

    if (client.readyState === WebSocket.OPEN) {
      client.send(data.toString());
    }

  });

});


// Client connection handler
wss.on("connection", (ws) => {

  console.log("Frontend connected to WebSocket");

  clients.push(ws);

  ws.on("close", () => {
    clients = clients.filter(c => c !== ws);
  });

});


// ------------------------------------------------
// SPA Fallback
// ------------------------------------------------
app.use((req, res) => {
  res.sendFile(path.join(__dirname, "public/index.html"));
});


// ------------------------------------------------
// Run Server
// ------------------------------------------------
app.listen(PORT, () => {

  console.log("HTTP Server running on", PORT);
  console.log("WebSocket running on 4000");

});
