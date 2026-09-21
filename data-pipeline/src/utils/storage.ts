import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class DataStorage {
  private baseDir: string;

  constructor(baseDir?: string) {
    if (baseDir) {
      this.baseDir = baseDir;
    } else {
      // Robust detection whether invoked from repo root or inside data-pipeline/
      const candidates = [
        path.resolve(process.cwd(), 'data'),
        path.resolve(process.cwd(), '../data'),
        path.resolve(__dirname, '../../../data'),
        path.resolve(__dirname, '../../data')
      ];
      this.baseDir = candidates.find(c => fs.existsSync(c)) || path.resolve(process.cwd(), 'data');
    }
  }

  public getBasePath(): string {
    return this.baseDir;
  }

  public resolvePath(relPath: string): string {
    return path.join(this.baseDir, relPath);
  }

  /**
   * Atomically writes JSON to disk: writes to temp file first then renames.
   */
  public async writeJson<T>(relPath: string, data: T): Promise<void> {
    const fullPath = this.resolvePath(relPath);
    const dir = path.dirname(fullPath);

    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const tmpPath = `${fullPath}.tmp.${Date.now()}.${Math.random().toString(36).slice(2, 6)}`;
    const jsonString = JSON.stringify(data, null, 2);

    // Validate that it serializes correctly and is not empty
    if (!jsonString || jsonString.length < 2) {
      throw new Error(`Data for ${relPath} resulted in empty JSON.`);
    }

    fs.writeFileSync(tmpPath, jsonString, 'utf8');
    fs.renameSync(tmpPath, fullPath);
  }

  /**
   * Safely reads JSON from disk. Returns null if file doesn't exist.
   */
  public readJson<T>(relPath: string): T | null {
    const fullPath = this.resolvePath(relPath);
    if (!fs.existsSync(fullPath)) {
      return null;
    }
    try {
      const content = fs.readFileSync(fullPath, 'utf8');
      return JSON.parse(content) as T;
    } catch (e) {
      console.warn(`[DataStorage] Failed to read/parse ${relPath}:`, e);
      return null;
    }
  }

  /**
   * Lists all files in a relative directory
   */
  public listFiles(relDir: string): string[] {
    const fullDir = this.resolvePath(relDir);
    if (!fs.existsSync(fullDir)) {
      return [];
    }
    return fs.readdirSync(fullDir);
  }
}
