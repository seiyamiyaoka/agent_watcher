import express from "express";
import sessionsRouter from "./routes/sessions.js";

const app = express();
const PORT = 3456;

app.use(express.json());

// CORS for local dev (Vite dev server on different port)
app.use((_req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Content-Type");
  next();
});

// API routes
app.use("/api/sessions", sessionsRouter);

// Health check
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.listen(PORT, () => {
  console.log(`Agent Timeline Viewer server running on http://localhost:${PORT}`);
});
