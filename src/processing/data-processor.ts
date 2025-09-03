/**
 * Data processing module for research content
 * Handles deduplication, bias detection, fact checking, and content analysis
 */

import { SourceDocument, ProcessedFinding, SearchResult } from '../types';
import { ScoringEngine } from '../utils/scoring';
import { getDomainInfo } from '../../config/domains';

export interface ProcessingResult {
  findings: ProcessedFinding[];
  duplicatesRemoved: number;
  biasWarnings: string[];
  factCheckResults: FactCheckResult[];
  statistics: ProcessingStatistics;
}

export interface FactCheckResult {
  claim: string;
  sources: string[];
  confidence: number;
  verdict: 'supported' | 'disputed' | 'unverified';
  explanation?: string;
}

export interface ProcessingStatistics {
  totalSources: number;
  uniqueSources: number;
  avgReliabilityScore: number;
  contentTypes: Record<string, number>;
  dateRange: { earliest: Date | null; latest: Date | null };
}

export interface BiasIndicator {
  type: 'source' | 'language' | 'coverage' | 'temporal';
  severity: 'low' | 'medium' | 'high';
  description: string;
  evidence: string[];
}

export class DataProcessor {
  private readonly similarityThreshold = 0.85; // For deduplication
  private readonly minSourcesForClaim = 2; // Minimum sources to support a claim

  /**
   * Process source documents into structured findings
   * @param documents - Source documents to process
   * @param query - Original query for context
   * @returns Processing result with findings and metadata
   */
  async processDocuments(
    documents: SourceDocument[],
    query: string
  ): Promise<ProcessingResult> {
    // Step 1: Deduplicate content
    const { unique, duplicates } = this.deduplicateDocuments(documents);

    // Step 2: Extract key findings
    const findings = this.extractFindings(unique);

    // Step 3: Detect bias
    const biasWarnings = this.detectBias(unique, findings);

    // Step 4: Basic fact checking
    const factCheckResults = this.performFactChecking(findings, unique);

    // Step 5: Calculate statistics
    const statistics = this.calculateStatistics(unique);

    return {
      findings,
      duplicatesRemoved: duplicates.length,
      biasWarnings,
      factCheckResults,
      statistics
    };
  }

  /**
   * Deduplicate documents based on content similarity
   * @param documents - Documents to deduplicate
   * @returns Unique documents and duplicates
   */
  private deduplicateDocuments(documents: SourceDocument[]): {
    unique: SourceDocument[];
    duplicates: SourceDocument[];
  } {
    const unique: SourceDocument[] = [];
    const duplicates: SourceDocument[] = [];
    const contentHashes = new Set<string>();
    const urlNormalized = new Set<string>();

    for (const doc of documents) {
      // Check URL-based duplication (normalize URLs)
      const normalizedUrl = this.normalizeUrl(doc.url);
      if (urlNormalized.has(normalizedUrl)) {
        duplicates.push(doc);
        continue;
      }

      // Check content-based duplication
      const contentHash = this.hashContent(doc.content);
      if (contentHashes.has(contentHash)) {
        duplicates.push(doc);
        continue;
      }

      // Check similarity with existing unique documents
      let isDuplicate = false;
      for (const uniqueDoc of unique) {
        const similarity = this.calculateSimilarity(doc.content, uniqueDoc.content);
        if (similarity > this.similarityThreshold) {
          duplicates.push(doc);
          isDuplicate = true;
          break;
        }
      }

      if (!isDuplicate) {
        unique.push(doc);
        contentHashes.add(contentHash);
        urlNormalized.add(normalizedUrl);
      }
    }

    return { unique, duplicates };
  }

  /**
   * Extract key findings from documents
   * @param documents - Source documents
   * @returns Processed findings
   */
  private extractFindings(documents: SourceDocument[]): ProcessedFinding[] {
    const findings: ProcessedFinding[] = [];
    const claimMap = new Map<string, ProcessedFinding>();

    for (const doc of documents) {
      // Extract sentences that look like claims or facts
      const claims = this.extractClaims(doc.content);
      
      for (const claim of claims) {
        const normalizedClaim = this.normalizeClaim(claim);
        
        if (claimMap.has(normalizedClaim)) {
          // Update existing finding
          const existing = claimMap.get(normalizedClaim)!;
          existing.evidence.push(this.extractEvidence(doc.content, claim));
          existing.sources.push(doc.url);
          existing.confidence = this.updateConfidence(existing.confidence, doc);
        } else {
          // Create new finding
          const finding: ProcessedFinding = {
            claim: claim,
            evidence: [this.extractEvidence(doc.content, claim)],
            sources: [doc.url],
            confidence: this.calculateInitialConfidence(doc),
            tags: this.extractTags(claim),
            biasIndicators: []
          };
          claimMap.set(normalizedClaim, finding);
          findings.push(finding);
        }
      }
    }

    // Sort by confidence and number of sources
    findings.sort((a, b) => {
      const scoreA = a.confidence * a.sources.length;
      const scoreB = b.confidence * b.sources.length;
      return scoreB - scoreA;
    });

    return findings;
  }

  /**
   * Detect potential bias in sources and findings
   * @param documents - Source documents
   * @param findings - Processed findings
   * @returns Bias warnings
   */
  private detectBias(
    documents: SourceDocument[],
    findings: ProcessedFinding[]
  ): string[] {
    const warnings: string[] = [];
    const indicators: BiasIndicator[] = [];

    // Source diversity bias
    const domains = documents.map(d => new URL(d.url).hostname);
    const uniqueDomains = new Set(domains);
    if (uniqueDomains.size < 3 && documents.length > 5) {
      indicators.push({
        type: 'source',
        severity: 'high',
        description: 'Limited source diversity',
        evidence: [`Only ${uniqueDomains.size} unique domains for ${documents.length} sources`]
      });
    }

    // Check for single dominant source
    const domainCounts = this.countOccurrences(domains);
    const maxCount = Math.max(...Object.values(domainCounts));
    if (maxCount > documents.length * 0.5) {
      const dominantDomain = Object.keys(domainCounts).find(k => domainCounts[k] === maxCount);
      indicators.push({
        type: 'source',
        severity: 'medium',
        description: 'Single source dominance',
        evidence: [`${dominantDomain} accounts for ${maxCount}/${documents.length} sources`]
      });
    }

    // Language bias detection (sentiment and loaded terms)
    const loadedTerms = [
      'obviously', 'clearly', 'undoubtedly', 'definitely', 'surely',
      'terrible', 'horrible', 'amazing', 'incredible', 'disaster',
      'revolutionary', 'game-changing', 'breakthrough', 'miracle'
    ];
    
    for (const finding of findings) {
      const text = finding.claim.toLowerCase();
      const foundTerms = loadedTerms.filter(term => text.includes(term));
      if (foundTerms.length > 0) {
        finding.biasIndicators = finding.biasIndicators || [];
        finding.biasIndicators.push(`Contains loaded language: ${foundTerms.join(', ')}`);
      }
    }

    // Temporal bias (all sources from similar time period)
    const dates = documents
      .map(d => d.publishedAt)
      .filter(d => d !== undefined) as Date[];
    
    if (dates.length > 3) {
      const dateRange = this.calculateDateRange(dates);
      const daysDiff = (dateRange.latest.getTime() - dateRange.earliest.getTime()) / (1000 * 60 * 60 * 24);
      
      if (daysDiff < 30) {
        indicators.push({
          type: 'temporal',
          severity: 'low',
          description: 'Narrow temporal range',
          evidence: [`All dated sources within ${Math.round(daysDiff)} days`]
        });
      }
    }

    // Coverage bias (missing perspectives)
    const categories = documents.map(d => getDomainInfo(new URL(d.url).hostname).category);
    const uniqueCategories = new Set(categories);
    
    if (uniqueCategories.size === 1 && documents.length > 3) {
      indicators.push({
        type: 'coverage',
        severity: 'medium',
        description: 'Single perspective type',
        evidence: [`All sources are ${categories[0]} content`]
      });
    }

    // Convert indicators to warnings
    for (const indicator of indicators) {
      warnings.push(
        `${indicator.severity.toUpperCase()} BIAS: ${indicator.description} - ${indicator.evidence.join('; ')}`
      );
    }

    return warnings;
  }

  /**
   * Perform basic fact checking on findings
   * @param findings - Findings to check
   * @param documents - Source documents for cross-reference
   * @returns Fact check results
   */
  private performFactChecking(
    findings: ProcessedFinding[],
    documents: SourceDocument[]
  ): FactCheckResult[] {
    const results: FactCheckResult[] = [];

    for (const finding of findings) {
      // Check if claim appears in multiple independent sources
      const independentSources = this.getIndependentSources(finding.sources);
      
      let verdict: 'supported' | 'disputed' | 'unverified';
      let confidence: number;
      let explanation: string | undefined;

      if (independentSources.length >= this.minSourcesForClaim) {
        verdict = 'supported';
        confidence = Math.min(0.9, 0.5 + (independentSources.length * 0.1));
        explanation = `Confirmed by ${independentSources.length} independent sources`;
      } else if (independentSources.length === 1) {
        verdict = 'unverified';
        confidence = 0.3;
        explanation = 'Only one source available';
      } else {
        // Check for contradictions
        const hasContradiction = this.checkForContradictions(finding.claim, documents);
        if (hasContradiction) {
          verdict = 'disputed';
          confidence = 0.2;
          explanation = 'Conflicting information found in sources';
        } else {
          verdict = 'unverified';
          confidence = 0.4;
          explanation = 'Insufficient sources for verification';
        }
      }

      results.push({
        claim: finding.claim,
        sources: finding.sources,
        confidence,
        verdict,
        explanation
      });
    }

    return results;
  }

  /**
   * Calculate statistics about processed documents
   * @param documents - Source documents
   * @returns Processing statistics
   */
  private calculateStatistics(documents: SourceDocument[]): ProcessingStatistics {
    const domains = documents.map(d => new URL(d.url).hostname);
    const uniqueDomains = new Set(domains);

    // Calculate average reliability
    const reliabilityScores = documents.map(d => 
      d.reliabilityScore || getDomainInfo(new URL(d.url).hostname).score
    );
    const avgReliability = reliabilityScores.reduce((a, b) => a + b, 0) / reliabilityScores.length;

    // Categorize content types
    const contentTypes: Record<string, number> = {};
    for (const doc of documents) {
      const category = getDomainInfo(new URL(doc.url).hostname).category;
      contentTypes[category] = (contentTypes[category] || 0) + 1;
    }

    // Date range
    const dates = documents
      .map(d => d.publishedAt)
      .filter(d => d !== undefined) as Date[];
    const dateRange = dates.length > 0 
      ? this.calculateDateRange(dates)
      : { earliest: null, latest: null };

    return {
      totalSources: documents.length,
      uniqueSources: uniqueDomains.size,
      avgReliabilityScore: avgReliability,
      contentTypes,
      dateRange
    };
  }

  // Helper methods

  private normalizeUrl(url: string): string {
    try {
      const urlObj = new URL(url);
      // Remove trailing slashes, fragments, and common tracking params
      urlObj.hash = '';
      urlObj.searchParams.delete('utm_source');
      urlObj.searchParams.delete('utm_medium');
      urlObj.searchParams.delete('utm_campaign');
      let normalized = urlObj.toString();
      if (normalized.endsWith('/')) {
        normalized = normalized.slice(0, -1);
      }
      return normalized.toLowerCase();
    } catch {
      return url.toLowerCase();
    }
  }

  private hashContent(content: string): string {
    // Simple hash for deduplication (in production, use proper hashing)
    const normalized = content.toLowerCase().replace(/\s+/g, ' ').trim();
    let hash = 0;
    for (let i = 0; i < normalized.length; i++) {
      const char = normalized.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return hash.toString(36);
  }

  private calculateSimilarity(text1: string, text2: string): number {
    // Simple Jaccard similarity (in production, use better algorithms)
    const words1 = new Set(text1.toLowerCase().split(/\s+/));
    const words2 = new Set(text2.toLowerCase().split(/\s+/));
    
    const intersection = new Set([...words1].filter(x => words2.has(x)));
    const union = new Set([...words1, ...words2]);
    
    return intersection.size / union.size;
  }

  private extractClaims(content: string): string[] {
    // Simple claim extraction (in production, use NLP)
    const sentences = content.match(/[^.!?]+[.!?]+/g) || [];
    const claims: string[] = [];
    
    const claimIndicators = [
      'research shows', 'studies indicate', 'according to', 'data suggests',
      'experts say', 'it has been', 'statistics show', 'reports confirm',
      'is known to', 'has been proven', 'evidence suggests'
    ];
    
    for (const sentence of sentences) {
      const lower = sentence.toLowerCase();
      if (claimIndicators.some(indicator => lower.includes(indicator))) {
        claims.push(sentence.trim());
      } else if (sentence.match(/\d+%/) || sentence.match(/\$[\d,]+/)) {
        // Sentences with statistics
        claims.push(sentence.trim());
      }
    }
    
    return claims.slice(0, 50); // Limit to prevent overwhelming
  }

  private normalizeClaim(claim: string): string {
    return claim.toLowerCase()
      .replace(/[^\w\s]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private extractEvidence(content: string, claim: string): string {
    // Extract surrounding context as evidence
    const index = content.indexOf(claim);
    if (index === -1) return claim;
    
    const start = Math.max(0, index - 100);
    const end = Math.min(content.length, index + claim.length + 100);
    
    return '...' + content.substring(start, end).trim() + '...';
  }

  private calculateInitialConfidence(doc: SourceDocument): number {
    const domainScore = doc.reliabilityScore || 0.5;
    const hasAuthor = doc.author ? 0.1 : 0;
    const hasDate = doc.publishedAt ? 0.1 : 0;
    
    return Math.min(1, domainScore + hasAuthor + hasDate);
  }

  private updateConfidence(current: number, newDoc: SourceDocument): number {
    const newScore = this.calculateInitialConfidence(newDoc);
    // Weighted average favoring higher scores
    return (current * 0.7 + newScore * 0.3);
  }

  private extractTags(claim: string): string[] {
    const tags: string[] = [];
    const lower = claim.toLowerCase();
    
    // Extract technology mentions
    const techTerms = ['api', 'framework', 'library', 'database', 'cloud', 'server', 'client'];
    techTerms.forEach(term => {
      if (lower.includes(term)) tags.push(term);
    });
    
    // Extract action types
    if (lower.includes('compar')) tags.push('comparison');
    if (lower.includes('perform')) tags.push('performance');
    if (lower.includes('secur')) tags.push('security');
    if (lower.includes('scal')) tags.push('scalability');
    
    return [...new Set(tags)];
  }

  private countOccurrences(items: string[]): Record<string, number> {
    const counts: Record<string, number> = {};
    for (const item of items) {
      counts[item] = (counts[item] || 0) + 1;
    }
    return counts;
  }

  private calculateDateRange(dates: Date[]): { earliest: Date; latest: Date } {
    const sorted = dates.sort((a, b) => a.getTime() - b.getTime());
    return {
      earliest: sorted[0],
      latest: sorted[sorted.length - 1]
    };
  }

  private getIndependentSources(urls: string[]): string[] {
    const domains = urls.map(url => new URL(url).hostname);
    const uniqueDomains = [...new Set(domains)];
    return uniqueDomains;
  }

  private checkForContradictions(claim: string, documents: SourceDocument[]): boolean {
    // Simple contradiction detection
    const negations = ['not', 'no', 'never', 'false', 'incorrect', 'wrong', 'disputed'];
    const claimLower = claim.toLowerCase();
    
    for (const doc of documents) {
      const contentLower = doc.content.toLowerCase();
      // Check if document mentions the claim with negation
      for (const negation of negations) {
        if (contentLower.includes(negation) && contentLower.includes(claimLower.substring(0, 30))) {
          return true;
        }
      }
    }
    
    return false;
  }
}
