export const typeDefs = `
  type Article {
    id: ID!
    url: String!
    title: String!
    content: String!
    summary: String
    publishedAt: String
    source: String
    createdAt: String!
  }

  type Answer {
    answer: String!
    sources: [ArticleSource!]!
  }

  type ArticleSource {
    id: ID!
    url: String!
    title: String
  }

  type SummaryResult {
    summary: String!
    url: String!
  }

  type Query {
    # Get answer for a natural language query
    answerQuery(query: String!): Answer!
    
    # Get articles matching a search term
    searchArticles(term: String!, limit: Int): [Article!]!
    
    # Get an article by ID
    getArticle(id: ID!): Article
  }

  type Mutation {
    # Process and index a new article from URL
    ingestArticle(url: String!): Article
    
    # Generate a summary for an article
    summarizeArticle(url: String!): SummaryResult
  }
`;
