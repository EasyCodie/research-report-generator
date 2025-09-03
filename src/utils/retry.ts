/**
 * Retry utility with exponential backoff and configurable strategies
 * Provides resilient execution of operations that may fail temporarily
 */

export interface RetryOptions {
  maxAttempts?: number;
  initialDelayMs?: number;
  maxDelayMs?: number;
  backoffMultiplier?: number;
  jitter?: boolean;
  retryOn?: (error: any) => boolean;
  onRetry?: (attempt: number, error: any, nextDelayMs: number) => void;
  abortSignal?: AbortSignal;
}

export interface RetryResult<T> {
  success: boolean;
  result?: T;
  error?: any;
  attempts: number;
  totalTime: number;
}

export class RetryUtil {
  private static readonly DEFAULT_MAX_ATTEMPTS = 3;
  private static readonly DEFAULT_INITIAL_DELAY = 1000;
  private static readonly DEFAULT_MAX_DELAY = 30000;
  private static readonly DEFAULT_BACKOFF_MULTIPLIER = 2;

  /**
   * Execute a function with retry logic
   * @param fn - Async function to execute
   * @param options - Retry configuration options
   * @returns Promise with the result or final error
   */
  static async withRetry<T>(
    fn: () => Promise<T>,
    options: RetryOptions = {}
  ): Promise<T> {
    const {
      maxAttempts = this.DEFAULT_MAX_ATTEMPTS,
      initialDelayMs = this.DEFAULT_INITIAL_DELAY,
      maxDelayMs = this.DEFAULT_MAX_DELAY,
      backoffMultiplier = this.DEFAULT_BACKOFF_MULTIPLIER,
      jitter = true,
      retryOn = this.defaultRetryOn,
      onRetry,
      abortSignal
    } = options;

    let lastError: any;
    let currentDelay = initialDelayMs;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      // Check abort signal
      if (abortSignal?.aborted) {
        throw new Error('Operation aborted');
      }

      try {
        return await fn();
      } catch (error) {
        lastError = error;

        // Check if we should retry
        if (attempt === maxAttempts || !retryOn(error)) {
          throw error;
        }

        // Calculate next delay with exponential backoff
        const baseDelay = Math.min(currentDelay, maxDelayMs);
        const actualDelay = jitter ? this.addJitter(baseDelay) : baseDelay;

        // Notify about retry
        if (onRetry) {
          onRetry(attempt, error, actualDelay);
        }

        // Wait before next attempt
        await this.delay(actualDelay);

        // Increase delay for next attempt
        currentDelay = Math.min(currentDelay * backoffMultiplier, maxDelayMs);
      }
    }

    throw lastError;
  }

  /**
   * Execute a function with detailed retry tracking
   * @param fn - Async function to execute
   * @param options - Retry configuration options
   * @returns Detailed result with success status and metadata
   */
  static async withRetryTracking<T>(
    fn: () => Promise<T>,
    options: RetryOptions = {}
  ): Promise<RetryResult<T>> {
    const startTime = Date.now();
    let attempts = 0;

    try {
      const result = await this.withRetry(
        async () => {
          attempts++;
          return await fn();
        },
        {
          ...options,
          onRetry: (attempt, error, delay) => {
            if (options.onRetry) {
              options.onRetry(attempt, error, delay);
            }
          }
        }
      );

      return {
        success: true,
        result,
        attempts,
        totalTime: Date.now() - startTime
      };
    } catch (error) {
      return {
        success: false,
        error,
        attempts,
        totalTime: Date.now() - startTime
      };
    }
  }

  /**
   * Retry with circuit breaker pattern
   * @param fn - Async function to execute
   * @param options - Retry configuration options
   * @param circuitOptions - Circuit breaker configuration
   * @returns Promise with the result
   */
  static async withCircuitBreaker<T>(
    fn: () => Promise<T>,
    options: RetryOptions = {},
    circuitOptions: {
      failureThreshold?: number;
      resetTimeMs?: number;
      halfOpenRequests?: number;
    } = {}
  ): Promise<T> {
    const {
      failureThreshold = 5,
      resetTimeMs = 60000,
      halfOpenRequests = 1
    } = circuitOptions;

    // Simple circuit breaker implementation
    const circuitState = this.getCircuitState(fn.toString());
    
    if (circuitState.state === 'open') {
      if (Date.now() - circuitState.lastFailureTime < resetTimeMs) {
        throw new Error('Circuit breaker is open');
      }
      // Move to half-open state
      circuitState.state = 'half-open';
      circuitState.halfOpenAttempts = 0;
    }

    if (circuitState.state === 'half-open' && circuitState.halfOpenAttempts >= halfOpenRequests) {
      throw new Error('Circuit breaker is half-open, max attempts reached');
    }

    try {
      const result = await this.withRetry(fn, options);
      
      // Success - reset circuit
      if (circuitState.state === 'half-open' || circuitState.consecutiveFailures > 0) {
        circuitState.state = 'closed';
        circuitState.consecutiveFailures = 0;
        circuitState.halfOpenAttempts = 0;
      }
      
      return result;
    } catch (error) {
      // Failure - update circuit state
      circuitState.consecutiveFailures++;
      circuitState.lastFailureTime = Date.now();
      
      if (circuitState.state === 'half-open') {
        circuitState.halfOpenAttempts++;
      }
      
      if (circuitState.consecutiveFailures >= failureThreshold) {
        circuitState.state = 'open';
      }
      
      throw error;
    }
  }

  /**
   * Execute multiple operations with retry in parallel
   * @param operations - Array of async functions to execute
   * @param options - Retry configuration options
   * @returns Array of results
   */
  static async withRetryAll<T>(
    operations: Array<() => Promise<T>>,
    options: RetryOptions = {}
  ): Promise<T[]> {
    return Promise.all(
      operations.map(op => this.withRetry(op, options))
    );
  }

  /**
   * Execute multiple operations with retry, returning first success
   * @param operations - Array of async functions to execute
   * @param options - Retry configuration options
   * @returns First successful result
   */
  static async withRetryRace<T>(
    operations: Array<() => Promise<T>>,
    options: RetryOptions = {}
  ): Promise<T> {
    return Promise.race(
      operations.map(op => this.withRetry(op, options))
    );
  }

  /**
   * Simple delay function
   * @param ms - Milliseconds to delay
   * @returns Promise that resolves after delay
   */
  static delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Add random jitter to a delay value
   * @param delayMs - Base delay in milliseconds
   * @param jitterFactor - Jitter factor (0-1, default 0.3)
   * @returns Delay with jitter applied
   */
  private static addJitter(delayMs: number, jitterFactor: number = 0.3): number {
    const jitter = delayMs * jitterFactor * Math.random();
    return Math.round(delayMs + jitter - (delayMs * jitterFactor / 2));
  }

  /**
   * Default retry condition - retry on common transient errors
   * @param error - Error to check
   * @returns True if should retry
   */
  private static defaultRetryOn(error: any): boolean {
    // Network errors
    if (error.code === 'ECONNREFUSED' || 
        error.code === 'ETIMEDOUT' || 
        error.code === 'ENOTFOUND' ||
        error.code === 'ECONNRESET') {
      return true;
    }

    // HTTP status codes that are retryable
    if (error.response?.status) {
      const status = error.response.status;
      // Rate limiting, server errors, timeout
      return status === 429 || status === 502 || status === 503 || 
             status === 504 || status === 408;
    }

    // Specific error messages
    if (error.message) {
      const message = error.message.toLowerCase();
      return message.includes('timeout') ||
             message.includes('rate limit') ||
             message.includes('temporary') ||
             message.includes('unavailable');
    }

    return false;
  }

  // Simple in-memory circuit breaker state (should be replaced with proper implementation)
  private static circuitStates = new Map<string, any>();

  private static getCircuitState(key: string): any {
    if (!this.circuitStates.has(key)) {
      this.circuitStates.set(key, {
        state: 'closed',
        consecutiveFailures: 0,
        lastFailureTime: 0,
        halfOpenAttempts: 0
      });
    }
    return this.circuitStates.get(key);
  }
}

/**
 * Decorator for adding retry logic to async methods
 * @param options - Retry configuration options
 * @example
 * class MyService {
 *   @retry({ maxAttempts: 3 })
 *   async fetchData() {
 *     // method implementation
 *   }
 * }
 */
export function retry(options: RetryOptions = {}) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      return RetryUtil.withRetry(
        () => originalMethod.apply(this, args),
        options
      );
    };

    return descriptor;
  };
}

/**
 * Create a retry wrapper with preset configuration
 * @param defaultOptions - Default retry options
 * @returns Configured retry function
 */
export function createRetryWrapper(defaultOptions: RetryOptions) {
  return <T>(
    fn: () => Promise<T>,
    overrideOptions?: Partial<RetryOptions>
  ): Promise<T> => {
    return RetryUtil.withRetry(fn, { ...defaultOptions, ...overrideOptions });
  };
}
