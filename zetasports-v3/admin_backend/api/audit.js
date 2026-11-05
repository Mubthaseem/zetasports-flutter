import { handler } from '../netlify/functions/audit.js';
import { createVercelHandler } from './adapter.js';

export default createVercelHandler(handler);
