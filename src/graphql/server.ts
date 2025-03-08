import { createYoga } from "graphql-yoga";
import { makeExecutableSchema } from "@graphql-tools/schema";
import { typeDefs } from "./schema";
import { resolvers } from "./resolvers";

export const createYogaServer = () => {
  const schema = makeExecutableSchema({
    typeDefs,
    resolvers,
  });

  return createYoga({
    schema,
    graphiql: process.env.NODE_ENV !== "production",
    cors: true,
  });
};
