import { apiFetch } from './api-client';

interface GraphQLResponse<T> {
  data?: T;
  errors?: Array<{ message: string }>;
}

// Callers should pass the response shape explicitly, e.g.
// gqlFetch<{ dashboard: Dashboard }>(QUERY). The default is `unknown`
// so an unspecified call site can't silently treat the result as `any`.
export async function gqlFetch<T = unknown>(
  query: string,
  variables?: Record<string, unknown>
): Promise<T> {
  const res = await apiFetch('/api/graphql', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables }),
  });

  const json: GraphQLResponse<T> = await res.json();

  if (json.errors && json.errors.length > 0) {
    throw new Error(json.errors[0].message);
  }

  if (!json.data) {
    throw new Error('No data returned from GraphQL query');
  }

  return json.data;
}