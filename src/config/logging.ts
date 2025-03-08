export const loggingConfig = {
  defaultLevel:
    process.env.LOG_LEVEL ||
    (process.env.NODE_ENV === "production" ? "info" : "debug"),
  fileRetention: "14d",
  maxFileSize: "20m",
  contextLevels: {
    database: process.env.LOG_LEVEL_DATABASE || "info",
    api: process.env.LOG_LEVEL_API || "http",
    server: process.env.LOG_LEVEL_SERVER || "info",
    agent: process.env.LOG_LEVEL_AGENT || "info",
    kafka: process.env.LOG_LEVEL_KAFKA || "info",
  },
  consoleInProduction:
    process.env.LOG_CONSOLE_IN_PRODUCTION === "true" || false,
};

export default loggingConfig;
