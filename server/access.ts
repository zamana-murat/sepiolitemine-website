/**
 * Cloudflare Access guard (defence in depth).
 *
 * Access already blocks unauthenticated requests at the edge for /admin/* and /api/admin/*.
 * This middleware additionally verifies the signed JWT Access injects, so a misconfigured
 * Access policy can never expose the admin API. Fails closed when not configured.
 */
import { createMiddleware } from 'hono/factory';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import type { AppEnv } from './env';

const jwksByIssuer = new Map<string, ReturnType<typeof createRemoteJWKSet>>();

function jwksFor(issuer: string) {
  let jwks = jwksByIssuer.get(issuer);
  if (!jwks) {
    jwks = createRemoteJWKSet(new URL(`${issuer}/cdn-cgi/access/certs`));
    jwksByIssuer.set(issuer, jwks);
  }
  return jwks;
}

export const requireAccess = createMiddleware<AppEnv>(async (c, next) => {
  const { ACCESS_TEAM_DOMAIN: team, ACCESS_AUD: aud, ACCESS_DEV_BYPASS: bypass } = c.env;

  const host = new URL(c.req.url).hostname;
  if (bypass === 'true' && (host === 'localhost' || host === '127.0.0.1')) {
    c.set('adminEmail', 'dev@localhost');
    return next();
  }

  if (!team || !aud) {
    return c.json({ ok: false, error: 'Admin access is not configured' }, 503);
  }

  const token = c.req.header('Cf-Access-Jwt-Assertion');
  if (!token) return c.json({ ok: false, error: 'Unauthorized' }, 401);

  const issuer = `https://${team}`;
  try {
    const { payload } = await jwtVerify(token, jwksFor(issuer), { issuer, audience: aud });
    c.set('adminEmail', typeof payload.email === 'string' ? payload.email : '');
  } catch {
    return c.json({ ok: false, error: 'Unauthorized' }, 401);
  }

  return next();
});
