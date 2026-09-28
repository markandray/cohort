const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

let accessToken: string | null = null;

export function setAccessToken(token: string | null) {
  accessToken = token;
}

export function getAccessToken() {
  return accessToken;
}

async function refreshAccessToken(): Promise<string | null> {
  const res = await fetch(`${API_BASE_URL}/api/auth/refresh`, {
    method: 'POST',
    credentials: 'include', // sends the httpOnly refresh cookie
  });

  if (!res.ok) {
    setAccessToken(null);
    return null;
  }

  const data = await res.json();
  setAccessToken(data.accessToken);
  return data.accessToken;
}

interface ApiFetchOptions extends RequestInit {
  skipAuth?: boolean;
}

export async function apiFetch(path: string, options: ApiFetchOptions = {}) {
  const { skipAuth, headers, ...rest } = options;

  function buildHeaders(token: string | null) {
    return {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    };
  }

  let res = await fetch(`${API_BASE_URL}${path}`, {
    ...rest,
    headers: buildHeaders(skipAuth ? null : accessToken),
    credentials: 'include',
  });

  // Access token expired mid-session — refresh once and retry.
  if (res.status === 401 && !skipAuth) {
    const newToken = await refreshAccessToken();
    if (newToken) {
      res = await fetch(`${API_BASE_URL}${path}`, {
        ...rest,
        headers: buildHeaders(newToken),
        credentials: 'include',
      });
    }
  }

  return res;
}

export { refreshAccessToken };