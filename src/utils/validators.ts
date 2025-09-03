/**
 * Input validation utilities for ensuring data integrity and security
 * Provides validation for queries, URLs, options, and other user inputs
 */

import { ReportProfile, OutputFormat } from '../types';

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  sanitized?: any;
}

export interface ValidationError {
  field: string;
  message: string;
  code: string;
  value?: any;
}

export class Validators {
  private static readonly MAX_QUERY_LENGTH = 500;
  private static readonly MIN_QUERY_LENGTH = 3;
  private static readonly MAX_URL_LENGTH = 2048;
  private static readonly MAX_SOURCES = 100;
  private static readonly MIN_SOURCES = 1;
  
  // Dangerous patterns that might indicate injection attempts
  private static readonly DANGEROUS_PATTERNS = [
    /<script/gi,
    /javascript:/gi,
    /on\w+\s*=/gi,  // Event handlers
    /data:text\/html/gi,
    /vbscript:/gi,
    /file:\/\//gi,
    /\.\.\//g,  // Path traversal
    /[<>]/g,  // HTML tags (basic)
  ];

  /**
   * Validate a research query
   * @param query - Raw query string
   * @returns Validation result with sanitized query
   */
  static validateQuery(query: unknown): ValidationResult {
    const errors: ValidationError[] = [];
    
    // Type check
    if (typeof query !== 'string') {
      errors.push({
        field: 'query',
        message: 'Query must be a string',
        code: 'INVALID_TYPE',
        value: query
      });
      return { valid: false, errors };
    }
    
    // Empty check
    const trimmed = query.trim();
    if (trimmed.length === 0) {
      errors.push({
        field: 'query',
        message: 'Query cannot be empty',
        code: 'EMPTY_QUERY'
      });
      return { valid: false, errors };
    }
    
    // Length check
    if (trimmed.length < this.MIN_QUERY_LENGTH) {
      errors.push({
        field: 'query',
        message: `Query must be at least ${this.MIN_QUERY_LENGTH} characters`,
        code: 'QUERY_TOO_SHORT',
        value: trimmed.length
      });
    }
    
    if (trimmed.length > this.MAX_QUERY_LENGTH) {
      errors.push({
        field: 'query',
        message: `Query must not exceed ${this.MAX_QUERY_LENGTH} characters`,
        code: 'QUERY_TOO_LONG',
        value: trimmed.length
      });
    }
    
    // Check for dangerous patterns
    const dangerousPatterns = this.checkDangerousPatterns(trimmed, 'query');
    errors.push(...dangerousPatterns);
    
    // Sanitize query
    const sanitized = this.sanitizeString(trimmed);
    
    return {
      valid: errors.length === 0,
      errors,
      sanitized
    };
  }

  /**
   * Validate a URL
   * @param url - URL string to validate
   * @returns Validation result
   */
  static validateUrl(url: unknown): ValidationResult {
    const errors: ValidationError[] = [];
    
    // Type check
    if (typeof url !== 'string') {
      errors.push({
        field: 'url',
        message: 'URL must be a string',
        code: 'INVALID_TYPE',
        value: url
      });
      return { valid: false, errors };
    }
    
    // Empty check
    const trimmed = url.trim();
    if (trimmed.length === 0) {
      errors.push({
        field: 'url',
        message: 'URL cannot be empty',
        code: 'EMPTY_URL'
      });
      return { valid: false, errors };
    }
    
    // Length check
    if (trimmed.length > this.MAX_URL_LENGTH) {
      errors.push({
        field: 'url',
        message: `URL must not exceed ${this.MAX_URL_LENGTH} characters`,
        code: 'URL_TOO_LONG',
        value: trimmed.length
      });
    }
    
    // URL format validation
    try {
      const urlObj = new URL(trimmed);
      
      // Protocol check
      if (!['http:', 'https:'].includes(urlObj.protocol)) {
        errors.push({
          field: 'url',
          message: 'URL must use HTTP or HTTPS protocol',
          code: 'INVALID_PROTOCOL',
          value: urlObj.protocol
        });
      }
      
      // Check for localhost/private IPs (security)
      if (this.isPrivateUrl(urlObj)) {
        errors.push({
          field: 'url',
          message: 'Private or local URLs are not allowed',
          code: 'PRIVATE_URL',
          value: urlObj.hostname
        });
      }
      
      // Check for dangerous patterns in URL
      const dangerousPatterns = this.checkDangerousPatterns(trimmed, 'url');
      errors.push(...dangerousPatterns);
      
    } catch (e) {
      errors.push({
        field: 'url',
        message: 'Invalid URL format',
        code: 'INVALID_URL_FORMAT',
        value: trimmed
      });
    }
    
    return {
      valid: errors.length === 0,
      errors,
      sanitized: trimmed
    };
  }

  /**
   * Validate report generation options
   * @param options - Options object
   * @returns Validation result with sanitized options
   */
  static validateOptions(options: unknown): ValidationResult {
    const errors: ValidationError[] = [];
    
    // Type check
    if (!options || typeof options !== 'object') {
      errors.push({
        field: 'options',
        message: 'Options must be an object',
        code: 'INVALID_TYPE',
        value: options
      });
      return { valid: false, errors };
    }
    
    const opts = options as Record<string, any>;
    const sanitized: Record<string, any> = {};
    
    // Validate profile
    if (opts.profile !== undefined) {
      if (!Object.values(ReportProfile).includes(opts.profile)) {
        errors.push({
          field: 'options.profile',
          message: `Invalid profile. Must be one of: ${Object.values(ReportProfile).join(', ')}`,
          code: 'INVALID_PROFILE',
          value: opts.profile
        });
      } else {
        sanitized.profile = opts.profile;
      }
    }
    
    // Validate formats
    if (opts.formats !== undefined) {
      if (!Array.isArray(opts.formats)) {
        errors.push({
          field: 'options.formats',
          message: 'Formats must be an array',
          code: 'INVALID_TYPE',
          value: opts.formats
        });
      } else {
        const validFormats = Object.values(OutputFormat);
        const invalidFormats = opts.formats.filter(f => !validFormats.includes(f));
        
        if (invalidFormats.length > 0) {
          errors.push({
            field: 'options.formats',
            message: `Invalid formats: ${invalidFormats.join(', ')}`,
            code: 'INVALID_FORMAT',
            value: invalidFormats
          });
        } else {
          sanitized.formats = opts.formats;
        }
      }
    }
    
    // Validate maxSources
    if (opts.maxSources !== undefined) {
      const maxSources = Number(opts.maxSources);
      
      if (isNaN(maxSources)) {
        errors.push({
          field: 'options.maxSources',
          message: 'maxSources must be a number',
          code: 'INVALID_TYPE',
          value: opts.maxSources
        });
      } else if (maxSources < this.MIN_SOURCES) {
        errors.push({
          field: 'options.maxSources',
          message: `maxSources must be at least ${this.MIN_SOURCES}`,
          code: 'VALUE_TOO_LOW',
          value: maxSources
        });
      } else if (maxSources > this.MAX_SOURCES) {
        errors.push({
          field: 'options.maxSources',
          message: `maxSources must not exceed ${this.MAX_SOURCES}`,
          code: 'VALUE_TOO_HIGH',
          value: maxSources
        });
      } else {
        sanitized.maxSources = maxSources;
      }
    }
    
    // Validate outputDir
    if (opts.outputDir !== undefined) {
      if (typeof opts.outputDir !== 'string') {
        errors.push({
          field: 'options.outputDir',
          message: 'outputDir must be a string',
          code: 'INVALID_TYPE',
          value: opts.outputDir
        });
      } else {
        // Check for path traversal attempts
        if (opts.outputDir.includes('..') || opts.outputDir.includes('~')) {
          errors.push({
            field: 'options.outputDir',
            message: 'outputDir contains invalid path characters',
            code: 'INVALID_PATH',
            value: opts.outputDir
          });
        } else {
          sanitized.outputDir = this.sanitizePath(opts.outputDir);
        }
      }
    }
    
    return {
      valid: errors.length === 0,
      errors,
      sanitized
    };
  }

  /**
   * Validate an email address
   * @param email - Email string
   * @returns Validation result
   */
  static validateEmail(email: unknown): ValidationResult {
    const errors: ValidationError[] = [];
    
    if (typeof email !== 'string') {
      errors.push({
        field: 'email',
        message: 'Email must be a string',
        code: 'INVALID_TYPE',
        value: email
      });
      return { valid: false, errors };
    }
    
    const trimmed = email.trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    
    if (!emailRegex.test(trimmed)) {
      errors.push({
        field: 'email',
        message: 'Invalid email format',
        code: 'INVALID_EMAIL',
        value: trimmed
      });
    }
    
    return {
      valid: errors.length === 0,
      errors,
      sanitized: trimmed
    };
  }

  /**
   * Validate an array of strings
   * @param array - Array to validate
   * @param field - Field name for error messages
   * @param options - Validation options
   * @returns Validation result
   */
  static validateStringArray(
    array: unknown,
    field: string,
    options: {
      minLength?: number;
      maxLength?: number;
      minItems?: number;
      maxItems?: number;
      allowedValues?: string[];
    } = {}
  ): ValidationResult {
    const errors: ValidationError[] = [];
    
    if (!Array.isArray(array)) {
      errors.push({
        field,
        message: `${field} must be an array`,
        code: 'INVALID_TYPE',
        value: array
      });
      return { valid: false, errors };
    }
    
    // Check array size
    if (options.minItems !== undefined && array.length < options.minItems) {
      errors.push({
        field,
        message: `${field} must have at least ${options.minItems} items`,
        code: 'TOO_FEW_ITEMS',
        value: array.length
      });
    }
    
    if (options.maxItems !== undefined && array.length > options.maxItems) {
      errors.push({
        field,
        message: `${field} must not exceed ${options.maxItems} items`,
        code: 'TOO_MANY_ITEMS',
        value: array.length
      });
    }
    
    // Validate each item
    const sanitized: string[] = [];
    array.forEach((item, index) => {
      if (typeof item !== 'string') {
        errors.push({
          field: `${field}[${index}]`,
          message: 'Item must be a string',
          code: 'INVALID_TYPE',
          value: item
        });
        return;
      }
      
      const trimmed = item.trim();
      
      if (options.minLength !== undefined && trimmed.length < options.minLength) {
        errors.push({
          field: `${field}[${index}]`,
          message: `Item must be at least ${options.minLength} characters`,
          code: 'ITEM_TOO_SHORT',
          value: trimmed.length
        });
      }
      
      if (options.maxLength !== undefined && trimmed.length > options.maxLength) {
        errors.push({
          field: `${field}[${index}]`,
          message: `Item must not exceed ${options.maxLength} characters`,
          code: 'ITEM_TOO_LONG',
          value: trimmed.length
        });
      }
      
      if (options.allowedValues && !options.allowedValues.includes(trimmed)) {
        errors.push({
          field: `${field}[${index}]`,
          message: `Invalid value. Must be one of: ${options.allowedValues.join(', ')}`,
          code: 'INVALID_VALUE',
          value: trimmed
        });
      }
      
      sanitized.push(this.sanitizeString(trimmed));
    });
    
    return {
      valid: errors.length === 0,
      errors,
      sanitized
    };
  }

  /**
   * Check for dangerous patterns in a string
   * @param value - String to check
   * @param field - Field name for error messages
   * @returns Array of validation errors
   */
  private static checkDangerousPatterns(value: string, field: string): ValidationError[] {
    const errors: ValidationError[] = [];
    
    for (const pattern of this.DANGEROUS_PATTERNS) {
      if (pattern.test(value)) {
        errors.push({
          field,
          message: 'Input contains potentially dangerous content',
          code: 'DANGEROUS_CONTENT',
          value: pattern.source
        });
        // Reset regex lastIndex for global patterns
        if (pattern.global) {
          pattern.lastIndex = 0;
        }
      }
    }
    
    return errors;
  }

  /**
   * Sanitize a string by removing/escaping dangerous characters
   * @param value - String to sanitize
   * @returns Sanitized string
   */
  private static sanitizeString(value: string): string {
    return value
      .replace(/[<>]/g, '')  // Remove HTML brackets
      .replace(/javascript:/gi, '')  // Remove javascript protocol
      .replace(/on\w+\s*=/gi, '')  // Remove event handlers
      .trim();
  }

  /**
   * Sanitize a file path
   * @param path - Path to sanitize
   * @returns Sanitized path
   */
  private static sanitizePath(path: string): string {
    return path
      .replace(/\.\./g, '')  // Remove path traversal
      .replace(/~+/g, '')  // Remove home directory references
      .replace(/[<>"|?*]/g, '')  // Remove invalid path characters
      .replace(/^[/\\]+/, '')  // Remove leading slashes
      .trim();
  }

  /**
   * Check if a URL points to a private/local address
   * @param url - URL object to check
   * @returns True if private
   */
  private static isPrivateUrl(url: URL): boolean {
    const hostname = url.hostname.toLowerCase();
    
    // Localhost variations
    if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1') {
      return true;
    }
    
    // Private IP ranges
    const privateRanges = [
      /^10\./,  // 10.0.0.0/8
      /^172\.(1[6-9]|2\d|3[01])\./,  // 172.16.0.0/12
      /^192\.168\./,  // 192.168.0.0/16
      /^169\.254\./,  // Link-local
      /^fc00:/,  // IPv6 private
      /^fe80:/,  // IPv6 link-local
    ];
    
    return privateRanges.some(range => range.test(hostname));
  }

  /**
   * Create a validation error response
   * @param errors - Validation errors
   * @returns Formatted error response
   */
  static formatErrors(errors: ValidationError[]): {
    message: string;
    errors: Record<string, string[]>;
  } {
    const grouped: Record<string, string[]> = {};
    
    errors.forEach(error => {
      if (!grouped[error.field]) {
        grouped[error.field] = [];
      }
      grouped[error.field].push(error.message);
    });
    
    const message = errors.length === 1 
      ? errors[0].message 
      : `Validation failed with ${errors.length} errors`;
    
    return { message, errors: grouped };
  }
}
