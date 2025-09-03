import axios from 'axios';
import * as cheerio from 'cheerio';
import { SourceDocument, Scraper } from '../../types';
import { config } from '../../config/config';

export class WebScraper implements Scraper {
  private userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36';

  canScrape(url: string): boolean {
    // Don't scrape certain file types
    const excludedExtensions = ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.zip', '.tar', '.gz'];
    if (excludedExtensions.some(ext => url.toLowerCase().endsWith(ext))) {
      return false;
    }

    // Don't scrape localhost or private IPs
    if (url.includes('localhost') || url.includes('127.0.0.1') || url.includes('192.168.')) {
      return false;
    }

    return true;
  }

  async scrape(url: string): Promise<SourceDocument> {
    if (!this.canScrape(url)) {
      throw new Error(`Cannot scrape URL: ${url}`);
    }

    try {
      const response = await axios.get(url, {
        headers: {
          'User-Agent': this.userAgent,
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
          'Accept-Encoding': 'gzip, deflate',
          'DNT': '1',
          'Connection': 'keep-alive',
          'Upgrade-Insecure-Requests': '1',
        },
        timeout: config.timeouts.scrape,
        maxRedirects: 5,
        validateStatus: (status) => status < 400,
      });

      const $ = cheerio.load(response.data);
      
      // Extract metadata
      const title = this.extractTitle($);
      const author = this.extractAuthor($);
      const publishedAt = this.extractPublishDate($);
      const content = this.extractContent($);
      const domain = new URL(url).hostname;

      return {
        url,
        title,
        content,
        author,
        publishedAt,
        domain,
        metadata: {
          contentType: response.headers['content-type'],
          statusCode: response.status,
          contentLength: content.length,
          scrapedAt: new Date(),
        },
        reliabilityScore: this.calculateReliability(domain, response.status),
      };
    } catch (error: any) {
      console.error(`Failed to scrape ${url}:`, error.message);
      
      // Return a minimal document on error
      return {
        url,
        title: 'Failed to fetch',
        content: '',
        domain: new URL(url).hostname,
        metadata: {
          error: error.message,
          scrapedAt: new Date(),
        },
        reliabilityScore: 0,
      };
    }
  }

  private extractTitle($: cheerio.CheerioAPI): string {
    // Try multiple selectors for title
    const title = 
      $('meta[property="og:title"]').attr('content') ||
      $('meta[name="twitter:title"]').attr('content') ||
      $('title').text() ||
      $('h1').first().text() ||
      'Untitled';

    return title.trim().substring(0, 200);
  }

  private extractAuthor($: cheerio.CheerioAPI): string | undefined {
    const author = 
      $('meta[name="author"]').attr('content') ||
      $('meta[property="article:author"]').attr('content') ||
      $('meta[name="twitter:creator"]').attr('content') ||
      $('.author').first().text() ||
      $('[rel="author"]').first().text();

    return author?.trim();
  }

  private extractPublishDate($: cheerio.CheerioAPI): Date | undefined {
    const dateString = 
      $('meta[property="article:published_time"]').attr('content') ||
      $('meta[name="publish_date"]').attr('content') ||
      $('time[datetime]').first().attr('datetime') ||
      $('meta[property="article:modified_time"]').attr('content');

    if (dateString) {
      try {
        return new Date(dateString);
      } catch {
        return undefined;
      }
    }
    return undefined;
  }

  private extractContent($: cheerio.CheerioAPI): string {
    // Remove unwanted elements
    $('script, style, nav, header, footer, aside, .advertisement, .ads, .social-share').remove();

    // Try to find main content areas
    let content = '';

    // Try article content first
    const articleSelectors = [
      'article',
      'main',
      '[role="main"]',
      '.content',
      '.post-content',
      '.entry-content',
      '.article-body',
      '#content',
    ];

    for (const selector of articleSelectors) {
      const element = $(selector);
      if (element.length > 0) {
        content = element.text();
        if (content.length > 100) {
          break;
        }
      }
    }

    // Fallback to body if no article content found
    if (content.length < 100) {
      content = $('body').text();
    }

    // Clean up the content
    content = content
      .replace(/\s+/g, ' ') // Replace multiple spaces with single space
      .replace(/\n{3,}/g, '\n\n') // Replace multiple newlines with double newline
      .trim();

    // Limit content length to prevent memory issues
    return content.substring(0, 50000);
  }

  private calculateReliability(domain: string, statusCode: number): number {
    let score = 0.5; // Base score

    // HTTPS bonus
    if (domain.startsWith('https://')) {
      score += 0.1;
    }

    // Known reliable domains
    const reliableDomains = {
      'github.com': 0.95,
      'stackoverflow.com': 0.9,
      'developer.mozilla.org': 0.95,
      'docs.microsoft.com': 0.9,
      'aws.amazon.com': 0.9,
      'cloud.google.com': 0.9,
      'arxiv.org': 0.85,
      'nature.com': 0.9,
      'sciencedirect.com': 0.85,
    };

    for (const [reliableDomain, domainScore] of Object.entries(reliableDomains)) {
      if (domain.includes(reliableDomain)) {
        return domainScore;
      }
    }

    // Educational and government sites
    if (domain.endsWith('.edu')) score = 0.85;
    else if (domain.endsWith('.gov')) score = 0.9;
    else if (domain.endsWith('.org')) score += 0.1;

    // Status code penalty
    if (statusCode >= 400) {
      score -= 0.3;
    }

    return Math.max(0, Math.min(score, 1.0));
  }
}
