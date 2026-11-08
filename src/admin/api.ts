/**
 * Admin API client. Same-origin; Cloudflare Access supplies the session cookie.
 * An expired Access session answers with a redirect to the login page, which
 * `redirect: 'manual'` turns into an opaque response → sessionExpired.
 */

export interface IssueDetail {
  path: string;
  message: string;
}

export class ApiFailure extends Error {
  constructor(
    message: string,
    public status: number,
    public details?: IssueDetail[],
    public sessionExpired = false,
  ) {
    super(message);
  }
}

type Listener = () => void;
const sessionListeners = new Set<Listener>();
export const onSessionExpired = (fn: Listener) => {
  sessionListeners.add(fn);
  return () => sessionListeners.delete(fn);
};

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const headers: Record<string, string> = {};
  const init: RequestInit = { method, credentials: 'same-origin', redirect: 'manual', headers };
  if (body instanceof FormData) {
    init.body = body;
  } else if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    init.body = JSON.stringify(body);
  }

  let res: Response;
  try {
    res = await fetch(`/api/admin${path}`, init);
  } catch {
    throw new ApiFailure('Sunucuya ulaşılamadı. Bağlantınızı kontrol edin.', 0);
  }

  if (res.type === 'opaqueredirect' || res.status === 401) {
    sessionListeners.forEach((fn) => fn());
    throw new ApiFailure('Oturum süresi doldu. Sayfayı yenileyip tekrar giriş yapın.', 401, undefined, true);
  }

  const json = (await res.json().catch(() => null)) as
    | { ok: true; data: T }
    | { ok: false; error: string; details?: IssueDetail[] }
    | null;

  if (!res.ok || !json || !json.ok) {
    const err = json && !json.ok ? json : null;
    throw new ApiFailure(err?.error ?? `HTTP ${res.status}`, res.status, err?.details);
  }
  return json.data;
}

export const api = {
  get: <T>(path: string) => request<T>('GET', path),
  post: <T>(path: string, body: unknown) => request<T>('POST', path, body),
  put: <T>(path: string, body: unknown) => request<T>('PUT', path, body),
  del: <T = { id: number }>(path: string) => request<T>('DELETE', path),
};
