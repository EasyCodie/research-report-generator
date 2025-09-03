# 🔍 AI Research Evaluator Integration Guide

## Overview

The evaluator system fact-checks and scores AI-generated research reports using:
- **OpenAI GPT** for intelligent analysis
- **Web search** for fact verification
- **Scoring rubric** for quality assessment
- **Auto-fix** for low-scoring reports

## Setup

### 1. Install Python Dependencies

```bash
pip install -r requirements.txt
```

### 2. Configure API Keys

Add to your `.env` file:

```env
# Required for AI-powered evaluation
OPENAI_API_KEY=your_openai_api_key_here
# Optional: Specify model (defaults to gpt-3.5-turbo)
# OPENAI_MODEL=gpt-4

# Optional search providers (at least one recommended)
TAVILY_API_KEY=your_tavily_key  # Recommended for best results
SERPAPI_KEY=your_serpapi_key
# BING and GOOGLE keys already configured if you set them up
```

### Get API Keys:
- **OpenAI**: https://platform.openai.com/api-keys
- **Tavily**: https://tavily.com/ (free tier available)
- **SerpAPI**: https://serpapi.com/ (free tier available)

## Usage Methods

### Method 1: Standalone Python CLI

```bash
# Evaluate an existing report
python evaluator.py --query "What are the best practices for React?" --draft reports/YOUR_REPORT/v1/report.md --out evaluation_results

# Evaluate any markdown file
python evaluator.py --query "Your original question" --draft path/to/draft.md --out output_dir
```

### Method 2: Via API Endpoint

```bash
# Evaluate by report ID
curl -X POST http://localhost:3000/api/evaluate \
  -H "Content-Type: application/json" \
  -d '{
    "query": "Original research question",
    "reportId": "report-uuid-here"
  }'

# Evaluate custom draft
curl -X POST http://localhost:3000/api/evaluate \
  -H "Content-Type: application/json" \
  -d '{
    "query": "What is the question?",
    "draft": "# Report Content\n\nYour markdown content here..."
  }'
```

### Method 3: PowerShell Integration

```powershell
# Generate a report and evaluate it
$reportResponse = Invoke-RestMethod -Uri "http://localhost:3000/api/reports" -Method POST -Body (@{
    query = "Compare React vs Vue vs Angular"
    profile = "technical"
    formats = @("md", "html")
    maxSources = 15
} | ConvertTo-Json) -ContentType "application/json"

# Wait for completion...
Start-Sleep -Seconds 10

# Evaluate the report
$evalResponse = Invoke-RestMethod -Uri "http://localhost:3000/api/evaluate" -Method POST -Body (@{
    query = "Compare React vs Vue vs Angular"
    reportId = $reportResponse.jobId
} | ConvertTo-Json) -ContentType "application/json"

# Check the score
$evalResponse.evaluation.score.overall
```

## Understanding the Output

### Scoring Rubric (0-5 scale)

- **Accuracy (45% weight)**: Are claims supported by credible sources?
- **Coverage (30% weight)**: Does it answer all aspects of the query?
- **Citations Quality (15% weight)**: Are sources reputable and diverse?
- **Clarity & Structure (10% weight)**: Is it well-organized and readable?

### Score Interpretation

- **4.0-5.0**: Excellent quality, ready for use
- **3.5-3.9**: Good quality, minor improvements possible
- **3.0-3.4**: Acceptable, some issues identified
- **Below 3.0**: Poor quality, needs significant revision

### Output Files

The evaluator generates three formats:

1. **report.md** - Markdown evaluation report
2. **report.html** - Interactive HTML report with toggles
3. **report.json** - Structured data for programmatic use

## Evaluation Process

1. **Criteria Extraction**: Analyzes the user's query to understand requirements
2. **Claim Extraction**: Identifies verifiable statements in the draft
3. **Fact-Checking**: Searches web for evidence supporting/contradicting claims
4. **Scoring**: Calculates scores based on rubric
5. **Auto-Fix** (if score < 3.5): Rewrites draft to correct errors

## Example Evaluation Report

```markdown
# Evaluation Report

## Query
Compare the top JavaScript frameworks in 2024

## Evaluation Score
- Overall Score: 4.12/5.00
- Accuracy: 4.50/5.00 (45% weight)
- Coverage: 4.00/5.00 (30% weight)
- Citations Quality: 3.50/5.00 (15% weight)
- Clarity & Structure: 3.80/5.00 (10% weight)

## Fact-Check Results
Total claims checked: 10

### Summary
- ✅ Supported: 8
- ❌ Contradicted: 0
- ❓ Insufficient: 2
```

## Integration with CI/CD

```yaml
# GitHub Actions example
- name: Generate Report
  run: npm run cli generate "${{ github.event.inputs.query }}" --formats md

- name: Evaluate Report
  run: |
    python evaluator.py \
      --query "${{ github.event.inputs.query }}" \
      --draft reports/latest/report.md \
      --out evaluation
    
- name: Check Quality Gate
  run: |
    score=$(python -c "import json; print(json.load(open('evaluation/report.json'))['score']['overall'])")
    if (( $(echo "$score < 3.5" | bc -l) )); then
      echo "Quality gate failed: Score $score is below 3.5"
      exit 1
    fi
```

## Advanced Features

### Custom Scoring Weights

Modify the weights in `evaluator.py`:

```python
self.overall = (
    0.45 * self.accuracy +      # Adjust these weights
    0.30 * self.coverage +       # Based on your priorities
    0.15 * self.citations_quality +
    0.10 * self.clarity_structure
)
```

### Reflection Loop

For agentic systems, implement a reflection loop:

```python
while score < 3.5 and attempts < 3:
    # Re-generate with feedback
    feedback = evaluation['criteria'] + evaluation['fact_checks']
    new_draft = regenerate_with_feedback(feedback)
    evaluation = evaluate(new_draft)
    score = evaluation['score']['overall']
    attempts += 1
```

## Troubleshooting

### No OpenAI API Key
- The system falls back to basic pattern matching
- Less accurate but still functional

### No Search Providers
- Uses mock data for testing
- Configure at least one provider for real fact-checking

### Python Not Found
- Ensure Python 3.8+ is installed
- Add Python to PATH
- Or use full path: `C:\Python39\python.exe evaluator.py`

## Best Practices

1. **Always provide the original query** - Critical for accurate evaluation
2. **Use multiple search providers** - Improves fact-checking coverage
3. **Set quality gates** - Reject reports scoring below 3.5
4. **Review fact-check failures** - Understand why claims were disputed
5. **Iterate on low scores** - Use the auto-fixed version as a starting point

## Support

- Check `evaluation_output/report.html` for detailed results
- Review `evaluation_output/report.json` for programmatic access
- Logs show progress through each evaluation step
