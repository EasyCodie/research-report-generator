import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import * as fs from 'fs/promises';
import * as path from 'path';
import {
  Report,
  ResearchQuery,
  ReportProfile,
  OutputFormat,
  ProcessedFinding,
  Citation,
  ReportArtifact,
  QueryIntent,
  SearchResult,
  SourceDocument,
  ProgressEvent
} from '../types';
import { GoogleSearchProvider } from '../retrieval/search/google';
import { GitHubSearchProvider } from '../retrieval/github/github-search';
import { WebScraper } from '../retrieval/scrapers/web-scraper';

interface GenerateReportOptions {
  profile: ReportProfile;
  formats: OutputFormat[];
  maxSources: number;
  outputDir: string;
}

export class ResearchReportGenerator extends EventEmitter {
  private reportId: string;
  private version: number = 1;
  private googleSearch: GoogleSearchProvider;
  private githubSearch: GitHubSearchProvider;
  private webScraper: WebScraper;
  
  constructor() {
    super();
    this.reportId = uuidv4();
    this.googleSearch = new GoogleSearchProvider();
    this.githubSearch = new GitHubSearchProvider();
    this.webScraper = new WebScraper();
  }
  
  async generateReport(query: string, options: GenerateReportOptions): Promise<Report> {
    const startTime = Date.now();
    
    // Parse the query
    this.emitProgress('parsing', 'Analyzing research query...', 5);
    const researchQuery = await this.parseQuery(query, options.profile);
    
    // Search for sources
    this.emitProgress('searching', 'Searching for relevant sources...', 15);
    const searchResults = await this.searchSources(researchQuery, options.maxSources);
    
    // Scrape and fetch content
    this.emitProgress('fetching', 'Fetching content from sources...', 30);
    const sourceDocuments = await this.fetchContent(searchResults);
    
    // Process and analyze
    this.emitProgress('processing', 'Processing and analyzing data...', 50);
    const findings = await this.processDocuments(sourceDocuments, researchQuery);
    
    // Generate citations
    this.emitProgress('citing', 'Generating citations...', 70);
    const citations = this.generateCitations(sourceDocuments);
    
    // Create report structure
    const report: Report = {
      id: this.reportId,
      version: this.version,
      query: researchQuery,
      findings,
      summary: await this.generateSummary(findings),
      citations,
      artifacts: [],
      createdAt: new Date(),
      updatedAt: new Date(),
      metadata: {
        sourcesAnalyzed: sourceDocuments.length,
        processingTime: Date.now() - startTime,
        reliabilityScore: this.calculateOverallReliability(sourceDocuments),
        biasWarnings: this.detectBias(findings),
        profile: options.profile
      }
    };
    
    // Generate output artifacts
    this.emitProgress('generating', 'Generating report artifacts...', 85);
    report.artifacts = await this.generateArtifacts(report, options.formats, options.outputDir);
    
    // Save metadata
    await this.saveReportMetadata(report, options.outputDir);
    
    this.emitProgress('complete', 'Report generation complete!', 100);
    
    return report;
  }
  
  private async parseQuery(query: string, profile: ReportProfile): Promise<ResearchQuery> {
    // Simple intent detection
    const intent = this.detectIntent(query);
    const topics = this.extractTopics(query);
    
    return {
      raw: query,
      intent,
      topics,
      subtopics: [],
      profile,
      language: 'en',
      timestamp: new Date()
    };
  }
  
  private detectIntent(query: string): QueryIntent {
    const lowerQuery = query.toLowerCase();
    
    if (lowerQuery.includes('compare') || lowerQuery.includes('vs') || lowerQuery.includes('versus')) {
      return QueryIntent.COMPARE;
    }
    if (lowerQuery.includes('trend') || lowerQuery.includes('latest') || lowerQuery.includes('2024') || lowerQuery.includes('2025')) {
      return QueryIntent.TREND;
    }
    if (lowerQuery.includes('how to') || lowerQuery.includes('guide') || lowerQuery.includes('tutorial')) {
      return QueryIntent.HOW_TO;
    }
    if (lowerQuery.includes('best') || lowerQuery.includes('top')) {
      return QueryIntent.BEST_OF;
    }
    if (lowerQuery.includes('overview') || lowerQuery.includes('what is')) {
      return QueryIntent.OVERVIEW;
    }
    
    return QueryIntent.UNKNOWN;
  }
  
  private extractTopics(query: string): string[] {
    // Simple keyword extraction
    const stopWords = new Set(['the', 'is', 'at', 'which', 'on', 'and', 'a', 'an', 'as', 'are', 'was', 'were', 'been', 'be', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'should', 'could', 'ought', 'may', 'might', 'must', 'can', 'shall']);
    
    const words = query.toLowerCase()
      .replace(/[^\w\s]/g, '')
      .split(/\s+/)
      .filter(word => !stopWords.has(word) && word.length > 2);
    
    // Return unique topics
    return [...new Set(words)];
  }
  
  private async searchSources(query: ResearchQuery, maxSources: number): Promise<SearchResult[]> {
    const allResults: SearchResult[] = [];
    const searchQuery = query.raw;
    
    try {
      // Perform searches in parallel for better performance
      const searchPromises: Promise<SearchResult[]>[] = [];
      
      // Google Search - allocate 60% of max sources
      const googleMaxResults = Math.ceil(maxSources * 0.6);
      searchPromises.push(
        this.googleSearch.search(searchQuery, googleMaxResults)
          .catch(err => {
            console.error('Google search failed:', err);
            return [];
          })
      );
      
      // GitHub Search - allocate 40% of max sources
      const githubMaxResults = Math.ceil(maxSources * 0.4);
      searchPromises.push(
        this.githubSearch.search(searchQuery, githubMaxResults)
          .catch(err => {
            console.error('GitHub search failed:', err);
            return [];
          })
      );
      
      // Wait for all searches to complete
      const results = await Promise.all(searchPromises);
      
      // Combine and deduplicate results
      for (const searchResults of results) {
        for (const result of searchResults) {
          // Simple deduplication by URL
          if (!allResults.some(r => r.url === result.url)) {
            allResults.push(result);
          }
        }
      }
      
      // Sort by score and return top results
      allResults.sort((a, b) => (b.score || 0) - (a.score || 0));
      
      console.log(`Found ${allResults.length} unique search results`);
      return allResults.slice(0, maxSources);
      
    } catch (error) {
      console.error('Error during search:', error);
      // Return whatever results we have
      return allResults;
    }
  }
  
  private async fetchContent(searchResults: SearchResult[]): Promise<SourceDocument[]> {
    const documents: SourceDocument[] = [];
    const maxConcurrent = 5; // Limit concurrent scraping
    
    console.log(`Fetching content from ${searchResults.length} sources...`);
    
    // Process in batches to avoid overwhelming the system
    for (let i = 0; i < searchResults.length; i += maxConcurrent) {
      const batch = searchResults.slice(i, i + maxConcurrent);
      const batchPromises = batch.map(async (result) => {
        try {
          // Skip scraping for certain GitHub URLs (we already have the info)
          if (result.url.includes('github.com') && !result.url.includes('/blob/')) {
            return {
              url: result.url,
              title: result.title,
              content: result.snippet || '', // Use snippet as content for GitHub repos
              domain: 'github.com',
              metadata: {
                source: result.source,
                fetchedAt: result.fetchedAt,
              },
              reliabilityScore: 0.9, // GitHub is reliable
            };
          }
          
          // Scrape the actual content
          const document = await this.webScraper.scrape(result.url);
          
          // Enhance with search result metadata
          document.metadata = {
            ...document.metadata,
            source: result.source,
            searchScore: result.score,
          };
          
          return document;
        } catch (error) {
          console.error(`Failed to fetch content from ${result.url}:`, error);
          // Return a minimal document on error
          return {
            url: result.url,
            title: result.title,
            content: result.snippet || '',
            domain: new URL(result.url).hostname,
            metadata: {
              source: result.source,
              fetchedAt: new Date(),
              error: true,
            },
            reliabilityScore: 0.3,
          };
        }
      });
      
      const batchResults = await Promise.all(batchPromises);
      documents.push(...batchResults);
      
      // Add a small delay between batches to be respectful
      if (i + maxConcurrent < searchResults.length) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
    
    console.log(`Successfully fetched content from ${documents.length} sources`);
    return documents;
  }
  
  private async processDocuments(documents: SourceDocument[], query: ResearchQuery): Promise<ProcessedFinding[]> {
    const findings: ProcessedFinding[] = [];
    
    if (documents.length === 0) {
      return findings;
    }
    
    // Extract key themes from documents
    const themes = this.extractThemes(documents, query);
    
    // Generate findings based on themes and query intent
    for (const theme of themes) {
      if (theme.mentions >= 2) { // Only include themes mentioned in multiple sources
        const finding: ProcessedFinding = {
          claim: theme.claim,
          evidence: theme.evidence,
          sources: theme.sources,
          confidence: this.calculateConfidence(theme),
          tags: theme.tags,
        };
        findings.push(finding);
      }
    }
    
    // Sort findings by confidence
    findings.sort((a, b) => b.confidence - a.confidence);
    
    // Limit to top 10 findings
    return findings.slice(0, 10);
  }
  
  private extractThemes(documents: SourceDocument[], query: ResearchQuery): any[] {
    const themes: any[] = [];
    const contentMap = new Map<string, Set<string>>();
    
    // Analyze each document for key information
    for (const doc of documents) {
      const content = doc.content.toLowerCase();
      const topics = query.topics.map(t => t.toLowerCase());
      
      // Look for mentions of query topics
      for (const topic of topics) {
        if (content.includes(topic)) {
          const context = this.extractContext(content, topic);
          if (!contentMap.has(topic)) {
            contentMap.set(topic, new Set());
          }
          contentMap.get(topic)?.add(doc.url);
          
          // Create or update theme
          let theme = themes.find(t => t.topic === topic);
          if (!theme) {
            theme = {
              topic,
              claim: `Key insights about ${topic}`,
              evidence: [],
              sources: [],
              mentions: 0,
              tags: [topic],
            };
            themes.push(theme);
          }
          
          // Add evidence from context
          if (context && !theme.evidence.includes(context)) {
            theme.evidence.push(context);
          }
          if (!theme.sources.includes(doc.url)) {
            theme.sources.push(doc.url);
            theme.mentions++;
          }
        }
      }
      
      // Look for comparisons if query intent is COMPARE
      if (query.intent === QueryIntent.COMPARE) {
        const comparisons = this.extractComparisons(content, topics);
        for (const comparison of comparisons) {
          let theme = themes.find(t => t.claim === comparison.claim);
          if (!theme) {
            theme = {
              topic: 'comparison',
              claim: comparison.claim,
              evidence: [comparison.evidence],
              sources: [doc.url],
              mentions: 1,
              tags: ['comparison', ...topics],
            };
            themes.push(theme);
          } else {
            if (!theme.evidence.includes(comparison.evidence)) {
              theme.evidence.push(comparison.evidence);
            }
            if (!theme.sources.includes(doc.url)) {
              theme.sources.push(doc.url);
              theme.mentions++;
            }
          }
        }
      }
    }
    
    return themes;
  }
  
  private extractContext(content: string, topic: string): string {
    const index = content.indexOf(topic);
    if (index === -1) return '';
    
    // Extract surrounding context (100 chars before and after)
    const start = Math.max(0, index - 100);
    const end = Math.min(content.length, index + topic.length + 100);
    let context = content.substring(start, end).trim();
    
    // Clean up the context
    context = context.replace(/\s+/g, ' ');
    
    // Make it a complete sentence if possible
    const sentenceEnd = context.lastIndexOf('.');
    if (sentenceEnd > 0 && sentenceEnd < context.length - 20) {
      context = context.substring(0, sentenceEnd + 1);
    }
    
    return context;
  }
  
  private extractComparisons(content: string, topics: string[]): any[] {
    const comparisons: any[] = [];
    const compareWords = ['better than', 'worse than', 'compared to', 'versus', 'vs', 'outperforms', 'superior to'];
    
    for (const word of compareWords) {
      if (content.includes(word)) {
        const index = content.indexOf(word);
        const context = this.extractContext(content, word);
        if (context) {
          // Check if any topics are mentioned in the context
          const mentionedTopics = topics.filter(t => context.includes(t));
          if (mentionedTopics.length > 0) {
            comparisons.push({
              claim: `Comparison between ${mentionedTopics.join(' and ')}`,
              evidence: context,
            });
          }
        }
      }
    }
    
    return comparisons;
  }
  
  private calculateConfidence(theme: any): number {
    let confidence = 0.5; // Base confidence
    
    // More sources = higher confidence
    confidence += Math.min(theme.mentions * 0.1, 0.3);
    
    // More evidence = higher confidence
    confidence += Math.min(theme.evidence.length * 0.05, 0.15);
    
    // Adjust based on source reliability (would need actual reliability scores)
    // For now, just use a simple heuristic
    if (theme.sources.some((s: string) => s.includes('github.com'))) {
      confidence += 0.05;
    }
    
    return Math.min(confidence, 0.95);
  }
  
  private generateCitations(documents: SourceDocument[]): Citation[] {
    return documents.map((doc, index) => ({
      id: index + 1,
      url: doc.url,
      title: doc.title,
      author: doc.author,
      accessedAt: new Date(),
      reliabilityScore: doc.reliabilityScore
    }));
  }
  
  private async generateSummary(findings: ProcessedFinding[]): Promise<string> {
    const highConfidenceFindings = findings.filter(f => f.confidence > 0.7);
    
    let summary = '## Executive Summary\n\n';
    summary += 'This research report presents key findings based on analysis of multiple sources:\n\n';
    
    highConfidenceFindings.forEach((finding, index) => {
      summary += `**Finding ${index + 1}**: ${finding.claim}\n`;
      summary += `- Confidence: ${(finding.confidence * 100).toFixed(0)}%\n`;
      summary += `- Based on ${finding.sources.length} sources\n\n`;
    });
    
    return summary;
  }
  
  private calculateOverallReliability(documents: SourceDocument[]): number {
    if (documents.length === 0) return 0;
    
    const totalScore = documents.reduce((sum, doc) => sum + (doc.reliabilityScore || 0), 0);
    return totalScore / documents.length;
  }
  
  private detectBias(findings: ProcessedFinding[]): string[] {
    const warnings: string[] = [];
    
    findings.forEach(finding => {
      if (finding.sources.length === 1) {
        warnings.push(`Single source for claim: "${finding.claim}"`);
      }
      if (finding.confidence < 0.6) {
        warnings.push(`Low confidence finding: "${finding.claim}"`);
      }
    });
    
    return warnings;
  }
  
  private async generateArtifacts(
    report: Report,
    formats: OutputFormat[],
    outputDir: string
  ): Promise<ReportArtifact[]> {
    const artifacts: ReportArtifact[] = [];
    
    // Ensure output directory exists
    const reportDir = path.join(outputDir, report.id, `v${report.version}`);
    await fs.mkdir(reportDir, { recursive: true });
    
    for (const format of formats) {
      const artifact = await this.generateArtifact(report, format, reportDir);
      artifacts.push(artifact);
    }
    
    return artifacts;
  }
  
  private async generateArtifact(
    report: Report,
    format: OutputFormat,
    outputDir: string
  ): Promise<ReportArtifact> {
    const filename = `report.${format}`;
    const filepath = path.join(outputDir, filename);
    
    let content = '';
    
    switch (format) {
      case OutputFormat.MARKDOWN:
        content = await this.generateMarkdown(report);
        break;
      case OutputFormat.HTML:
        content = await this.generateHTML(report);
        break;
      case OutputFormat.JSON:
        content = JSON.stringify(report, null, 2);
        break;
      case OutputFormat.PDF:
        // PDF generation would require puppeteer
        content = 'PDF generation not yet implemented';
        break;
    }
    
    await fs.writeFile(filepath, content, 'utf-8');
    const stats = await fs.stat(filepath);
    
    return {
      format,
      path: filepath,
      size: stats.size,
      checksum: '' // Would calculate actual checksum in production
    };
  }
  
  private async generateMarkdown(report: Report): Promise<string> {
    let markdown = `# Research Report\n\n`;
    markdown += `**Report ID**: ${report.id}\n`;
    markdown += `**Generated**: ${report.createdAt.toISOString()}\n`;
    markdown += `**Query**: "${report.query.raw}"\n\n`;
    
    markdown += report.summary + '\n\n';
    
    markdown += '## Detailed Findings\n\n';
    report.findings.forEach((finding, index) => {
      markdown += `### Finding ${index + 1}\n\n`;
      markdown += `**Claim**: ${finding.claim}\n\n`;
      markdown += `**Evidence**:\n`;
      finding.evidence.forEach(evidence => {
        markdown += `- ${evidence}\n`;
      });
      markdown += `\n**Confidence**: ${(finding.confidence * 100).toFixed(0)}%\n\n`;
    });
    
    markdown += '## Citations\n\n';
    report.citations.forEach(citation => {
      markdown += `${citation.id}. ${citation.title}. ${citation.url}. Accessed: ${citation.accessedAt.toLocaleDateString()}\n`;
    });
    
    markdown += '\n## Metadata\n\n';
    markdown += `- Sources Analyzed: ${report.metadata.sourcesAnalyzed}\n`;
    markdown += `- Processing Time: ${(report.metadata.processingTime / 1000).toFixed(2)}s\n`;
    markdown += `- Overall Reliability: ${(report.metadata.reliabilityScore * 100).toFixed(0)}%\n`;
    
    if (report.metadata.biasWarnings.length > 0) {
      markdown += '\n### ⚠️ Bias Warnings\n\n';
      report.metadata.biasWarnings.forEach(warning => {
        markdown += `- ${warning}\n`;
      });
    }
    
    return markdown;
  }
  
  private async generateHTML(report: Report): Promise<string> {
    const markdown = await this.generateMarkdown(report);
    
    // Simple markdown to HTML conversion
    // In production, would use remark/rehype
    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Research Report - ${report.id}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 900px; margin: 0 auto; padding: 20px; }
    h1 { color: #2c3e50; border-bottom: 2px solid #3498db; padding-bottom: 10px; }
    h2 { color: #34495e; margin-top: 30px; }
    h3 { color: #7f8c8d; }
    pre { background: #f4f4f4; padding: 10px; border-radius: 5px; overflow-x: auto; }
    code { background: #f4f4f4; padding: 2px 5px; border-radius: 3px; }
    blockquote { border-left: 4px solid #3498db; margin-left: 0; padding-left: 20px; color: #555; }
  </style>
</head>
<body>
  <pre>${markdown}</pre>
</body>
</html>`;
    
    return html;
  }
  
  private async saveReportMetadata(report: Report, outputDir: string): Promise<void> {
    const metadataPath = path.join(outputDir, report.id, 'metadata.json');
    await fs.mkdir(path.dirname(metadataPath), { recursive: true });
    
    const metadata = {
      id: report.id,
      version: report.version,
      query: report.query.raw,
      createdAt: report.createdAt,
      updatedAt: report.updatedAt,
      artifacts: report.artifacts.map(a => ({
        format: a.format,
        path: a.path,
        size: a.size
      })),
      metadata: report.metadata
    };
    
    await fs.writeFile(metadataPath, JSON.stringify(metadata, null, 2), 'utf-8');
  }
  
  private emitProgress(stage: string, message: string, percent: number): void {
    const event: ProgressEvent = {
      stage,
      message,
      percent,
      timestamp: new Date()
    };
    this.emit('progress', event);
  }
}
