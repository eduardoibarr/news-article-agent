import express from "express";
import cors from "cors";
import path from "path";
import { config } from "./config/env";
import agentRoutes from "./routes/agentRoutes";
import { initVectorDB } from "./services/vectorDBService";
import { startKafkaConsumer } from "./services/kafkaService";
import { processArticlesFromCsv } from "./services/csvService";
import { setupDataDirectory } from "./utils/setupData";
import requestLogger from "./middleware/requestLogger";
import logger, { logServer, logError, logDB, logKafka } from "./utils/logger";
import { createYogaServer } from "./graphql/server";

async function startServer() {
  const app = express();

  app.use(cors());
  app.use(express.json());
  app.use(requestLogger);

  app.use("/", agentRoutes);
  app.use("/agent", agentRoutes);

  const yogaServer = createYogaServer();
  app.use("/graphql", yogaServer);

  app.get("/health", (req, res) => {
    res.status(200).json({ status: "OK", timestamp: new Date().toISOString() });
  });

  app.get("/status", (req, res) => {
    res.status(200).json({
      status: "OK",
      version: "1.0.0",
      environment: process.env.NODE_ENV || "development",
      timestamp: new Date().toISOString(),
    });
  });

  const PORT = config.server.port;

  app.listen(PORT, () => {
    logServer(`Server is running on port ${PORT}`);
    logServer(`Health check: http://localhost:${PORT}/health`);
    logServer(`REST API endpoint: http://localhost:${PORT}/agent`);
    logServer(`GraphQL endpoint: http://localhost:${PORT}/graphql`);
    logServer(`GraphQL playground: http://localhost:${PORT}/graphql`);
  });

  try {
    await setupDataDirectory();
    logServer("Data directory setup completed");
  } catch (error) {
    logError("Data Directory Setup", error);
  }

  try {
    await initVectorDB();
    logDB("Vector database initialized successfully");
  } catch (error) {
    logError("Vector DB Initialization", error);
  }

  try {
    logKafka("Starting Kafka consumer...");
    await startKafkaConsumer((url, success) => {
      if (success) {
        logKafka(`Article ${url}: processed successfully`);
      } else {
        logKafka(`Article ${url}: failed to process`, "warn");
      }
    });
  } catch (kafkaError) {
    logError("Kafka Consumer", kafkaError);
    logServer("Falling back to CSV data ingestion...");
    try {
      const csvPath = path.join(process.cwd(), "data", "articles_dataset.csv");
      await processArticlesFromCsv(csvPath, (url, success) => {
        if (success) {
          logServer(`Article ${url}: processed successfully`);
        } else {
          logServer(`Article ${url}: failed to process`, "warn");
        }
      });
    } catch (csvError) {
      logError("CSV Processing", csvError);
    }
  }
}

startServer().catch((error) => {
  logError("Server Startup", error);
  process.exit(1);
});
