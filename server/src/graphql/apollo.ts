import { ApolloServer } from '@apollo/server';
import { typeDefs } from './typeDefs';
import { resolvers, GraphQLContext } from './resolvers';

export const apolloServer = new ApolloServer<GraphQLContext>({
  typeDefs,
  resolvers,
});

let startPromise: Promise<void> | null = null;

export function ensureApolloStarted(): Promise<void> {
  if (!startPromise) {
    startPromise = apolloServer.start();
  }
  return startPromise;
}