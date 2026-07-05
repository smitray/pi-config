import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { HooksConfig } from '../types/schema';

const CONFIG_FILE = 'hooks.json';
const __dirname = dirname(fileURLToPath(import.meta.url));
const configPath = join(__dirname, '..', CONFIG_FILE);

/**
 * Load hooks config from `hooks.json`, falling back to empty array.
 *
 * ponytail: single JSON file instead of a config schema registry.
 * User edits hooks.json, restarts session. That's it.
 */
export function loadConfig(): HooksConfig {
  try {
    if (!existsSync(configPath)) return [];
    const raw = readFileSync(configPath, 'utf-8');
    const parsed = JSON.parse(raw);

    // Validate it's an array of HooksGroup
    if (!Array.isArray(parsed)) {
      console.warn(
        `[hooks] ${CONFIG_FILE}: expected array, got ${typeof parsed}. Using empty config.`
      );
      return [];
    }

    return parsed as HooksConfig;
  } catch (err) {
    console.warn(`[hooks] Failed to load ${CONFIG_FILE}: ${err}. Using empty config.`);
    return [];
  }
}
