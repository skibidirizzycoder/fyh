// headline.ts — Netlify Function wrapper for /api/headline.
// Set SNOWFLAKE_ACCOUNT and SNOWFLAKE_TOKEN in Netlify: Site settings -> Environment variables.
import { handleHeadline } from '../../server/headline.ts';

export default (req: Request): Promise<Response> => handleHeadline(req);

export const config = { path: '/api/headline' };
