/**
 * Apollo Client configuration for the GraphQL API. Includes an error link that
 * automatically refreshes an expired access token and retries the failed operation.
 * When the refresh itself fails, the error is propagated to the caller so components
 * with error handlers (e.g. Snackbar) can surface feedback to the user.
 * @author Mario Simbron Gonzalez <simbron420@gmail.com>
 */
import { ApolloClient, InMemoryCache, Observable, createHttpLink } from '@apollo/client';
import { setContext } from '@apollo/client/link/context';
import { onError } from '@apollo/client/link/error';
import { useAuthStore } from '../store/auth.store';

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:4000/graphql';

/**
 * HTTP link pointing to VITE_API_URL (default http://localhost:4000/graphql).
 * @author Mario Simbron Gonzalez <simbron420@gmail.com>
 */
const httpLink = createHttpLink({ uri: API_URL });

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
 * Calls the refreshToken mutation directly via fetch (bypasses Apollo to avoid circular
 * dependency) using the stored refresh token. On success updates the auth store and
 * returns the new access token; on failure logs the user out and returns null.
 * @author Mario Simbron Gonzalez <simbron420@gmail.com>
 * @returns {Promise<string | null>} The new access token, or null if refresh failed.
 */
async function tryRefreshToken(): Promise<string | null> {
  const { refreshToken, login, logout } = useAuthStore.getState();
  if (!refreshToken) {
    logout();
    return null;
  }
  try {
    const res = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `mutation Refresh($t: String!) { refreshToken(token: $t) {
          accessToken refreshToken
          usuario { id nombre email rol puntosSaldo }
        }}`,
        variables: { t: refreshToken },
      }),
    });
    const json: { data?: { refreshToken?: { accessToken: string; refreshToken: string; usuario: { id: number; nombre: string; email: string; rol: string; puntosSaldo: number } } } } = await res.json();
    const payload = json?.data?.refreshToken;
    if (!payload) {
      logout();
      return null;
    }
    login({ usuario: payload.usuario, accessToken: payload.accessToken, refreshToken: payload.refreshToken });
    return payload.accessToken;
  } catch {
    logout();
    return null;
  }
}

/** Deduplicates concurrent refresh calls so only one in-flight request runs at a time. */
let activeRefresh: Promise<string | null> | null = null;

/**
 * Error link: intercepts UNAUTHENTICATED GraphQL errors, attempts a silent token
 * refresh and retries the original operation with the new access token. If the refresh
 * fails the user is logged out and the operation completes without a retry.
 * @author Mario Simbron Gonzalez <simbron420@gmail.com>
 */
const errorLink = onError(({ graphQLErrors, operation, forward }) => {
  const isUnauthenticated = graphQLErrors?.some(
    (e) => e.extensions?.code === 'UNAUTHENTICATED',
  );
  if (!isUnauthenticated) return;

  return new Observable((observer) => {
    if (!activeRefresh) {
      activeRefresh = tryRefreshToken().finally(() => {
        activeRefresh = null;
      });
    }

    activeRefresh.then((newToken) => {
      if (!newToken) {
        // Refresh failed — user is already logged out via logout() inside tryRefreshToken.
        // Propagate an error so components with Snackbars can surface feedback.
        observer.error(new Error('SESSION_EXPIRED'));
        return;
      }
      // Attach the fresh token to the retried operation
      operation.setContext(({ headers = {} }: { headers: Record<string, string> }) => ({
        headers: {
          ...headers,
          authorization: `Bearer ${newToken}`,
        },
      }));
      forward(operation).subscribe({
        next: observer.next.bind(observer),
        error: observer.error.bind(observer),
        complete: observer.complete.bind(observer),
      });
    }).catch((err: unknown) => observer.error(err instanceof Error ? err : new Error('Network error')));
  });
});

/**
 * Shared Apollo Client instance: errorLink → authLink → httpLink.
 * @author Mario Simbron Gonzalez <simbron420@gmail.com>
 */
export const client = new ApolloClient({
  link: errorLink.concat(authLink).concat(httpLink),
  cache: new InMemoryCache(),
});
