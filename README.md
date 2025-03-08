# News Article Agent with RAG

A Node.js-based query-response application that integrates with OpenAI to create a Retrieval-Augmented Generation (RAG) system using FAISS as a vector database. The application ingests news article links, extracts and cleans the content, and provides answers to user queries about news events.

## Features

- **Real-time Data Ingestion**: Consumes news article links from Kafka with CSV fallback
- **Content Extraction and Cleaning**: Uses web scraping and LLM-based cleaning to structure article data
- **Vector Database Storage**: Stores article embeddings in FAISS for semantic search
- **Dual API Interfaces**: Both RESTful and GraphQL API endpoints to process natural language queries
- **Article Summarization**: Can summarize articles from provided links
- **Professional Logging System**: Structured, configurable logging with rotation and different log levels

## Architecture

The system follows a modular architecture with the following components:

1. **Data Ingestion Layer**: Kafka consumer with CSV fallback
2. **Content Processing Layer**: Content extraction, cleaning, and structuring using OpenAI
3. **Vector Database Layer**: FAISS for storing and retrieving article embeddings
4. **Query Processing Layer**: LLM-powered query understanding and response generation
5. **API Layer**: Express REST API and GraphQL with Yoga
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

### Installation

1. Clone the repository
2. Install dependencies: `npm install`
3. Start the development server: `npm run dev`

## API Usage

### REST API

Use the following endpoints:

- `POST /agent/query`: Submit a natural language query
- `POST /agent/ingest`: Ingest a new article URL
- `POST /agent/summarize`: Generate a summary for an article

### GraphQL API

Access the GraphQL API at `/graphql`. The GraphiQL playground is available in development mode.

Example queries:

```graphql
# Get an answer to a query
query {
  answerQuery(query: "What happened in the recent election?") {
    answer
    sources {
      id
      url
      title
    }
  }
}

# Search for articles
query {
  searchArticles(term: "climate change", limit: 5) {
    id
    title
    url
    summary
  }
}

# Ingest a new article
mutation {
  ingestArticle(url: "https://example.com/article") {
    id
    title
    url
  }
}
```

## Performance Optimization Techniques

This application implements several optimization techniques to improve quality, cost, and response time:

### Response Time Optimization

1. **Query Batching**: The GraphQL Yoga server is configured with batching enabled, allowing multiple operations to be processed in a single request, reducing network overhead.

2. **Performance Monitoring**: Automatic tracking of query execution time with alerts for slow-performing queries to identify bottlenecks.

3. **Vector Index Optimization**: FAISS vector database is configured for efficient similarity search, balancing accuracy and speed.

4. **Caching Layer**: Common queries and responses are cached to reduce repeated processing and database lookups.

5. **Request Pipelining**: Multiple steps in the query process are executed in parallel when possible, reducing total response time.

### Cost Optimization

1. **Selective Embedding Generation**: Only relevant portions of articles are embedded, reducing OpenAI API token usage.

2. **Tiered Query Processing**: Simple queries are processed without calling the LLM, using vector search only when appropriate.

3. **Content Preprocessing**: News articles are cleaned and processed before being sent to the OpenAI API, reducing token usage.

4. **Streaming Responses**: For long-form content generation, streaming responses are used to reduce unused token generation.

5. **Query Optimization**: GraphQL resolvers are designed to fetch only required data, avoiding over-fetching.

### Quality Improvement

1. **Context-Aware Query Processing**: The system analyzes queries to determine the appropriate context window and relevant articles.

2. **Source Citation**: All answers include citations to the original news sources, improving transparency and reliability.

3. **Error Recovery**: The system has fallback mechanisms when primary data sources fail, ensuring service continuity.

4. **Structured Query Processing**: Complex queries are broken down into sub-queries for more accurate responses.

5. **Continuous Monitoring**: Query performance and accuracy metrics are logged for ongoing improvement.

## License

ISC
