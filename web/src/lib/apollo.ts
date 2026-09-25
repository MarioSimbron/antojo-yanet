/**
 * Apollo Client configuration for the GraphQL API.
 * @author Mario Simbron Gonzalez <simbron420@gmail.com>
 */
import { ApolloClient, InMemoryCache, createHttpLink } from '@apollo/client';
import { setContext } from '@apollo/client/link/context';

/**
 * HTTP link pointing to VITE_API_URL (default http://localhost:4000/graphql).
 * @author Mario Simbron Gonzalez <simbron420@gmail.com>
 */
const httpLink = createHttpLink({
  uri: import.meta.env.VITE_API_URL ?? 'http://localhost:4000/graphql',
});

/**
 * Context link that adds the `Authorization: Bearer` and `X-Guest-Token` headers from
 * localStorage to every request.
 * @author Mario Simbron Gonzalez <simbron420@gmail.com>
 * @param {unknown} _ - GraphQL operation (unused).
 * @param {{ headers: Record<string, string> }} prevContext - Previous context with headers.
 * @returns {{ headers: Record<string, string> }} The context with auth headers added.
 */
const authLink = setContext((_, { headers }) => {
  const token = localStorage.getItem('accessToken');
  const guestToken = localStorage.getItem('guestToken');
  return {
    headers: {
      ...headers,
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(guestToken ? { 'x-guest-token': guestToken } : {}),
    },
  };
});

/**
 * Shared Apollo Client instance with an in-memory cache.
 * @author Mario Simbron Gonzalez <simbron420@gmail.com>
 */
export const client = new ApolloClient({
  link: authLink.concat(httpLink),
  cache: new InMemoryCache(),
});
