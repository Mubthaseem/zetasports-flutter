import { handler } from '../netlify/functions/auth.js';
import { createVercelHandler } from './adapter.js';

export default createVercelHandler(handler);
