import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(process.cwd(), ".env") });

export const config = {
  server: {
    port: process.env.PORT || 3000,
  },
  kafka: {
    broker: process.env.KAFKA_BROKER || "",
    username: process.env.KAFKA_USERNAME || "",
    password: process.env.KAFKA_PASSWORD || "",
    topicName: process.env.KAFKA_TOPIC_NAME || "news",
    groupIdPrefix: process.env.KAFKA_GROUP_ID_PREFIX || "test-task-news-agent",
  },
  openai: {
    apiKey: process.env.OPENAI_API_KEY || "",
  },
};
