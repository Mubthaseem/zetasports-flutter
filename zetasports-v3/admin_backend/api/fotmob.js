import { handler } from '../netlify/functions/fotmob.js';
import { createVercelHandler } from './adapter.js';

export default createVercelHandler(handler);
