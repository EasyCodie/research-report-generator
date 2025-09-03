# WARP.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

## Project Overview

An autonomous research report generator that produces structured, source-backed reports from natural language queries. The system automatically searches multiple sources (Google, Bing, GitHub), synthesizes findings, and generates comprehensive reports in multiple formats (Markdown, HTML, PDF).

## Repository Structure

- `src/` - TypeScript source code
  - `core/` - ResearchReportGenerator main engine
  - `server/` - Fastify REST API server
  - `cli/` - Command-line interface (integrated in index.ts)
  - `parser/` - Query parsing and intent detection
  - `retrieval/` - Search, scraping, and data fetching
    - `github/` - GitHub API integration
    - `scrapers/` - Web scraping logic
    - `search/` - Search provider integrations
  - `processing/` - Data processing pipeline
  - `generation/` - Report generation (MD, HTML, PDF)
    - `templates/` - Report templates
  - `utils/` - Utilities (cache, http, logger)
  - `types/` - TypeScript interfaces and enums
  - `config/` - Configuration management
- `config/` - Configuration files
  - `profiles/` - Report profiles (executive.json, technical.json)
  - `sources/` - Source reliability scoring (reliability.json)
- `tests/` - Test suites
  - `unit/` - Unit tests
  - `integration/` - Integration tests
- `reports/` - Generated reports output directory
- `.data/` - Cache and local database storage

## Development Commands

### Install Dependencies
```bash
npm install
```

### Build
```bash
npm run build
# Compiles TypeScript to dist/ directory
```

### Run Development Mode
```bash
npm run dev
# Uses tsx watch for hot reloading
```

### Run CLI
```bash
# Generate a report
npm run cli generate "Your research query" --profile technical --formats md,html,pdf --max-sources 10

# Start interactive mode (not yet implemented)
npm run cli interactive

# Schedule periodic reports (not yet implemented)
npm run cli schedule --config config/schedules.json
```

### Run API Server
```bash
# Development server with auto-reload
npm run serve

# Production server
npm run build && npm start

# Server runs on port 3000 by default (configurable via PORT env var)
```

### Testing
```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run coverage
```

### Code Quality
```bash
# Lint code
npm run lint

# Format code
npm run format

# Type checking
npm run typecheck
```

## Configuration

### Environment Variables

Create a `.env` file in the project root. See `.env.example` for template.

#### Required API Keys
- `GOOGLE_CSE_ID` - Google Custom Search Engine ID
- `GOOGLE_API_KEY` - Google API key for search
- `BING_API_KEY` - Bing Search API key
- `GITHUB_TOKEN` - GitHub personal access token

#### Optional Configuration
- `PORT` (default: 3000) - API server port
- `NODE_ENV` (default: development) - Environment mode
- `CACHE_DB_PATH` (default: .data/cache.sqlite) - Cache database location
- `REPORTS_DIR` (default: reports) - Output directory for generated reports
- `PUPPETEER_EXECUTABLE_PATH` - Custom Chrome/Chromium path for web scraping
- `RATE_LIMIT_GLOBAL` (default: 10) - Global rate limit (requests/second)
- `RATE_LIMIT_PER_DOMAIN` (default: 2) - Per-domain rate limit
- `REQUEST_TIMEOUT` (default: 30000) - HTTP request timeout (ms)
- `SCRAPE_TIMEOUT` (default: 60000) - Web scraping timeout (ms)
- `MAX_CONCURRENT_SEARCHES` (default: 3) - Concurrent search operations
- `MAX_CONCURRENT_SCRAPES` (default: 5) - Concurrent scrape operations

## Architecture

### Core Components

1. **ResearchReportGenerator** (`src/core/ResearchReportGenerator.ts`)
   - Main orchestrator extending EventEmitter for progress tracking
   - Coordinates the entire pipeline from query to report generation
   - Emits progress events at each stage

2. **Query Parser** (`src/parser/`)
   - Detects intent (compare, trend, how-to, best-of, overview)
   - Extracts topics and subtopics from natural language queries
   - Maps queries to appropriate report profiles

3. **Retrieval Layer** (`src/retrieval/`)
   - Search providers for Google, Bing APIs
   - GitHub repository and code search
   - Web scraping with reliability scoring
   - Content deduplication and caching

4. **Processing Pipeline** (`src/processing/`)
   - Document analysis and NLP
   - Bias detection and fact-checking
   - Evidence extraction and claim validation
   - Source reliability scoring

5. **Report Generation** (`src/generation/`)
   - Profile-based report structuring (executive, technical, academic)
   - Multi-format output (Markdown, HTML, PDF, JSON)
   - Citation generation and source attribution
   - Template-based rendering

6. **API Server** (`src/server/app.ts`)
   - Fastify-based REST API
   - Job tracking and async processing
   - Server-Sent Events for progress streaming
   - Report artifact management

### Request Flow

1. **Query Submission** → Parser analyzes intent and extracts topics
2. **Search Phase** → Multiple search providers query in parallel
3. **Content Retrieval** → Web scraping and API fetching with caching
4. **Processing** → Deduplication, bias detection, fact-checking
5. **Synthesis** → Finding extraction and evidence compilation
6. **Generation** → Report rendering based on profile
7. **Output** → Multi-format artifacts saved to `reports/` directory

### Report Profiles

Configured in `config/profiles/`:
- **Executive**: High-level summaries with key findings (800 word summary limit)
- **Technical**: Detailed analysis with code examples, performance metrics, implementation details
- **Academic**: Citation-heavy with methodology focus

Each profile controls:
- Section enablement and priority
- Maximum lengths and formatting
- Source prioritization (e.g., technical profile prioritizes GitHub, documentation)
- Citation style and detail level

## Key Design Patterns

### Event-Driven Progress Tracking
The `ResearchReportGenerator` extends EventEmitter to provide real-time progress updates:
```typescript
generator.on('progress', (event) => {
  // event.stage, event.message, event.percent
});
```

### TypeScript Configuration
- Strict mode enabled with comprehensive type checking
- Path aliases configured for clean imports (`@utils/*`, `@types/*`, etc.)
- Separate build config (`tsconfig.build.json`) for production builds

### Reliability Scoring System
Domain-based reliability scores in `config/sources/reliability.json`:
- Factors: HTTPS, author presence, citation count, domain age
- Scores influence source ranking and report confidence levels

### Job-Based API Processing
API server tracks async report generation jobs with status, progress, and artifacts:
- Jobs stored in memory Map (production would use persistent storage)
- Background processing with progress events
- Artifact retrieval endpoints for completed reports

## Development Tips

### Running a Single Test
```bash
# When vitest is configured (test runner for this project)
npm run test -- path/to/test.spec.ts
```

### API Endpoints
- `POST /api/reports` - Create new report
- `GET /api/reports/{id}` - Get report status
- `GET /api/reports/{id}/download?format=pdf` - Download report artifact
- `GET /api/reports` - List all reports
- `GET /api/health` - Health check

### Common Issues

1. **Missing API Keys**: Ensure all required environment variables are set
2. **Rate Limiting**: Adjust `RATE_LIMIT_*` variables if hitting API limits
3. **Scraping Timeouts**: Increase `SCRAPE_TIMEOUT` for slow sites
4. **Memory Issues**: Reduce `MAX_CONCURRENT_*` settings for limited resources
