# Migration Guide: Gemini to OpenAI

## Overview

The Python evaluator (`evaluator.py`) has been migrated from Google Gemini to OpenAI API for better accessibility and easier setup for collaborators.

## Changes Made

### 1. Dependencies
- **Removed**: `google-generativeai` package
- **No new packages needed**: Using `requests` library (already included) for OpenAI API calls

### 2. Environment Variables
- **Old**: `GEMINI_API_KEY`
- **New**: `OPENAI_API_KEY` and optional `OPENAI_MODEL`

### 3. Configuration

Update your `.env` file:
```env
# Remove or comment out:
# GEMINI_API_KEY=your_gemini_key

# Add:
OPENAI_API_KEY=your_openai_api_key
# Optional: Choose model (defaults to gpt-3.5-turbo)
# OPENAI_MODEL=gpt-4
# OPENAI_MODEL=gpt-4-turbo-preview
# OPENAI_MODEL=gpt-3.5-turbo-16k
```

### 4. Getting an OpenAI API Key

1. Go to [OpenAI Platform](https://platform.openai.com/api-keys)
2. Sign up or log in
3. Navigate to API Keys section
4. Create a new secret key
5. Copy the key to your `.env` file

### 5. Model Options

- **gpt-3.5-turbo** (default): Fast, cost-effective, good for most use cases
- **gpt-4**: More capable, better reasoning, higher cost
- **gpt-4-turbo-preview**: Latest GPT-4 with 128k context window
- **gpt-3.5-turbo-16k**: Extended context version of GPT-3.5

### 6. Cost Comparison

| Model | Input (per 1K tokens) | Output (per 1K tokens) |
|-------|----------------------|------------------------|
| gpt-3.5-turbo | $0.0005 | $0.0015 |
| gpt-4-turbo | $0.01 | $0.03 |
| gpt-4 | $0.03 | $0.06 |

**Note**: Gemini had a free tier; OpenAI requires payment after free trial credits are exhausted.

## Installation Steps

### For New Setup

```bash
# 1. Clone the repository
git clone https://github.com/yourusername/research-report-generator.git
cd research-report-generator

# 2. Install Node.js dependencies
npm install

# 3. Install Python dependencies
cd evaluation
pip install -r requirements.txt
cd ..

# 4. Configure environment
cp .env.example .env
# Edit .env and add your OPENAI_API_KEY

# 5. Build and run
npm run build
npm run serve
```

### For Existing Setup (Upgrading)

```bash
# 1. Pull latest changes
git pull origin main

# 2. Update dependencies
npm install
cd evaluation
pip install -r requirements.txt
cd ..

# 3. Update environment variables
# Edit .env file:
# - Remove GEMINI_API_KEY
# - Add OPENAI_API_KEY

# 4. Rebuild
npm run build
```

## Usage Remains the Same

The command-line interface and API endpoints work exactly as before:

```bash
# CLI evaluation (from project root)
python evaluation/src/evaluator.py --query "Your query" --draft report.md --out evaluation/outputs/results

# API evaluation
curl -X POST http://localhost:3000/api/evaluate \
  -H "Content-Type: application/json" \
  -d '{"query": "Your query", "reportId": "report-id"}'
```

## Fallback Behavior

If no OpenAI API key is configured:
- The evaluator falls back to basic pattern matching
- Less accurate but still functional
- No AI-powered claim extraction or fact-checking
- Basic scoring based on text analysis

## Troubleshooting

### API Key Issues
```
OpenAI criteria extraction failed: 401 Unauthorized
```
**Solution**: Verify your API key is correct and has credits available.

### Rate Limiting
```
OpenAI fact-check failed: 429 Too Many Requests
```
**Solution**: Reduce request frequency or upgrade your OpenAI plan.

### Model Not Found
```
OpenAI auto-fix failed: model 'gpt-5' does not exist
```
**Solution**: Use a valid model name in your `.env` file.

## Benefits of Migration

1. **Easier Access**: OpenAI keys are simpler to obtain
2. **Better Documentation**: OpenAI has extensive API docs
3. **No SDK Required**: Direct HTTP calls reduce dependencies
4. **Model Flexibility**: Choose between GPT-3.5 and GPT-4
5. **Wide Language Support**: OpenAI supports more programming languages for future extensions

## Questions?

If you encounter any issues with the migration:
1. Check this guide first
2. Review the [EVALUATOR_GUIDE.md](EVALUATOR_GUIDE.md)
3. Open an issue on GitHub with details about your setup

## Future Improvements

Potential enhancements being considered:
- Support for local LLMs (Ollama, LlamaCPP)
- Azure OpenAI Service integration
- Anthropic Claude as an alternative
- Streaming responses for real-time feedback
