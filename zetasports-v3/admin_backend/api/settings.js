import { handler } from '../netlify/functions/settings.js';
import { createVercelHandler } from './adapter.js';

export default createVercelHandler(handler);
