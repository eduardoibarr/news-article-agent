import { Router } from "express";
import { handleQuery } from "../controllers/agentController";

const router = Router();

router.get("/", (req, res) => {
  res.status(200).json({
    info: "News Article Agent API",
    version: "1.0.0",
    endpoints: {
      "/agent": {
        method: "POST",
        description: "Process a query and return a response",
        requestBody: {
          query: "String - Your question or query about news",
        },
        examples: [
          "Tell me the latest news about Justin Trudeau",
          "What do you know about LA fires?",
          "Summarize this article: https://www.bbc.com/news/world-us-canada-67809999",
        ],
      },
    },
  });
});

router.post("/", handleQuery);

export default router;
