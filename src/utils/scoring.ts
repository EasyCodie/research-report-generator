/**
 * Centralized scoring engine for consistent relevance and reliability calculations
 * Eliminates duplication across search providers and scrapers
 */

export interface ScoringFactors {
  hasRichContent?: boolean;
  hasMetadata?: boolean;
  domain?: string;
  isHttps?: boolean;
  lastModified?: Date;
  popularity?: number; // stars, forks, views, etc.
  authorPresence?: boolean;
  citationCount?: number;
  contentLength?: number;
  keywordMatches?: number;
  [key: string]: any; // Allow custom factors
}

export interface ScoringWeights {
  richContent?: number;
  metadata?: number;
  domainReliability?: number;
  httpsBonus?: number;
  freshness?: number;
  popularity?: number;
  authorPresence?: number;
  citations?: number;
  contentLength?: number;
  keywordRelevance?: number;
}

export interface DomainReliability {
  score: number;
  category: 'academic' | 'technical' | 'government' | 'news' | 'social' | 'unknown';
  rationale: string;
}

export class ScoringEngine {
  private static readonly DEFAULT_WEIGHTS: ScoringWeights = {
    richContent: 0.10,
    metadata: 0.10,
    domainReliability: 0.25,
    httpsBonus: 0.05,
    freshness: 0.20,
    popularity: 0.15,
    authorPresence: 0.05,
    citations: 0.05,
    contentLength: 0.03,
    keywordRelevance: 0.02
  };

  /**
   * Calculate a unified relevance score based on multiple factors
   * @param factors - Scoring factors to consider
   * @param weights - Optional custom weights for factors
   * @returns Normalized score between 0 and 1
   */
  static calculateRelevance(
    factors: ScoringFactors,
    weights: ScoringWeights = {}
  ): number {
    const w = { ...this.DEFAULT_WEIGHTS, ...weights };
    let score = 0;
    let totalWeight = 0;

    // Rich content bonus
    if (factors.hasRichContent !== undefined && w.richContent) {
      score += factors.hasRichContent ? w.richContent : 0;
      totalWeight += w.richContent;
    }

    // Metadata presence
    if (factors.hasMetadata !== undefined && w.metadata) {
      score += factors.hasMetadata ? w.metadata : 0;
      totalWeight += w.metadata;
    }

    // Domain reliability
    if (factors.domain && w.domainReliability) {
      const domainScore = this.getDomainReliability(factors.domain).score;
      score += domainScore * w.domainReliability;
      totalWeight += w.domainReliability;
    }

    // HTTPS bonus
    if (factors.isHttps !== undefined && w.httpsBonus) {
      score += factors.isHttps ? w.httpsBonus : 0;
      totalWeight += w.httpsBonus;
    }

    // Freshness score
    if (factors.lastModified && w.freshness) {
      const freshnessScore = this.calculateFreshnessScore(factors.lastModified);
      score += freshnessScore * w.freshness;
      totalWeight += w.freshness;
    }

    // Popularity score (normalized)
    if (factors.popularity !== undefined && w.popularity) {
      const popularityScore = this.calculatePopularityScore(factors.popularity);
      score += popularityScore * w.popularity;
      totalWeight += w.popularity;
    }

    // Author presence
    if (factors.authorPresence !== undefined && w.authorPresence) {
      score += factors.authorPresence ? w.authorPresence : 0;
      totalWeight += w.authorPresence;
    }

    // Citation count (normalized)
    if (factors.citationCount !== undefined && w.citations) {
      const citationScore = this.calculateCitationScore(factors.citationCount);
      score += citationScore * w.citations;
      totalWeight += w.citations;
    }

    // Content length (normalized)
    if (factors.contentLength !== undefined && w.contentLength) {
      const lengthScore = this.calculateContentLengthScore(factors.contentLength);
      score += lengthScore * w.contentLength;
      totalWeight += w.contentLength;
    }

    // Keyword relevance
    if (factors.keywordMatches !== undefined && w.keywordRelevance) {
      const keywordScore = Math.min(factors.keywordMatches / 10, 1); // Cap at 10 matches
      score += keywordScore * w.keywordRelevance;
      totalWeight += w.keywordRelevance;
    }

    // Normalize score based on total weight
    if (totalWeight > 0) {
      score = score / totalWeight;
    }

    return this.normalizeScore(score);
  }

  /**
   * Calculate repository score for code repositories
   * @param stars - Number of stars
   * @param forks - Number of forks
   * @param lastUpdate - Last update date
   * @param hasDescription - Whether repository has description
   * @param topics - Number of topics/tags
   * @returns Normalized score between 0 and 1
   */
  static calculateRepoScore(
    stars: number,
    forks: number,
    lastUpdate: Date,
    hasDescription: boolean = false,
    topics: number = 0
  ): number {
    let score = 0.5; // Base score

    // Stars contribution (logarithmic scale)
    if (stars > 0) {
      score += Math.min(Math.log10(stars) / 10, 0.2);
    }

    // Forks contribution (logarithmic scale)
    if (forks > 0) {
      score += Math.min(Math.log10(forks) / 10, 0.1);
    }

    // Freshness
    const daysSinceUpdate = this.daysSince(lastUpdate);
    if (daysSinceUpdate < 30) score += 0.15;
    else if (daysSinceUpdate < 90) score += 0.10;
    else if (daysSinceUpdate < 180) score += 0.05;

    // Description and topics
    if (hasDescription) score += 0.05;
    if (topics > 0) score += Math.min(topics * 0.02, 0.1);

    return this.normalizeScore(score);
  }

  /**
   * Calculate code file score based on repository and file characteristics
   * @param repoStars - Repository stars
   * @param fileName - Name of the file
   * @param filePath - Path of the file
   * @returns Normalized score between 0 and 1
   */
  static calculateCodeScore(
    repoStars: number,
    fileName: string,
    filePath: string
  ): number {
    let score = 0.6; // Base score for code

    // Repository quality
    if (repoStars > 100) score += 0.1;
    if (repoStars > 1000) score += 0.1;
    if (repoStars > 10000) score += 0.05;

    const lowerFileName = fileName.toLowerCase();
    const lowerPath = filePath.toLowerCase();

    // Documentation files get bonus
    if (lowerFileName.includes('readme') || lowerFileName.includes('doc')) {
      score += 0.1;
    }

    // Example/demo files get bonus
    if (lowerFileName.includes('example') || lowerFileName.includes('demo') ||
        lowerPath.includes('examples') || lowerPath.includes('samples')) {
      score += 0.1;
    }

    // Test files (might be useful for understanding usage)
    if (lowerFileName.includes('test') || lowerFileName.includes('spec') ||
        lowerPath.includes('test')) {
      score += 0.05;
    }

    return this.normalizeScore(score);
  }

  /**
   * Get domain reliability score and information
   * @param domain - Domain to evaluate
   * @returns Domain reliability information
   */
  static getDomainReliability(domain: string): DomainReliability {
    const lowerDomain = domain.toLowerCase();

    // Import from centralized domains config
    const { RELIABLE_DOMAINS } = require('../../config/domains');

    // Check specific domains first
    for (const [domainPattern, info] of Object.entries(RELIABLE_DOMAINS.specific)) {
      if (lowerDomain.includes(domainPattern)) {
        return info as DomainReliability;
      }
    }

    // Check categories
    if (lowerDomain.endsWith('.edu')) {
      return RELIABLE_DOMAINS.categories.academic;
    }
    if (lowerDomain.endsWith('.gov')) {
      return RELIABLE_DOMAINS.categories.government;
    }
    if (lowerDomain.endsWith('.org')) {
      return RELIABLE_DOMAINS.categories.nonprofit;
    }

    // Check technical domains
    for (const pattern of RELIABLE_DOMAINS.patterns.technical) {
      if (lowerDomain.includes(pattern)) {
        return {
          score: 0.85,
          category: 'technical',
          rationale: 'Technical documentation or developer resource'
        };
      }
    }

    // Check academic patterns
    for (const pattern of RELIABLE_DOMAINS.patterns.academic) {
      if (lowerDomain.includes(pattern)) {
        return {
          score: 0.9,
          category: 'academic',
          rationale: 'Academic or research institution'
        };
      }
    }

    // Check social/blog patterns
    for (const pattern of RELIABLE_DOMAINS.patterns.social) {
      if (lowerDomain.includes(pattern)) {
        return {
          score: 0.6,
          category: 'social',
          rationale: 'User-generated content platform'
        };
      }
    }

    // Unknown domain
    return {
      score: 0.5,
      category: 'unknown',
      rationale: 'Unknown domain - baseline reliability'
    };
  }

  /**
   * Calculate freshness score based on age
   * @param date - Date to evaluate
   * @returns Score between 0 and 1
   */
  static calculateFreshnessScore(date: Date): number {
    const days = this.daysSince(date);
    
    if (days < 7) return 1.0;      // Less than a week old
    if (days < 30) return 0.9;     // Less than a month old
    if (days < 90) return 0.7;     // Less than 3 months old
    if (days < 180) return 0.5;    // Less than 6 months old
    if (days < 365) return 0.3;    // Less than a year old
    if (days < 730) return 0.1;    // Less than 2 years old
    return 0.05;                   // Older than 2 years
  }

  /**
   * Calculate popularity score (normalized logarithmic)
   * @param value - Popularity metric (stars, views, etc.)
   * @returns Score between 0 and 1
   */
  static calculatePopularityScore(value: number): number {
    if (value <= 0) return 0;
    
    // Logarithmic scaling with different thresholds
    if (value < 10) return value / 100;
    if (value < 100) return 0.1 + (Math.log10(value) - 1) * 0.2;
    if (value < 1000) return 0.3 + (Math.log10(value) - 2) * 0.2;
    if (value < 10000) return 0.5 + (Math.log10(value) - 3) * 0.15;
    return Math.min(0.65 + (Math.log10(value) - 4) * 0.1, 1.0);
  }

  /**
   * Calculate citation score
   * @param citations - Number of citations
   * @returns Score between 0 and 1
   */
  static calculateCitationScore(citations: number): number {
    if (citations <= 0) return 0;
    if (citations < 5) return citations * 0.15;
    if (citations < 10) return 0.75 + (citations - 5) * 0.03;
    return Math.min(0.9 + (citations - 10) * 0.01, 1.0);
  }

  /**
   * Calculate content length score
   * @param length - Content length in characters
   * @returns Score between 0 and 1
   */
  static calculateContentLengthScore(length: number): number {
    if (length < 100) return 0.1;        // Too short
    if (length < 500) return 0.3;        // Short
    if (length < 2000) return 0.6;       // Good length
    if (length < 10000) return 0.9;      // Comprehensive
    if (length < 50000) return 1.0;      // Very comprehensive
    return 0.8;                          // Might be too long
  }

  /**
   * Normalize a score to ensure it's between 0 and 1
   * @param score - Score to normalize
   * @param min - Minimum value (default 0)
   * @param max - Maximum value (default 1)
   * @returns Normalized score
   */
  static normalizeScore(score: number, min: number = 0, max: number = 1): number {
    return Math.max(min, Math.min(score, max));
  }

  /**
   * Combine multiple scores with weights
   * @param scores - Array of scores with optional weights
   * @returns Combined score
   */
  static combineScores(scores: Array<{ score: number; weight?: number }>): number {
    let totalScore = 0;
    let totalWeight = 0;

    for (const { score, weight = 1 } of scores) {
      totalScore += score * weight;
      totalWeight += weight;
    }

    return totalWeight > 0 ? totalScore / totalWeight : 0;
  }

  /**
   * Calculate days since a given date
   * @param date - Date to calculate from
   * @returns Number of days
   */
  private static daysSince(date: Date): number {
    return Math.floor((Date.now() - date.getTime()) / (1000 * 60 * 60 * 24));
  }

  /**
   * Apply a decay function to a score based on age
   * @param baseScore - Initial score
   * @param ageInDays - Age in days
   * @param halfLife - Half-life in days (default 90)
   * @returns Decayed score
   */
  static applyTimeDecay(
    baseScore: number,
    ageInDays: number,
    halfLife: number = 90
  ): number {
    const decayFactor = Math.pow(0.5, ageInDays / halfLife);
    return baseScore * decayFactor;
  }

  /**
   * Calculate confidence interval for a score
   * @param score - Base score
   * @param sampleSize - Number of data points
   * @returns Score with confidence bounds
   */
  static calculateConfidence(
    score: number,
    sampleSize: number
  ): { score: number; lower: number; upper: number; confidence: number } {
    // Wilson score interval for binomial proportion
    const z = 1.96; // 95% confidence
    const n = Math.max(sampleSize, 1);
    const phat = score;
    
    const denominator = 1 + z * z / n;
    const center = (phat + z * z / (2 * n)) / denominator;
    const spread = z * Math.sqrt((phat * (1 - phat) + z * z / (4 * n)) / n) / denominator;
    
    return {
      score: center,
      lower: Math.max(0, center - spread),
      upper: Math.min(1, center + spread),
      confidence: Math.min(sampleSize / 10, 1) // Confidence increases with sample size
    };
  }
}
