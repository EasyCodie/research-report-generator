# Research Report Generator

An autonomous research report generator that produces structured, source-backed reports from natural language queries. The system automatically searches multiple sources, synthesizes findings, and generates comprehensive reports in multiple formats.

## Features

- **Multi-Source Research**: Searches Google, Bing, GitHub, and web scraping for comprehensive data
- **Intelligent Processing**: Deduplication, bias detection, and reliability scoring
- **AI-Powered Evaluation**: OpenAI-based fact-checking and quality scoring (via Python evaluator)
- **Multiple Output Formats**: Markdown, HTML, and PDF reports with citations
- **Real-time Progress**: Live updates via SSE for long-running reports
- **Auto-refresh**: Scheduled updates with diff tracking
- **Customizable Profiles**: Executive, Technical, and Academic report styles
- **API & CLI**: Both command-line and REST API interfaces

## Architecture

```
┌─────────────┐     ┌──────────────┐     ┌──────────────┐
│   Parser    │────▶  Retrieval    │────▶  Processing  │
└─────────────┘     └──────────────┘     └──────────────┘
                           │                      │
                    ┌──────▼──────┐       ┌──────▼──────┐
                    │   Search    │       │   Dedupe    │
                    │   Scraping  │       │   Bias Det. │
                    │   GitHub    │       │   Fact Check│
                    └─────────────┘       └──────┬──────┘
                                                 │
                    ┌─────────────────────────────▼──────┐
                    │         Report Generator           │
                    │      (Markdown, HTML, PDF)         │
                    └────────────────────────────────────┘
```

## Quick Start

### Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/research-report-generator.git
cd research-report-generator

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Edit .env with your API keys

# Build the project
npm run build
```

### CLI Usage

```bash
# Generate a report
npm run cli generate "Compare the latest open-source vector databases in 2024" --profile technical

# Start interactive mode
npm run cli interactive

# Schedule periodic reports
npm run cli schedule --config config/schedules.json
```

### API Server

```bash
# Start the server
npm run serve

# API will be available at http://localhost:3000
# OpenAPI docs at http://localhost:3000/docs
```

### API Example

```bash
# Create a new report
curl -X POST http://localhost:3000/api/reports \
  -H "Content-Type: application/json" \
  -d '{
    "query": "State of WebAssembly in 2025",
    "profile": "executive",
    "formats": ["md", "html", "pdf"]
  }'

# Stream progress
curl http://localhost:3000/api/reports/{id}/stream

# Download report
curl http://localhost:3000/api/reports/{id}/download?format=pdf
```

### Python Evaluator (Optional)

The project includes a Python-based evaluator for fact-checking and quality scoring:

```bash
# Install Python dependencies
cd evaluation
pip install -r requirements.txt

# Evaluate a report (from project root)
python evaluation/src/evaluator.py --query "Your original query" --draft reports/YOUR_REPORT/report.md --out evaluation/outputs/results

# Or via API
curl -X POST http://localhost:3000/api/evaluate \
  -H "Content-Type: application/json" \
  -d '{"query": "Your query", "reportId": "report-id"}'
```

The evaluator uses OpenAI to:
- Extract and verify claims
- Score reports on accuracy, coverage, and quality
- Auto-fix low-scoring reports

See [evaluation/docs/EVALUATOR_GUIDE.md](evaluation/docs/EVALUATOR_GUIDE.md) for detailed setup instructions.

## Configuration

### Environment Variables

```env
# Search APIs
GOOGLE_CSE_ID=your_google_cse_id
GOOGLE_API_KEY=your_google_api_key
BING_API_KEY=your_bing_api_key

# GitHub
GITHUB_TOKEN=your_github_token

# Server
PORT=3000
NODE_ENV=production

# Storage
CACHE_DB_PATH=.data/cache.sqlite
REPORTS_DIR=reports

# Optional
PUPPETEER_EXECUTABLE_PATH=/path/to/chrome

# For Python evaluator (optional)
OPENAI_API_KEY=your_openai_api_key
# OPENAI_MODEL=gpt-4  # Defaults to gpt-3.5-turbo
```

### Profiles

Configure report styles in `config/profiles/`:
- `executive.json` - High-level summaries with key findings
- `technical.json` - Detailed technical analysis with code examples
- `academic.json` - Citation-heavy with methodology focus

### Reliability Scoring

Domain reliability scores in `config/sources/reliability.json`:
```json
{
  "github.com": { "score": 0.95, "rationale": "Official source code" },
  "arxiv.org": { "score": 0.90, "rationale": "Peer-reviewed papers" },
  "medium.com": { "score": 0.60, "rationale": "User-generated content" }
}
```

## Development

```bash
# Run in development mode
npm run dev

# Run tests
npm test

# Run tests with coverage
npm run coverage

# Lint code
npm run lint

# Format code
npm run format

# Type check
npm run typecheck
```

## Testing

```bash
# Unit tests
npm run test:unit

# Integration tests
npm run test:integration

# E2E tests
npm run test:e2e

# Watch mode
npm run test:watch
```

## Project Structure

```
research-report-generator/
├── src/                # TypeScript/Node.js source code
│   ├── config/         # Configuration management
│   ├── parser/         # Query parsing and intent detection
│   ├── retrieval/      # Search, scraping, and data fetching
│   ├── processing/     # Data processing pipeline
│   ├── generation/     # Report generation (MD, HTML, PDF)
│   ├── server/         # REST API and SSE endpoints
│   ├── cli/           # Command-line interface
│   ├── utils/         # Utilities (cache, http, logger)
│   └── types/         # TypeScript interfaces
├── evaluation/        # Python evaluation module
│   ├── src/           # Evaluator source code
│   ├── docs/          # Evaluation documentation
│   └── outputs/       # Evaluation results
├── config/
│   ├── profiles/      # Report profiles
│   └── sources/       # Source reliability data
├── tests/             # Test suites
├── public/            # Static assets & web interface
└── reports/           # Generated reports
```

## License

MIT License - see LICENSE file for details

## Contributing

Contributions are welcome! Please read CONTRIBUTING.md for guidelines.

## Support

For issues and questions, please use the GitHub issue tracker.
