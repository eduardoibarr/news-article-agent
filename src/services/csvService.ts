import fs from "fs";
import csvParser from "csv-parser";
import { processArticle } from "./kafkaService";
import { logServer, logError } from "../utils/logger";

export async function processArticlesFromCsv(
  filePath: string,
  onProcessed: (url: string, success: boolean) => void
): Promise<void> {
  const results: { url: string }[] = [];

  if (!fs.existsSync(filePath)) {
    throw new Error(`CSV file not found: ${filePath}`);
  }

  await new Promise<void>((resolve, reject) => {
    fs.createReadStream(filePath)
      .pipe(csvParser())
      .on("data", (data) => {
        if (data.url) {
          results.push({ url: data.url });
        }
      })
      .on("end", () => {
        resolve();
      })
      .on("error", (error) => {
        reject(error);
      });
  });

  logServer(`Found ${results.length} articles in CSV file`);

  for (const article of results) {
    try {
      await processArticle(article.url);
      onProcessed(article.url, true);
    } catch (error) {
      logError(
        "CSV Processing",
        `Error processing article from CSV: ${article.url}`
      );
      onProcessed(article.url, false);
    }
  }

  logServer(`CSV processing complete. Processed ${results.length} articles.`);
}
