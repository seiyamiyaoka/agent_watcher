import express from "express";
import sessionsRouter from "./routes/sessions.js";
import { loadConfig } from "./peer/config.js";
import { PeerDiscovery } from "./peer/discovery.js";
import { createPeersRouter } from "./routes/peers.js";

const config = loadConfig();
const PORT = config.port;

const app = express();

app.use(express.json());

// CORS for local dev (Vite dev server on different port)
app.use((_req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Content-Type");
  next();
});

// API routes
app.use("/api/sessions", sessionsRouter);

// Peer discovery
const discovery = new PeerDiscovery(config);
const peersRouter = createPeersRouter(discovery, config);
app.use("/api/peers", peersRouter);
app.use("/api", peersRouter); // Mount /api/identity at root level

// Health check
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

// Bind to 0.0.0.0 for LAN access
app.listen(PORT, "0.0.0.0", () => {
  console.log(`Agent Timeline Viewer server running on http://0.0.0.0:${PORT}`);
  console.log(`Peer name: ${config.name}`);
  discovery.start();
});

// Graceful shutdown
process.on("SIGINT", () => {
  discovery.stop();
  process.exit(0);
});

process.on("SIGTERM", () => {
  discovery.stop();
  process.exit(0);
});
