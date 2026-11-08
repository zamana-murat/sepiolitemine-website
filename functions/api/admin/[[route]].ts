import { handle } from 'hono/cloudflare-pages';
import { adminApp } from '../../../server/admin/app';

export const onRequest = handle(adminApp);
