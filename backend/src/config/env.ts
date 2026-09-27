import "dotenv/config";

export interface AppConfig {
  PORT: number;
  NODE_ENV: "development" | "production" | "test";
  MONGO_URI: string;
  JWT_SECRET: string;
  AI_SERVICE_URL: string;
  CLIENT_URL: string;
  RATE_LIMIT_WINDOW_MS: number;
  RATE_LIMIT_MAX_AI: number;
  RATE_LIMIT_MAX_AUTH: number;
}

const getEnvNumber = (key: string, defaultValue: number): number => {
  const val = process.env[key];
  if (!val) return defaultValue;
  const num = parseInt(val, 10);
  return isNaN(num) ? defaultValue : num;
};

const getEnvString = (key: string, defaultValue: string): string => {
  return (process.env[key] || defaultValue).trim();
};

const nodeEnv = (process.env.NODE_ENV || "development").toLowerCase() as AppConfig["NODE_ENV"];
const jwtSecret = getEnvString("JWT_SECRET", "change_me_super_secret_codeguardian_2026");

if (nodeEnv === "production" && (jwtSecret === "change_me_super_secret" || jwtSecret.length < 16)) {
  console.warn("⚠️ WARNING: Using a weak or default JWT_SECRET in production. Set a strong JWT_SECRET in your .env file!");
}

const rawAiUrl = getEnvString("AI_SERVICE_URL", "http://localhost:8000");
const normalizedAiUrl = rawAiUrl.endsWith("/") ? rawAiUrl.slice(0, -1) : rawAiUrl;

export const config: AppConfig = {
  PORT: getEnvNumber("PORT", 5000),
  NODE_ENV: nodeEnv,
  MONGO_URI: getEnvString("MONGO_URI", "mongodb://localhost:27017/codeguardian"),
  JWT_SECRET: jwtSecret,
  AI_SERVICE_URL: normalizedAiUrl,
  CLIENT_URL: getEnvString("CLIENT_URL", "http://localhost:5173"),
  RATE_LIMIT_WINDOW_MS: getEnvNumber("RATE_LIMIT_WINDOW_MS", 15 * 60 * 1000), // 15 mins
  RATE_LIMIT_MAX_AI: getEnvNumber("RATE_LIMIT_MAX_AI", 30), // 30 AI queries per 15 min
  RATE_LIMIT_MAX_AUTH: getEnvNumber("RATE_LIMIT_MAX_AUTH", 15), // 15 login/register attempts per 15 min
};
