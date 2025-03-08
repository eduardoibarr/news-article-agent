import fs from "fs";
import path from "path";
import { logServer, logError } from "./logger";

export async function setupDataDirectory(): Promise<void> {
  try {
    const dataPath = path.join(process.cwd(), "data");

    if (!fs.existsSync(dataPath)) {
      logServer("Creating data directory...");
      fs.mkdirSync(dataPath, { recursive: true });
    }

    const csvPath = path.join(dataPath, "articles_dataset.csv");
    if (!fs.existsSync(csvPath)) {
      logServer("Creating example CSV file...");

      const exampleCsv = `url
https://www.bbc.com/news/articles/clyxypryrnko
`;

      fs.writeFileSync(csvPath, exampleCsv);
    }

    logServer("Data directory setup complete.");
  } catch (error: any) {
    logError("Data Setup", error);
    throw error;
  }
}
