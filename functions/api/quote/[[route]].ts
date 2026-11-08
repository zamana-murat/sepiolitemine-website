import { handle } from 'hono/cloudflare-pages';
import { publicApp } from '../../../server/public/app';

export const onRequest = handle(publicApp);
