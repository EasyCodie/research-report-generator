/**
 * Query Parser for analyzing and understanding research queries
 * Provides intent detection, entity extraction, and query analysis
 */

import { QueryIntent, ResearchQuery, ReportProfile } from '../types';

export interface ParsedQuery {
  raw: string;
  normalized: string;
  intent: QueryIntent;
  entities: Entity[];
  topics: string[];
  subtopics: string[];
  timeframe?: TimeFrame;
  comparisons?: string[];
  constraints?: QueryConstraint[];
  language: string;
  confidence: number;
}

export interface Entity {
  text: string;
  type: EntityType;
  startIndex: number;
  endIndex: number;
  metadata?: Record<string, any>;
}

export enum EntityType {
  TECHNOLOGY = 'technology',
  FRAMEWORK = 'framework',
  LANGUAGE = 'language',
  CONCEPT = 'concept',
  COMPANY = 'company',
  PERSON = 'person',
  DATE = 'date',
  VERSION = 'version',
  COMPARISON = 'comparison',
  OTHER = 'other'
}

export interface TimeFrame {
  year?: number;
  quarter?: string;
  relative?: 'latest' | 'current' | 'recent' | 'upcoming';
}

export interface QueryConstraint {
  type: 'include' | 'exclude' | 'focus';
  value: string;
}

export class QueryParser {
  private readonly stopWords = new Set([
    'the', 'is', 'at', 'which', 'on', 'and', 'a', 'an', 'as', 'are',
    'was', 'were', 'been', 'be', 'have', 'has', 'had', 'do', 'does',
    'did', 'will', 'would', 'should', 'could', 'ought', 'may', 'might',
    'must', 'can', 'shall', 'to', 'of', 'in', 'for', 'with', 'by'
  ]);

  private readonly techKeywords = new Set([
    'react', 'vue', 'angular', 'svelte', 'nodejs', 'python', 'java',
    'javascript', 'typescript', 'rust', 'go', 'golang', 'ruby', 'php',
    'kubernetes', 'docker', 'aws', 'azure', 'gcp', 'cloud', 'microservices',
    'api', 'rest', 'graphql', 'database', 'sql', 'nosql', 'mongodb',
    'postgresql', 'mysql', 'redis', 'elasticsearch', 'kafka', 'rabbitmq',
    'machine learning', 'ai', 'ml', 'deep learning', 'neural network',
    'blockchain', 'crypto', 'web3', 'nft', 'defi', 'serverless', 'jamstack'
  ]);

  private readonly comparisonWords = ['vs', 'versus', 'compare', 'comparison', 'difference', 'between', 'or'];
  private readonly trendWords = ['trend', 'trending', 'latest', 'new', 'upcoming', 'future', '2024', '2025'];
  private readonly howToWords = ['how', 'guide', 'tutorial', 'implement', 'create', 'build', 'setup', 'install'];
  private readonly bestOfWords = ['best', 'top', 'popular', 'recommended', 'leading', 'optimal'];
  private readonly troubleshootWords = ['fix', 'solve', 'debug', 'error', 'issue', 'problem', 'troubleshoot'];

  /**
   * Parse a research query into structured components
   * @param query - Raw query string
   * @returns Parsed query with extracted components
   */
  parse(query: string): ParsedQuery {
    const normalized = this.normalizeQuery(query);
    const intent = this.detectIntent(query);
    const entities = this.extractEntities(query);
    const topics = this.extractTopics(query);
    const subtopics = this.extractSubtopics(query, topics);
    const timeframe = this.extractTimeframe(query);
    const comparisons = this.extractComparisons(query);
    const constraints = this.extractConstraints(query);
    const confidence = this.calculateConfidence(intent, entities, topics);

    return {
      raw: query,
      normalized,
      intent,
      entities,
      topics,
      subtopics,
      timeframe,
      comparisons: comparisons.length > 0 ? comparisons : undefined,
      constraints: constraints.length > 0 ? constraints : undefined,
      language: 'en',
      confidence
    };
  }

  /**
   * Convert parsed query to ResearchQuery type for compatibility
   * @param parsedQuery - Parsed query
   * @param profile - Report profile
   * @returns ResearchQuery object
   */
  toResearchQuery(parsedQuery: ParsedQuery, profile: ReportProfile): ResearchQuery {
    return {
      raw: parsedQuery.raw,
      intent: parsedQuery.intent,
      topics: parsedQuery.topics,
      subtopics: parsedQuery.subtopics,
      profile,
      language: parsedQuery.language,
      timestamp: new Date()
    };
  }

  /**
   * Detect the intent of the query
   * @param query - Raw query string
   * @returns Detected intent
   */
  detectIntent(query: string): QueryIntent {
    const lowerQuery = query.toLowerCase();
    
    // Check for comparison intent (highest priority)
    if (this.comparisonWords.some(word => 
      word === 'or' ? new RegExp(`\\b\\w+\\s+or\\s+\\w+\\b`).test(lowerQuery) : lowerQuery.includes(word)
    )) {
      return QueryIntent.COMPARE;
    }
    
    // Check for how-to intent
    if (this.howToWords.some(word => lowerQuery.includes(word))) {
      return QueryIntent.HOW_TO;
    }
    
    // Check for troubleshooting intent
    if (this.troubleshootWords.some(word => lowerQuery.includes(word))) {
      return QueryIntent.TROUBLESHOOTING;
    }
    
    // Check for best-of intent
    if (this.bestOfWords.some(word => lowerQuery.includes(word))) {
      return QueryIntent.BEST_OF;
    }
    
    // Check for trend intent
    if (this.trendWords.some(word => lowerQuery.includes(word))) {
      return QueryIntent.TREND;
    }
    
    // Check for overview intent
    if (lowerQuery.includes('what is') || lowerQuery.includes('overview') || 
        lowerQuery.includes('introduction') || lowerQuery.includes('explain')) {
      return QueryIntent.OVERVIEW;
    }
    
    return QueryIntent.UNKNOWN;
  }

  /**
   * Extract entities from the query
   * @param query - Raw query string
   * @returns Array of extracted entities
   */
  extractEntities(query: string): Entity[] {
    const entities: Entity[] = [];
    const lowerQuery = query.toLowerCase();
    
    // Extract technology entities
    for (const tech of this.techKeywords) {
      const regex = new RegExp(`\\b${tech}\\b`, 'gi');
      let match;
      while ((match = regex.exec(query)) !== null) {
        entities.push({
          text: match[0],
          type: this.classifyTechnology(tech),
          startIndex: match.index,
          endIndex: match.index + match[0].length
        });
      }
    }
    
    // Extract version numbers
    const versionRegex = /\b(v?\d+(?:\.\d+)*(?:-?(?:alpha|beta|rc|release))?)\b/gi;
    let match;
    while ((match = versionRegex.exec(query)) !== null) {
      entities.push({
        text: match[0],
        type: EntityType.VERSION,
        startIndex: match.index,
        endIndex: match.index + match[0].length
      });
    }
    
    // Extract years
    const yearRegex = /\b(20\d{2})\b/g;
    while ((match = yearRegex.exec(query)) !== null) {
      entities.push({
        text: match[0],
        type: EntityType.DATE,
        startIndex: match.index,
        endIndex: match.index + match[0].length,
        metadata: { year: parseInt(match[1]) }
      });
    }
    
    // Sort by start index and remove duplicates
    return this.deduplicateEntities(entities);
  }

  /**
   * Extract main topics from the query
   * @param query - Raw query string
   * @returns Array of topics
   */
  extractTopics(query: string): string[] {
    const words = query.toLowerCase()
      .replace(/[^\w\s]/g, '')
      .split(/\s+/)
      .filter(word => !this.stopWords.has(word) && word.length > 2);
    
    // Identify key topics (nouns and tech terms)
    const topics = words.filter(word => 
      this.techKeywords.has(word) || 
      this.isProbablyNoun(word)
    );
    
    // Add compound topics (e.g., "machine learning")
    const compoundTopics = this.extractCompoundTerms(query.toLowerCase());
    topics.push(...compoundTopics);
    
    return [...new Set(topics)];
  }

  /**
   * Extract subtopics related to main topics
   * @param query - Raw query string
   * @param topics - Main topics
   * @returns Array of subtopics
   */
  extractSubtopics(query: string, topics: string[]): string[] {
    const subtopics: string[] = [];
    const lowerQuery = query.toLowerCase();
    
    // Look for modifiers and related concepts
    const modifiers = ['performance', 'security', 'scalability', 'testing', 
                      'deployment', 'architecture', 'patterns', 'practices',
                      'optimization', 'monitoring', 'debugging', 'configuration'];
    
    for (const modifier of modifiers) {
      if (lowerQuery.includes(modifier)) {
        subtopics.push(modifier);
      }
    }
    
    return subtopics;
  }

  /**
   * Extract timeframe references from query
   * @param query - Raw query string
   * @returns Extracted timeframe or undefined
   */
  extractTimeframe(query: string): TimeFrame | undefined {
    const lowerQuery = query.toLowerCase();
    
    // Check for year
    const yearMatch = lowerQuery.match(/\b(20\d{2})\b/);
    if (yearMatch) {
      return { year: parseInt(yearMatch[1]) };
    }
    
    // Check for relative timeframes
    if (lowerQuery.includes('latest') || lowerQuery.includes('newest')) {
      return { relative: 'latest' };
    }
    if (lowerQuery.includes('current') || lowerQuery.includes('now')) {
      return { relative: 'current' };
    }
    if (lowerQuery.includes('recent')) {
      return { relative: 'recent' };
    }
    if (lowerQuery.includes('upcoming') || lowerQuery.includes('future')) {
      return { relative: 'upcoming' };
    }
    
    // Check for quarters
    const quarterMatch = lowerQuery.match(/\b(q[1-4])\s+(20\d{2})\b/);
    if (quarterMatch) {
      return { 
        quarter: quarterMatch[1].toUpperCase(),
        year: parseInt(quarterMatch[2])
      };
    }
    
    return undefined;
  }

  /**
   * Extract comparison targets from query
   * @param query - Raw query string
   * @returns Array of items being compared
   */
  extractComparisons(query: string): string[] {
    const comparisons: string[] = [];
    const lowerQuery = query.toLowerCase();
    
    // Pattern: X vs Y, X versus Y
    const vsPattern = /(\w+(?:\s+\w+)?)\s+(?:vs\.?|versus)\s+(\w+(?:\s+\w+)?)/gi;
    let match;
    while ((match = vsPattern.exec(query)) !== null) {
      comparisons.push(match[1].trim(), match[2].trim());
    }
    
    // Pattern: compare X and Y, compare X with Y
    const comparePattern = /compare\s+(\w+(?:\s+\w+)?)\s+(?:and|with|to)\s+(\w+(?:\s+\w+)?)/gi;
    while ((match = comparePattern.exec(query)) !== null) {
      comparisons.push(match[1].trim(), match[2].trim());
    }
    
    // Pattern: X or Y (in context of comparison)
    if (lowerQuery.includes('which') || lowerQuery.includes('better')) {
      const orPattern = /(\w+(?:\s+\w+)?)\s+or\s+(\w+(?:\s+\w+)?)/gi;
      while ((match = orPattern.exec(query)) !== null) {
        comparisons.push(match[1].trim(), match[2].trim());
      }
    }
    
    return [...new Set(comparisons)];
  }

  /**
   * Extract query constraints (include/exclude/focus)
   * @param query - Raw query string
   * @returns Array of constraints
   */
  extractConstraints(query: string): QueryConstraint[] {
    const constraints: QueryConstraint[] = [];
    const lowerQuery = query.toLowerCase();
    
    // Pattern: including X, with focus on X, focusing on X
    const includePattern = /(?:including|with focus on|focusing on|especially)\s+(.+?)(?:\.|,|$)/gi;
    let match;
    while ((match = includePattern.exec(query)) !== null) {
      constraints.push({
        type: 'focus',
        value: match[1].trim()
      });
    }
    
    // Pattern: excluding X, without X, except X
    const excludePattern = /(?:excluding|without|except|not including)\s+(.+?)(?:\.|,|$)/gi;
    while ((match = excludePattern.exec(query)) !== null) {
      constraints.push({
        type: 'exclude',
        value: match[1].trim()
      });
    }
    
    return constraints;
  }

  /**
   * Normalize the query for better processing
   * @param query - Raw query string
   * @returns Normalized query
   */
  private normalizeQuery(query: string): string {
    return query
      .trim()
      .replace(/\s+/g, ' ')           // Multiple spaces to single
      .replace(/[""]/g, '"')          // Normalize quotes
      .replace(/[']/g, "'")           // Normalize apostrophes
      .replace(/\?+$/, '')            // Remove trailing question marks
      .toLowerCase();
  }

  /**
   * Classify technology entity type
   * @param tech - Technology keyword
   * @returns Entity type
   */
  private classifyTechnology(tech: string): EntityType {
    const frameworks = ['react', 'vue', 'angular', 'svelte', 'express', 'django', 'flask', 'spring'];
    const languages = ['javascript', 'typescript', 'python', 'java', 'rust', 'go', 'ruby', 'php'];
    const concepts = ['microservices', 'serverless', 'jamstack', 'blockchain', 'machine learning'];
    
    if (frameworks.includes(tech)) return EntityType.FRAMEWORK;
    if (languages.includes(tech)) return EntityType.LANGUAGE;
    if (concepts.includes(tech)) return EntityType.CONCEPT;
    
    return EntityType.TECHNOLOGY;
  }

  /**
   * Check if a word is probably a noun (simple heuristic)
   * @param word - Word to check
   * @returns True if likely a noun
   */
  private isProbablyNoun(word: string): boolean {
    // Simple heuristic: ends with common noun suffixes
    const nounSuffixes = ['tion', 'sion', 'ment', 'ness', 'ity', 'er', 'or', 'ism', 'ist', 'ware', 'base'];
    return nounSuffixes.some(suffix => word.endsWith(suffix));
  }

  /**
   * Extract compound terms (multi-word concepts)
   * @param text - Text to analyze
   * @returns Array of compound terms
   */
  private extractCompoundTerms(text: string): string[] {
    const compounds: string[] = [];
    const compoundPatterns = [
      'machine learning',
      'artificial intelligence',
      'deep learning',
      'neural network',
      'version control',
      'continuous integration',
      'continuous deployment',
      'test driven',
      'domain driven',
      'event driven',
      'micro services',
      'micro frontends',
      'server side',
      'client side',
      'full stack',
      'back end',
      'front end'
    ];
    
    for (const pattern of compoundPatterns) {
      if (text.includes(pattern)) {
        compounds.push(pattern.replace(/\s+/g, '_'));
      }
    }
    
    return compounds;
  }

  /**
   * Remove duplicate entities
   * @param entities - Array of entities
   * @returns Deduplicated entities
   */
  private deduplicateEntities(entities: Entity[]): Entity[] {
    const seen = new Set<string>();
    return entities
      .sort((a, b) => a.startIndex - b.startIndex)
      .filter(entity => {
        const key = `${entity.text}-${entity.type}-${entity.startIndex}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
  }

  /**
   * Calculate confidence score for the parsing
   * @param intent - Detected intent
   * @param entities - Extracted entities
   * @param topics - Extracted topics
   * @returns Confidence score (0-1)
   */
  private calculateConfidence(intent: QueryIntent, entities: Entity[], topics: string[]): number {
    let confidence = 0.5; // Base confidence
    
    // Intent detection confidence
    if (intent !== QueryIntent.UNKNOWN) confidence += 0.2;
    
    // Entity extraction confidence
    if (entities.length > 0) confidence += 0.15;
    if (entities.length > 2) confidence += 0.1;
    
    // Topic extraction confidence
    if (topics.length > 0) confidence += 0.15;
    if (topics.length > 2) confidence += 0.1;
    
    return Math.min(confidence, 1.0);
  }
}
