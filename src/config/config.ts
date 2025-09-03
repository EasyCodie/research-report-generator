import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables
dotenv.config({ path: path.join(process.cwd(), '.env') });

export interface AppConfig {
  google: {
    cseId: string;
    apiKey: string;
  };
  github: {
    token: string;
  };
  bing?: {
    apiKey?: string;
  };
  server: {
    port: number;
    env: string;
  };
  storage: {
    cacheDbPath: string;
    reportsDir: string;
  };
  rateLimit: {
    global: number;
    perDomain: number;
  };
  timeouts: {
    request: number;
    scrape: number;
  };
  concurrency: {
    maxSearches: number;
    maxScrapes: number;
  };
}

class ConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConfigurationError';
  }
}

function getRequiredEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new ConfigurationError(`Missing required environment variable: ${key}`);
  }
  return value;
}

function getOptionalEnv(key: string, defaultValue: string): string {
  return process.env[key] || defaultValue;
}

function getNumberEnv(key: string, defaultValue: number): number {
  const value = process.env[key];
  if (!value) return defaultValue;
  const parsed = parseInt(value, 10);
  if (isNaN(parsed)) {
    console.warn(`Invalid number for ${key}: ${value}, using default: ${defaultValue}`);
    return defaultValue;
  }
  return parsed;
}

// Create and validate configuration
export const config: AppConfig = {
  google: {
    cseId: getRequiredEnv('GOOGLE_CSE_ID'),
    apiKey: getRequiredEnv('GOOGLE_API_KEY'),
  },
  github: {
    token: getRequiredEnv('GITHUB_TOKEN'),
  },
  bing: {
    apiKey: process.env.BING_API_KEY, // Optional
  },
  server: {
    port: getNumberEnv('PORT', 3000),
    env: getOptionalEnv('NODE_ENV', 'development'),
  },
  storage: {
    cacheDbPath: getOptionalEnv('CACHE_DB_PATH', '.data/cache.sqlite'),
    reportsDir: getOptionalEnv('REPORTS_DIR', 'reports'),
  },
  rateLimit: {
    global: getNumberEnv('RATE_LIMIT_GLOBAL', 10),
    perDomain: getNumberEnv('RATE_LIMIT_PER_DOMAIN', 2),
  },
  timeouts: {
    request: getNumberEnv('REQUEST_TIMEOUT', 30000),
    scrape: getNumberEnv('SCRAPE_TIMEOUT', 60000),
  },
  concurrency: {
    maxSearches: getNumberEnv('MAX_CONCURRENT_SEARCHES', 3),
    maxScrapes: getNumberEnv('MAX_CONCURRENT_SCRAPES', 5),
  },
};

// Validate configuration on module load
try {
  console.log('Configuration loaded successfully');
  console.log(`Google CSE ID: ${config.google.cseId.substring(0, 6)}...`);
  console.log(`GitHub Token: ${config.github.token.substring(0, 6)}...`);
} catch (error) {
  if (error instanceof ConfigurationError) {
    console.error(`Configuration Error: ${error.message}`);
    console.error('Please check your .env file and ensure all required variables are set.');
    process.exit(1);
  }
  throw error;
}

export default config;
