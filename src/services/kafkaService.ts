import { Kafka, Consumer, Producer, logLevel } from "kafkajs";
import { v4 as uuidv4 } from "uuid";
import { config } from "../config/env";
import { CleanedArticle } from "../models/article";
import {
  fetchHtmlContent,
  extractTextFromHtml,
  cleanAndStructureContent,
} from "../utils/contentExtractor";
import { storeArticle } from "./vectorDBService";
import { logKafka, logError } from "../utils/logger";

let kafka: Kafka | null = null;
let consumer: Consumer | null = null;
let producer: Producer | null = null;

export async function initKafka(): Promise<void> {
  try {
    if (
      !config.kafka.broker ||
      !config.kafka.username ||
      !config.kafka.password
    ) {
      throw new Error(
        "Missing Kafka configuration. Check your environment variables for KAFKA_BROKER, KAFKA_USERNAME, and KAFKA_PASSWORD."
      );
    }

    logKafka(`Initializing Kafka client to broker: ${config.kafka.broker}`);

    kafka = new Kafka({
      clientId: `news-agent-${uuidv4().substring(0, 8)}`,
      brokers: [config.kafka.broker],
      ssl: true,
      sasl: {
        mechanism: "plain",
        username: config.kafka.username,
        password: config.kafka.password,
      },
      logLevel: logLevel.ERROR,
      connectionTimeout: 10000,
      retry: {
        initialRetryTime: 300,
        retries: 5,
      },
    });

    const groupId = `${config.kafka.groupIdPrefix}-${uuidv4().substring(0, 8)}`;
    logKafka(`Using consumer group ID: ${groupId}`);

    consumer = kafka.consumer({
      groupId: groupId,
      sessionTimeout: 30000,
      heartbeatInterval: 3000,
    });

    producer = kafka.producer();

    logKafka("Connecting to Kafka...");
    await Promise.all([consumer.connect(), producer.connect()]);

    logKafka("Kafka client initialized successfully");
  } catch (error: any) {
    logError("Kafka Init", error);
    throw new Error(`Failed to initialize Kafka client: ${error.message}`);
  }
}

export async function startKafkaConsumer(
  onProcessed: (url: string, success: boolean) => void
): Promise<void> {
  try {
    if (!consumer) {
      await initKafka();
    }

    await consumer!.subscribe({
      topic: config.kafka.topicName,
      fromBeginning: true,
    });

    await consumer!.run({
      eachMessage: async ({ message }) => {
        try {
          if (!message.value) {
            logKafka("Received Kafka message with no value, skipping", "warn");
            return;
          }

          const messageString = message.value.toString();
          logKafka(`Raw Kafka message: ${messageString}`, "debug");

          let parsedMessage;
          try {
            parsedMessage = JSON.parse(messageString);
          } catch (parseError) {
            logError(
              "Kafka Message",
              `Failed to parse Kafka message as JSON: ${parseError}`
            );
            logKafka(`Message content: ${messageString}`, "debug");
            return;
          }

          let url;
          if (parsedMessage.value && parsedMessage.value.url) {
            url = parsedMessage.value.url;
          } else if (parsedMessage.url) {
            url = parsedMessage.url;
          } else {
            logKafka(
              `Message does not contain a URL in expected format. Message content: ${messageString}`,
              "warn"
            );
            return;
          }

          logKafka(`Processing article from Kafka: ${url}`);

          await processArticle(url);

          onProcessed(url, true);
        } catch (error: any) {
          logError("Kafka Message Processing", error);

          if (message?.value) {
            try {
              const parsedMessage = JSON.parse(message.value.toString());

              let url;
              if (parsedMessage.value && parsedMessage.value.url) {
                url = parsedMessage.value.url;
              } else if (parsedMessage.url) {
                url = parsedMessage.url;
              }

              if (url) {
                onProcessed(url, false);
              } else {
                logKafka(
                  "Could not extract URL from message for reporting failure",
                  "warn"
                );
              }
            } catch (e) {
              logError("Kafka Message Parsing", e);
            }
          }
        }
      },
    });

    logKafka(
      `Kafka consumer started, listening to topic: ${config.kafka.topicName}`
    );
  } catch (error: any) {
    logError("Kafka Consumer Start", error);
    throw new Error(`Failed to start Kafka consumer: ${error.message}`);
  }
}

export async function processArticle(url: string): Promise<void> {
  try {
    if (!url) {
      throw new Error("Cannot process article with empty URL");
    }

    try {
      new URL(url);
    } catch (urlError) {
      throw new Error(`Invalid URL format: ${url}`);
    }

    logKafka(`Processing article: ${url}`);

    try {
      const hostname = new URL(url).hostname;
      let htmlContent;

      try {
        htmlContent = await fetchHtmlContent(url);
      } catch (fetchError: any) {
        logError(
          "Article Fetch",
          `Error fetching from ${url}: ${fetchError.message}`
        );

        if (
          fetchError.message.includes("Access denied") ||
          fetchError.message.includes("blocking scrapers")
        ) {
          logKafka(`Using fallback method for blocked site: ${hostname}`);

          const currentDate = new Date().toISOString().split("T")[0];
          const cleanedArticle: CleanedArticle = {
            id: uuidv4(),
            title: `Article from ${hostname}`,
            content: `This article from ${url} could not be accessed directly. The content was not available for processing due to website restrictions.`,
            url: url,
            date: currentDate,
          };

          await storeArticle(cleanedArticle);
          logKafka(`Stored minimal metadata for restricted article: ${url}`);
          return;
        } else {
          throw fetchError;
        }
      }

      const textContent = extractTextFromHtml(htmlContent);

      let cleanedArticle;
      try {
        cleanedArticle = await cleanAndStructureContent(textContent, url);
      } catch (nlpError) {
        logError(
          "Article NLP",
          `Error processing content with NLP: ${nlpError}`
        );

        const currentDate = new Date().toISOString().split("T")[0];
        const titleMatch = textContent.match(/Title: (.*?)\n/);
        const title = titleMatch ? titleMatch[1] : `Article from ${hostname}`;

        cleanedArticle = {
          id: uuidv4(),
          title: title,
          content: textContent.substring(0, 5000),
          url: url,
          date: currentDate,
        };
      }

      await storeArticle(cleanedArticle);
      logKafka(`Article processed successfully: ${url}`);
    } catch (processingError: any) {
      logError(
        "Article Processing",
        `Error during article processing for ${url}: ${processingError}`
      );
      throw new Error(
        `Processing failed for ${url}: ${processingError.message}`
      );
    }
  } catch (error: any) {
    logError("Article Processing", `Error processing article ${url}: ${error}`);
    throw new Error(`Failed to process article ${url}: ${error.message}`);
  }
}

export async function stopKafkaConsumer(): Promise<void> {
  try {
    if (consumer) {
      await consumer.disconnect();
      logKafka("Kafka consumer disconnected");
    }

    if (producer) {
      await producer.disconnect();
      logKafka("Kafka producer disconnected");
    }
  } catch (error: any) {
    logError("Kafka Disconnect", error);
    throw new Error(`Failed to stop Kafka consumer: ${error.message}`);
  }
}
