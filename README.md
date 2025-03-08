# News Article Agent with RAG

A Node.js-based query-response application that integrates with OpenAI to create a Retrieval-Augmented Generation (RAG) system using FAISS as a vector database. The application ingests news article links, extracts and cleans the content, and provides answers to user queries about news events.

## Features

- **Real-time Data Ingestion**: Consumes news article links from Kafka with CSV fallback
- **Content Extraction and Cleaning**: Uses web scraping and LLM-based cleaning to structure article data
- **Vector Database Storage**: Stores article embeddings in FAISS for semantic search
- **Query-Response Interface**: RESTful API endpoint to process natural language queries
- **Article Summarization**: Can summarize articles from provided links
- **Professional Logging System**: Structured, configurable logging with rotation and different log levels

## Architecture

The system follows a modular architecture with the following components:

1. **Data Ingestion Layer**: Kafka consumer with CSV fallback
2. **Content Processing Layer**: Content extraction, cleaning, and structuring using OpenAI
3. **Vector Database Layer**: FAISS for storing and retrieving article embeddings
4. **Query Processing Layer**: LLM-powered query understanding and response generation
5. **API Layer**: Express REST API endpoints
6. **Logging Layer**: Winston-based structured logging system with different transports

## Getting Started

### Prerequisites

- Node.js 18.x or higher
- Docker and Docker Compose (optional, for containerized deployment)
- OpenAI API key

### Environment Setup

Create a `.env` file in the root directory with the following variables:

```
# Server
PORT=3000

# Kafka Configuration
KAFKA_BROKER="your-kafka-broker"
KAFKA_USERNAME="your-kafka-username"
KAFKA_PASSWORD="your-kafka-password"
KAFKA_TOPIC_NAME="your-kafka-topic"
KAFKA_GROUP_ID_PREFIX="your-kafka-group-id"

# OpenAI API
OPENAI_API_KEY="your-openai-api-key"

# Logging Configuration
LOG_LEVEL=info
LOG_FORMAT=text # json or text
LOG_CONSOLE_IN_PRODUCTION=true

# Context-specific Log Levels
LOG_LEVEL_DATABASE=info
LOG_LEVEL_API=http
LOG_LEVEL_SERVER=info
LOG_LEVEL_AGENT=debug
LOG_LEVEL_KAFKA=info
```
