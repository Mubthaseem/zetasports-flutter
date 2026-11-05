import { handler } from '../netlify/functions/blogger.js';
import { createVercelHandler } from './adapter.js';

export default createVercelHandler(handler);
