# Evaluation Module

AI-powered evaluation system for research reports using OpenAI GPT models.

## 📁 Structure

```
evaluation/
├── README.md           # This file
├── requirements.txt    # Python dependencies
├── __init__.py        # Module initialization
├── src/               # Source code
│   ├── __init__.py
│   ├── evaluator.py   # Main evaluation logic
│   └── test_openai.py # OpenAI connection test
├── docs/              # Documentation
│   └── EVALUATOR_GUIDE.md
└── outputs/           # Evaluation results
    └── (various evaluation outputs)
```

## 🚀 Quick Start

### Installation

```bash
# From the project root
cd evaluation
pip install -r requirements.txt
```

### Configuration

Add to your `.env` file:
```env
OPENAI_API_KEY=your_openai_api_key
OPENAI_MODEL=gpt-3.5-turbo  # Optional, defaults to gpt-3.5-turbo
```

### Usage

#### Command Line
```bash
# From project root
python evaluation/src/evaluator.py --query "your query" --draft report.md --out results

# Or from evaluation directory
cd evaluation
python src/evaluator.py --query "your query" --draft ../reports/report.md --out outputs/results
```

#### As a Module
```python
from evaluation import ReportEvaluator

evaluator = ReportEvaluator()
result = evaluator.evaluate_report(query, draft_content)
print(f"Score: {result.score.overall}/5.0")
```

#### Via API
```bash
curl -X POST http://localhost:3000/api/evaluate \
  -H "Content-Type: application/json" \
  -d '{"query": "Your query", "reportId": "report-id"}'
```

## 📊 Features

- **Fact Checking**: Verify claims against web sources
- **Quality Scoring**: Rate reports on accuracy, coverage, citations, and clarity
- **Auto-Fix**: Automatically improve low-scoring reports
- **Multiple Outputs**: JSON, Markdown, and HTML formats

## 📖 Documentation

See [docs/EVALUATOR_GUIDE.md](docs/EVALUATOR_GUIDE.md) for detailed documentation.

## 🧪 Testing

Test OpenAI connection:
```bash
python evaluation/src/test_openai.py
```

## 💡 Models

Supported OpenAI models:
- `gpt-3.5-turbo` (default, fast, cost-effective)
- `gpt-4` (more capable, higher cost)
- `gpt-4-turbo-preview` (latest GPT-4)
- `gpt-3.5-turbo-16k` (extended context)

## 📝 Output Structure

Evaluation results are saved in `outputs/` with three formats:
- `report.json` - Structured data for programmatic use
- `report.md` - Markdown report for reading
- `report.html` - Interactive HTML with toggleable sections

## ⚠️ Important Notes

- Requires OpenAI API key (paid service after free credits)
- Falls back to basic pattern matching without API key
- Typical cost: ~$0.002 per evaluation with GPT-3.5-turbo
