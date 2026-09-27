/**
 * Apollo Client configuration for the GraphQL API. Includes an error link that
 * automatically refreshes an expired access token and retries the failed operation.
 * A retry-guard context flag prevents infinite refresh loops. When the refresh
 * itself fails the user is logged out; no error is propagated to the component
 * while a refresh/retry is in flight, so no UNAUTHENTICATED flash appears in the UI.
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
 * refresh and retries the original operation with the new access token.
 * - Already-retried operations are skipped (retry-guard via `x-auth-retry` context)
 *   to prevent infinite refresh loops.
 * - While refresh/retry is in flight no error reaches Apollo's error state, so the
 *   UI shows a loading state rather than a transient UNAUTHENTICATED flash.
 * - If the refresh fails the user is logged out silently (no error emitted).
 * @author Mario Simbron Gonzalez <simbron420@gmail.com>
 */
const errorLink = onError(({ graphQLErrors, operation, forward }) => {
  const isUnauthenticated = graphQLErrors?.some(
    (e) => e.extensions?.code === 'UNAUTHENTICATED',
  );
  if (!isUnauthenticated) return;

  // Skip operations that already went through a refresh-retry cycle to avoid loops.
  const { 'x-auth-retry': alreadyRetried } = operation.getContext() as { 'x-auth-retry'?: boolean };
  if (alreadyRetried) return;

  return new Observable((observer) => {
    if (!activeRefresh) {
      activeRefresh = tryRefreshToken().finally(() => {
        activeRefresh = null;
      });
    }

    activeRefresh.then((newToken) => {
      if (!newToken) {
        // Refresh failed — user already logged out inside tryRefreshToken. Complete
        // silently so components stay in loading state until the logout redirect fires.
        observer.complete();
        return;
      }
      // Attach the fresh token and mark the operation as retried.
      operation.setContext(({ headers = {} }: { headers: Record<string, string> }) => ({
        headers: { ...headers, authorization: `Bearer ${newToken}` },
        'x-auth-retry': true,
      }));
      forward(operation).subscribe({
        next: observer.next.bind(observer),
        error: observer.error.bind(observer),
        complete: observer.complete.bind(observer),
      });
    }).catch(() => {
      // Network-level error during refresh — complete silently, logout already fired.
      observer.complete();
    });
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
