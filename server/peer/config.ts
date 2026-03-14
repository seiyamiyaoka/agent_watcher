import fs from "fs";
import path from "path";
import os from "os";

export interface PeerConfig {
  name: string;
  port: number;
  peers: { host: string; port: number }[];
  enableMdns: boolean;
}

const CONFIG_DIR = path.join(os.homedir(), ".agent-timeline");
const CONFIG_PATH = path.join(CONFIG_DIR, "config.json");

const DEFAULT_PORT = 3456;

function defaultConfig(): PeerConfig {
  return {
    name: os.hostname().replace(/\.local$/, ""),
    port: DEFAULT_PORT,
    peers: [],
    enableMdns: true,
  };
}

export function loadConfig(): PeerConfig {
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      const raw = fs.readFileSync(CONFIG_PATH, "utf-8");
      return { ...defaultConfig(), ...JSON.parse(raw) };
    }
  } catch {
    // Fall through to default
  }

  const config = defaultConfig();
  saveConfig(config);
  return config;
}

export function saveConfig(config: PeerConfig): void {
  try {
    if (!fs.existsSync(CONFIG_DIR)) {
      fs.mkdirSync(CONFIG_DIR, { recursive: true });
    }
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
  } catch (err) {
    console.error("Failed to save config:", err);
  }
}
