import axios from 'axios';
import { SearchResult, SearchProvider } from '../../types';
import { config } from '../../config/config';

export class GoogleSearchProvider implements SearchProvider {
  name = 'Google';
  private baseUrl = 'https://www.googleapis.com/customsearch/v1';
  private cseId: string;
  private apiKey: string;

  constructor() {
    this.cseId = config.google.cseId;
    this.apiKey = config.google.apiKey;
  }

  async search(query: string, maxResults: number = 10): Promise<SearchResult[]> {
    const results: SearchResult[] = [];
    const itemsPerRequest = 10; // Google API limit
    const numRequests = Math.ceil(maxResults / itemsPerRequest);

    try {
      for (let i = 0; i < numRequests; i++) {
        const startIndex = i * itemsPerRequest + 1;
        const response = await this.performSearch(query, startIndex);
        
        if (response.items) {
          const searchResults = response.items.map((item: any) => this.transformResult(item));
          results.push(...searchResults);
          
          // Stop if we have enough results
          if (results.length >= maxResults) {
            break;
          }
        }
        
        // Stop if there are no more results
        if (!response.queries?.nextPage) {
          break;
        }

        // Add a small delay to respect rate limits
        if (i < numRequests - 1) {
          await this.delay(100);
        }
      }

      return results.slice(0, maxResults);
    } catch (error) {
      console.error('Google Search API error:', error);
      // Return partial results if any were collected
      return results;
    }
  }

  private async performSearch(query: string, startIndex: number): Promise<any> {
    try {
      const response = await axios.get(this.baseUrl, {
        params: {
          key: this.apiKey,
          cx: this.cseId,
          q: query,
          start: startIndex,
          num: 10, // Max allowed by API
        },
        timeout: config.timeouts.request,
      });

      return response.data;
    } catch (error: any) {
      if (error.response?.status === 429) {
        console.warn('Google API rate limit reached, waiting before retry...');
        await this.delay(2000);
        // Retry once after delay
        return this.performSearch(query, startIndex);
      }
      throw error;
    }
  }

  private transformResult(item: any): SearchResult {
    return {
      title: item.title || 'Untitled',
      url: item.link || '',
      snippet: item.snippet || '',
      source: 'Google',
      score: this.calculateRelevanceScore(item),
      fetchedAt: new Date(),
    };
  }

  private calculateRelevanceScore(item: any): number {
    // Simple scoring based on available metadata
    let score = 0.5; // Base score

    // Boost for having rich snippets
    if (item.snippet) score += 0.1;
    
    // Boost for having page metadata
    if (item.pagemap?.metatags) score += 0.1;
    
    // Boost for being from a known reliable domain
    const reliableDomains = ['github.com', 'stackoverflow.com', 'docs.', 'developer.', '.edu', '.gov'];
    if (reliableDomains.some(domain => item.link?.includes(domain))) {
      score += 0.2;
    }

    // Boost for fresh content (if date is available)
    if (item.pagemap?.metatags?.[0]?.['article:modified_time']) {
      const modifiedDate = new Date(item.pagemap.metatags[0]['article:modified_time']);
      const daysSinceModified = (Date.now() - modifiedDate.getTime()) / (1000 * 60 * 60 * 24);
      if (daysSinceModified < 30) score += 0.15;
      else if (daysSinceModified < 90) score += 0.1;
      else if (daysSinceModified < 365) score += 0.05;
    }

    return Math.min(score, 1.0);
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
