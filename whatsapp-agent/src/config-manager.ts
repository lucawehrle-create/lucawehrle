import { readFileSync, writeFileSync, existsSync } from 'fs';
import { EventEmitter } from 'events';
import type { Config } from './config.js';
import { loadConfig } from './config.js';

const CONFIG_FILE = 'config.json';

export type ConfigUpdate = Partial<Omit<Config, 'anthropicApiKey'>>;

export class ConfigManager extends EventEmitter {
  private config: Config;

  constructor() {
    super();
    this.config = loadConfig();

    // Gespeicherte Overrides laden
    if (existsSync(CONFIG_FILE)) {
      try {
        const saved = JSON.parse(readFileSync(CONFIG_FILE, 'utf-8'));
        this.config = { ...this.config, ...saved, anthropicApiKey: this.config.anthropicApiKey };
      } catch (error) {
        console.warn('config.json konnte nicht geladen werden, nutze Defaults:', error);
      }
    }
  }

  get(): Config {
    return { ...this.config };
  }

  update(changes: ConfigUpdate): Config {
    this.config = { ...this.config, ...changes };
    this.save();
    this.emit('change', this.config);
    return this.get();
  }

  private save(): void {
    const { anthropicApiKey, ...safeConfig } = this.config;
    writeFileSync(CONFIG_FILE, JSON.stringify(safeConfig, null, 2), 'utf-8');
  }
}
