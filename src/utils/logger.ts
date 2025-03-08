import winston from "winston";
import "winston-daily-rotate-file";
import path from "path";
import fs from "fs";

const logsDir = path.join(process.cwd(), "logs");
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

const levels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
};

const colors = {
  error: "red",
  warn: "yellow",
  info: "green",
  http: "magenta",
  debug: "blue",
};

winston.addColors(colors);

const logFormat = winston.format.combine(
  winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss:ms" }),
  winston.format.printf((info) => {
    return `${info.message}`;
  })
);

const coloredLogFormat = winston.format.combine(
  winston.format.colorize({ all: true }),
  winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss:ms" }),
  winston.format.printf((info) => {
    return `${info.message}`;
  })
);

const fileRotateTransport = new winston.transports.DailyRotateFile({
  filename: path.join(logsDir, "application-%DATE%.log"),
  datePattern: "YYYY-MM-DD",
  maxSize: "20m",
  maxFiles: "14d",
  format: logFormat,
});

const errorFileRotateTransport = new winston.transports.DailyRotateFile({
  filename: path.join(logsDir, "error-%DATE%.log"),
  datePattern: "YYYY-MM-DD",
  maxSize: "20m",
  maxFiles: "14d",
  level: "error",
  format: logFormat,
});

const logger = winston.createLogger({
  level: process.env.NODE_ENV === "production" ? "info" : "debug",
  levels,
  format: logFormat,
  transports: [
    fileRotateTransport,
    errorFileRotateTransport,
    new winston.transports.Console({
      format: coloredLogFormat,
    }),
  ],
});

export const logDB = (message: string, level: string = "info") => {
  const timestamp = new Date().toISOString().replace("T", " ").substring(0, 23);
  logger.log({
    level,
    message: `[${timestamp}] [${level.toUpperCase()}] [Database] ${message}`,
  });
};

export const logAPI = (message: string, level: string = "info") => {
  const timestamp = new Date().toISOString().replace("T", " ").substring(0, 23);
  logger.log({
    level,
    message: `[${timestamp}] [${level.toUpperCase()}] [API] ${message}`,
  });
};

export const logServer = (message: string, level: string = "info") => {
  const timestamp = new Date().toISOString().replace("T", " ").substring(0, 23);
  logger.log({
    level,
    message: `[${timestamp}] [${level.toUpperCase()}] [Server] ${message}`,
  });
};

export const logAgent = (message: string, level: string = "info") => {
  const timestamp = new Date().toISOString().replace("T", " ").substring(0, 23);
  logger.log({
    level,
    message: `[${timestamp}] [${level.toUpperCase()}] [Agent] ${message}`,
  });
};

export const logKafka = (message: string, level: string = "info") => {
  const timestamp = new Date().toISOString().replace("T", " ").substring(0, 23);
  logger.log({
    level,
    message: `[${timestamp}] [${level.toUpperCase()}] [Kafka] ${message}`,
  });
};

export const logError = (context: string, error: any) => {
  const errorMessage =
    error instanceof Error
      ? error.stack || error.message
      : JSON.stringify(error);
  logger.error(`[${context}] ${errorMessage}`);
};

export default logger;
