import { apiFetch } from './api-client';

interface GraphQLResponse<T> {
  data?: T;
  errors?: Array<{ message: string }>;
}

export async function gqlFetch<T = any>(
  query: string,
  variables?: Record<string, any>
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