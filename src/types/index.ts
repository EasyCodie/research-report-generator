// Core types and interfaces for the Research Report Generator

export enum QueryIntent {
  COMPARE = 'compare',
  TREND = 'trend',
  HOW_TO = 'how-to',
  OVERVIEW = 'overview',
  BEST_OF = 'best-of',
  TROUBLESHOOTING = 'troubleshooting',
  UNKNOWN = 'unknown'
}

export enum ReportProfile {
  EXECUTIVE = 'executive',
  TECHNICAL = 'technical',
  ACADEMIC = 'academic'
}

export enum OutputFormat {
  MARKDOWN = 'md',
  HTML = 'html',
  PDF = 'pdf',
  JSON = 'json'
}

export interface ResearchQuery {
  raw: string;
  intent: QueryIntent;
  topics: string[];
  subtopics: string[];
  profile: ReportProfile;
  language: string;
  timestamp: Date;
}

export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
  source: string;
  score: number;
  fetchedAt: Date;
}

export interface SourceDocument {
  url: string;
  title: string;
  content: string;
  author?: string;
  publishedAt?: Date;
  domain: string;
  metadata: Record<string, any>;
  reliabilityScore?: number;
}

export interface ProcessedFinding {
  claim: string;
  evidence: string[];
  sources: string[];
  confidence: number;
  tags: string[];
  biasIndicators?: string[];
}

export interface Citation {
  id: number;
  url: string;
  title: string;
  author?: string;
  accessedAt: Date;
  reliabilityScore?: number;
}

export interface Report {
  id: string;
  version: number;
  query: ResearchQuery;
  findings: ProcessedFinding[];
  summary: string;
  citations: Citation[];
  artifacts: ReportArtifact[];
  createdAt: Date;
  updatedAt: Date;
  metadata: ReportMetadata;
}

export interface ReportArtifact {
  format: OutputFormat;
  path: string;
  size: number;
  checksum: string;
}

export interface ReportMetadata {
  sourcesAnalyzed: number;
  processingTime: number;
  reliabilityScore: number;
  biasWarnings: string[];
  profile: ReportProfile;
}

export interface ReliabilityScore {
  domain: string;
  score: number;
  rationale: string;
  factors: {
    https: boolean;
    authorPresence: boolean;
    citationCount: number;
    domainAge?: number;
    contentQuality?: number;
  };
}

export interface ProgressEvent {
  stage: string;
  message: string;
  percent: number;
  data?: any;
  timestamp: Date;
}

export interface SearchProvider {
  name: string;
  search(query: string): Promise<SearchResult[]>;
}

export interface Scraper {
  canScrape(url: string): boolean;
  scrape(url: string): Promise<SourceDocument>;
}

export interface ReportGenerator {
  generate(report: Report, format: OutputFormat): Promise<ReportArtifact>;
}

export interface ProcessingOptions {
  maxSources: number;
  dedupeThreshold: number;
  biasDetectionEnabled: boolean;
  factCheckEnabled: boolean;
  minReliabilityScore: number;
}

export interface GenerationOptions {
  formats: OutputFormat[];
  profile: ReportProfile;
  includeMethodology: boolean;
  includeAppendix: boolean;
  maxLength?: number;
}
