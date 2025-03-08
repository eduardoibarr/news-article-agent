# News Article Agent with RAG

A Node.js-based query-response application that integrates with OpenAI to create a Retrieval-Augmented Generation (RAG) system using FAISS as a vector database. The application ingests news article links, extracts and cleans the content, and provides answers to user queries about news events.

## Features

- **Real-time Data Ingestion**: Consumes news article links from Kafka with CSV fallback
- **Content Extraction and Cleaning**: Uses web scraping and LLM-based cleaning to structure article data
- **Vector Database Storage**: Stores article embeddings in FAISS for semantic search
- **Dual API Interfaces**: Both RESTful and GraphQL API endpoints to process natural language queries
- **Article Summarization**: Dedicated endpoint to summarize articles from provided links
- **Response Streaming**: Real-time token-by-token streaming for faster perceived response time
- **Professional Logging System**: Structured, configurable logging with rotation and different log levels
- **Standardized Response Format**: Consistent response structure with source attribution

## Architecture

The system follows a modular architecture with the following components:

1. **Data Ingestion Layer**: Kafka consumer with CSV fallback
2. **Content Processing Layer**: Content extraction, cleaning, and structuring using OpenAI
3. **Vector Database Layer**: FAISS for storing and retrieving article embeddings
4. **Query Processing Layer**: LLM-powered query understanding and response generation
5. **API Layer**: Express REST API and GraphQL with Yoga
6. **Streaming Layer**: Server-sent events (SSE) for real-time response streaming
7. **Logging Layer**: Winston-based structured logging system with different transports

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

The API includes the following endpoints:

#### Query Endpoint

```
POST /agent
```

This is the main endpoint for processing natural language queries about news articles.

**Request Format:**

```json
{
  "query": "Tell me the latest news about Justin Trudeau"
}
```

**Response Format:**

```json
{
  "answer": "Based on recent news, Justin Trudeau...",
  "sources": [
    {
      "title": "Trudeau announces new climate policy",
      "url": "https://example.com/news/trudeau-policy",
      "date": "2023-09-15T14:30:00Z"
    }
  ]
}
```

#### Summarization Endpoint

```
POST /summarize
```

Dedicated endpoint for summarizing a specific article URL.

**Request Format:**

```json
{
  "url": "https://www.bbc.com/news/articles/clyxypryrnko"
}
```

**Response Format:**

```json
{
  "answer": "This article discusses the recent developments in...",
  "sources": [
    {
      "title": "LA wildfires: What's happening and how they started",
      "url": "https://www.bbc.com/news/articles/clyxypryrnko",
      "date": "2023-09-14T10:15:00Z"
    }
  ]
}
```

#### Streaming Support

All endpoints support streaming responses for improved user experience. To enable streaming:

1. Add the `accept-streaming: true` header to your request
2. Process the server-sent events (SSE) in your client

**Streaming Response Format:**

```
data: {"token":"Based"}
data: {"token":" on"}
data: {"token":" recent"}
...
data: {"complete":true,"answer":"Based on recent news...","sources":[...]}
```

Example client-side code for handling streaming:

```javascript
const eventSource = new EventSource("/agent/stream");
let responseText = "";

eventSource.onmessage = (event) => {
  const data = JSON.parse(event.data);

  if (data.token) {
    responseText += data.token;
    // Update UI with each token
    updateUI(responseText);
  }

  if (data.complete) {
    // Handle complete response with sources
    displaySources(data.sources);
    eventSource.close();
  }
};
```

### GraphQL API

Access the GraphQL API at `/graphql`. The GraphiQL playground is available in development mode.

Example queries:

```graphql
# Query for news information
query {
  answerQuery(query: "What happened in the recent election?") {
    answer
    sources {
      title
      url
      date
    }
  }
}

# Summarize an article
query {
  summarizeArticle(url: "https://www.bbc.com/news/world-us-canada-67809999") {
    answer
    sources {
      title
      url
      date
    }
  }
}

# Search for articles
query {
  searchArticles(term: "climate change", limit: 5) {
    title
    url
    date
  }
}
```

## Performance Optimization Techniques

This application implements several optimization techniques to improve quality, cost, and response time:

### Response Time Optimization

1. **Streaming Responses**: Token-by-token streaming provides immediate feedback to users, significantly reducing perceived latency while the full response is being generated.

2. **Query Batching**: The GraphQL Yoga server is configured with batching enabled, allowing multiple operations to be processed in a single request, reducing network overhead.

3. **Performance Monitoring**: Automatic tracking of query execution time with alerts for slow-performing queries to identify bottlenecks.

4. **Vector Index Optimization**: FAISS vector database is configured for efficient similarity search, balancing accuracy and speed.

5. **Caching Layer**: Common queries and responses are cached to reduce repeated processing and database lookups.

6. **Request Pipelining**: Multiple steps in the query process are executed in parallel when possible, reducing total response time.

### Cost Optimization

1. **Selective Embedding Generation**: Only relevant portions of articles are embedded, reducing OpenAI API token usage.

2. **Tiered Query Processing**: Simple queries are processed without calling the LLM, using vector search only when appropriate.

3. **Content Preprocessing**: News articles are cleaned and processed before being sent to the OpenAI API, reducing token usage.

4. **Streaming Responses**: By streaming, we can stop generation early if the user is satisfied or if an error occurs, saving token costs.

5. **Query Optimization**: GraphQL resolvers are designed to fetch only required data, avoiding over-fetching.

### Quality Improvement

1. **Context-Aware Query Processing**: The system analyzes queries to determine the appropriate context window and relevant articles.

2. **Source Citation**: All answers include standardized citations to the original news sources, improving transparency and reliability.

3. **Error Recovery**: The system has fallback mechanisms when primary data sources fail, ensuring service continuity.

4. **Structured Query Processing**: Complex queries are broken down into sub-queries for more accurate responses.

5. **Continuous Monitoring**: Query performance and accuracy metrics are logged for ongoing improvement.

6. **Consistent Response Format**: All responses follow a standardized format that includes attribution to sources, ensuring transparency and reliability.

## License

ISC
