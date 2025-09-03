import { describe, it, expect } from 'vitest';
import { QueryParser, EntityType } from '../../../src/parser/query-parser';
import { QueryIntent } from '../../../src/types';

describe('QueryParser', () => {
  let parser: QueryParser;

  beforeEach(() => {
    parser = new QueryParser();
  });

  describe('detectIntent', () => {
    it('should detect COMPARE intent', () => {
      expect(parser.detectIntent('Compare React vs Vue')).toBe(QueryIntent.COMPARE);
      expect(parser.detectIntent('React versus Angular')).toBe(QueryIntent.COMPARE);
      expect(parser.detectIntent('difference between MySQL and PostgreSQL')).toBe(QueryIntent.COMPARE);
    });

    it('should detect HOW_TO intent', () => {
      expect(parser.detectIntent('How to implement authentication')).toBe(QueryIntent.HOW_TO);
      expect(parser.detectIntent('Guide to Docker deployment')).toBe(QueryIntent.HOW_TO);
      expect(parser.detectIntent('Tutorial for React hooks')).toBe(QueryIntent.HOW_TO);
    });

    it('should detect TREND intent', () => {
      expect(parser.detectIntent('Latest JavaScript frameworks 2024')).toBe(QueryIntent.TREND);
      expect(parser.detectIntent('Trending technologies in AI')).toBe(QueryIntent.TREND);
      expect(parser.detectIntent('New features in Python')).toBe(QueryIntent.TREND);
    });

    it('should detect BEST_OF intent', () => {
      expect(parser.detectIntent('Best practices for React')).toBe(QueryIntent.BEST_OF);
      expect(parser.detectIntent('Top 10 Python libraries')).toBe(QueryIntent.BEST_OF);
      expect(parser.detectIntent('Recommended testing frameworks')).toBe(QueryIntent.BEST_OF);
    });

    it('should detect TROUBLESHOOTING intent', () => {
      expect(parser.detectIntent('Fix CORS error in API')).toBe(QueryIntent.TROUBLESHOOTING);
      expect(parser.detectIntent('Debug memory leak')).toBe(QueryIntent.TROUBLESHOOTING);
      expect(parser.detectIntent('Solve authentication issue')).toBe(QueryIntent.TROUBLESHOOTING);
    });

    it('should detect OVERVIEW intent', () => {
      expect(parser.detectIntent('What is GraphQL')).toBe(QueryIntent.OVERVIEW);
      expect(parser.detectIntent('Overview of microservices')).toBe(QueryIntent.OVERVIEW);
      expect(parser.detectIntent('Introduction to machine learning')).toBe(QueryIntent.OVERVIEW);
    });

    it('should return UNKNOWN for ambiguous queries', () => {
      expect(parser.detectIntent('Random text here')).toBe(QueryIntent.UNKNOWN);
      expect(parser.detectIntent('Something about stuff')).toBe(QueryIntent.UNKNOWN);
    });
  });

  describe('extractEntities', () => {
    it('should extract technology entities', () => {
      const entities = parser.extractEntities('Building apps with React and Node.js');
      
      expect(entities).toContainEqual(
        expect.objectContaining({
          text: 'React',
          type: EntityType.FRAMEWORK
        })
      );
      
      expect(entities).toContainEqual(
        expect.objectContaining({
          text: 'Node',
          type: EntityType.TECHNOLOGY
        })
      );
    });

    it('should extract version numbers', () => {
      const entities = parser.extractEntities('Upgrading from Python 3.8 to Python 3.11');
      
      const versionEntities = entities.filter(e => e.type === EntityType.VERSION);
      expect(versionEntities).toHaveLength(2);
      expect(versionEntities.map(e => e.text)).toContain('3.8');
      expect(versionEntities.map(e => e.text)).toContain('3.11');
    });

    it('should extract years', () => {
      const entities = parser.extractEntities('Best frameworks in 2024 and 2025');
      
      const dateEntities = entities.filter(e => e.type === EntityType.DATE);
      expect(dateEntities).toHaveLength(2);
      expect(dateEntities[0].metadata?.year).toBe(2024);
      expect(dateEntities[1].metadata?.year).toBe(2025);
    });

    it('should handle case-insensitive matching', () => {
      const entities = parser.extractEntities('REACT vs react vs React');
      
      const reactEntities = entities.filter(e => 
        e.text.toLowerCase() === 'react' && e.type === EntityType.FRAMEWORK
      );
      expect(reactEntities).toHaveLength(3);
    });

    it('should deduplicate entities', () => {
      const entities = parser.extractEntities('Python Python Python');
      
      // Should have 3 unique occurrences by position
      const pythonEntities = entities.filter(e => e.text.toLowerCase() === 'python');
      expect(pythonEntities).toHaveLength(3);
      
      // Each should have different start index
      const startIndices = pythonEntities.map(e => e.startIndex);
      expect(new Set(startIndices).size).toBe(3);
    });
  });

  describe('extractTopics', () => {
    it('should extract main topics from query', () => {
      const topics = parser.extractTopics('How to implement authentication in React with JWT tokens');
      
      expect(topics).toContain('implement');
      expect(topics).toContain('authentication');
      expect(topics).toContain('react');
      expect(topics).toContain('jwt');
      expect(topics).toContain('tokens');
    });

    it('should filter out stop words', () => {
      const topics = parser.extractTopics('The best way to use the React framework');
      
      expect(topics).not.toContain('the');
      expect(topics).not.toContain('to');
      expect(topics).toContain('best');
      expect(topics).toContain('react');
      expect(topics).toContain('framework');
    });

    it('should extract compound terms', () => {
      const topics = parser.extractTopics('Introduction to machine learning and artificial intelligence');
      
      expect(topics).toContain('machine_learning');
      expect(topics).toContain('artificial_intelligence');
    });

    it('should handle empty or minimal input', () => {
      expect(parser.extractTopics('')).toEqual([]);
      expect(parser.extractTopics('a the of')).toEqual([]); // All stop words
    });
  });

  describe('extractTimeframe', () => {
    it('should extract specific years', () => {
      const timeframe = parser.extractTimeframe('Best frameworks in 2024');
      expect(timeframe).toEqual({ year: 2024 });
    });

    it('should extract relative timeframes', () => {
      expect(parser.extractTimeframe('Latest React features')).toEqual({ relative: 'latest' });
      expect(parser.extractTimeframe('Current best practices')).toEqual({ relative: 'current' });
      expect(parser.extractTimeframe('Recent developments')).toEqual({ relative: 'recent' });
      expect(parser.extractTimeframe('Upcoming features')).toEqual({ relative: 'upcoming' });
    });

    it('should extract quarters', () => {
      const timeframe = parser.extractTimeframe('Q1 2024 report');
      expect(timeframe).toEqual({ quarter: 'Q1', year: 2024 });
    });

    it('should return undefined for no timeframe', () => {
      expect(parser.extractTimeframe('React vs Vue comparison')).toBeUndefined();
    });
  });

  describe('extractComparisons', () => {
    it('should extract vs comparisons', () => {
      const comparisons = parser.extractComparisons('React vs Vue vs Angular');
      expect(comparisons).toContain('React');
      expect(comparisons).toContain('Vue');
      expect(comparisons).toContain('Angular');
    });

    it('should extract compare X and Y patterns', () => {
      const comparisons = parser.extractComparisons('Compare MongoDB with PostgreSQL');
      expect(comparisons).toContain('MongoDB');
      expect(comparisons).toContain('PostgreSQL');
    });

    it('should extract or patterns in comparison context', () => {
      const comparisons = parser.extractComparisons('Which is better: Python or JavaScript');
      expect(comparisons).toContain('Python');
      expect(comparisons).toContain('JavaScript');
    });

    it('should return empty array for non-comparison queries', () => {
      const comparisons = parser.extractComparisons('How to learn React');
      expect(comparisons).toEqual([]);
    });
  });

  describe('parse (integration)', () => {
    it('should parse a complex query correctly', () => {
      const result = parser.parse('Compare React vs Vue for building web apps in 2024');
      
      expect(result.raw).toBe('Compare React vs Vue for building web apps in 2024');
      expect(result.intent).toBe(QueryIntent.COMPARE);
      expect(result.topics).toContain('react');
      expect(result.topics).toContain('vue');
      expect(result.comparisons).toContain('React');
      expect(result.comparisons).toContain('Vue');
      expect(result.timeframe).toEqual({ year: 2024 });
      expect(result.confidence).toBeGreaterThan(0.5);
    });

    it('should handle minimal queries', () => {
      const result = parser.parse('React');
      
      expect(result.raw).toBe('React');
      expect(result.intent).toBe(QueryIntent.UNKNOWN);
      expect(result.topics).toContain('react');
      expect(result.entities).toHaveLength(1);
    });

    it('should normalize the query', () => {
      const result = parser.parse('  REACT   vs   VUE???  ');
      
      expect(result.normalized).toBe('react vs vue');
    });
  });

  describe('extractConstraints', () => {
    it('should extract focus constraints', () => {
      const constraints = parser.extractConstraints('Compare React and Vue with focus on performance');
      
      expect(constraints).toContainEqual({
        type: 'focus',
        value: 'performance'
      });
    });

    it('should extract exclude constraints', () => {
      const constraints = parser.extractConstraints('React tutorials excluding Redux');
      
      expect(constraints).toContainEqual({
        type: 'exclude',
        value: 'Redux'
      });
    });

    it('should handle multiple constraints', () => {
      const constraints = parser.extractConstraints('React apps focusing on performance, without Redux');
      
      expect(constraints).toHaveLength(2);
      expect(constraints.find(c => c.type === 'focus')).toBeDefined();
      expect(constraints.find(c => c.type === 'exclude')).toBeDefined();
    });
  });
});
