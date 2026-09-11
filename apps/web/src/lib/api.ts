export class ApiError extends Error {
  status: number;
  data: unknown;

  constructor(message: string, status: number, data?: unknown) {
    super(message);
    this.status = status;
    this.data = data;
    this.name = 'ApiError';
  }
}

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';

interface ApiResponse<T> {
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
}

/**
 * A centralized fetch wrapper to communicate with the ForgeBoard API.
 * Automatically includes credentials (cookies) to support the existing session architecture.
 */
export async function apiFetch<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;
  
  const headers = new Headers(options.headers);
  if (!headers.has('Content-Type') && options.body && typeof options.body === 'string') {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(url, {
    ...options,
    headers,
    credentials: 'include', // Crucial for backend cookie-based auth
  });

  let parsed: ApiResponse<T> = {};
  try {
    const text = await response.text();
    if (text) {
      parsed = JSON.parse(text);
    }
  } catch {
    parsed = {};
  }

  if (!response.ok) {
    // Extract the backend error envelope correctly
    const message = parsed.error?.message || response.statusText || 'An API error occurred';
    throw new ApiError(message, response.status, parsed.error);
  }

  // The backend wraps most responses in a { data: ... } envelope,
  // while some controllers return top-level objects (e.g. { projects: [...] }).
  return (parsed.data !== undefined ? parsed.data : parsed) as T;
}
