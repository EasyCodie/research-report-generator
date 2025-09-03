#!/usr/bin/env python3
"""
Agentic AI Research Assistant Evaluator
Fact-checks and scores AI-generated research reports using Gemini and web search.
"""

import os
import sys
import json
import argparse
import asyncio
import re
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Any, Optional, Tuple
from dataclasses import dataclass, asdict
from enum import Enum

import requests
from dotenv import load_dotenv
from bs4 import BeautifulSoup
import markdown

# Load environment variables
load_dotenv()

# Configure OpenAI
OPENAI_API_KEY = os.getenv('OPENAI_API_KEY')
OPENAI_MODEL = os.getenv('OPENAI_MODEL', 'gpt-3.5-turbo')  # Default to GPT-3.5

class SearchProvider(Enum):
    """Supported search providers"""
    TAVILY = "tavily"
    SERPAPI = "serpapi"
    BING = "bing"
    GOOGLE = "google"  # Using existing Google implementation

@dataclass
class Criteria:
    """Evaluation criteria extracted from user query"""
    goals: List[str]
    constraints: List[str]
    must_include: List[str]
    nice_to_have: List[str]
    disallowed: List[str]

@dataclass
class Claim:
    """Individual verifiable claim"""
    claim_text: str
    evidence_needed: str
    priority: str
    
@dataclass
class FactCheckResult:
    """Result of fact-checking a claim"""
    claim: str
    verdict: str  # supported|contradicted|insufficient
    confidence: float
    rationale: str
    sources: List[Dict[str, str]]

@dataclass
class EvaluationScore:
    """Overall evaluation scores"""
    accuracy: float
    coverage: float
    citations_quality: float
    clarity_structure: float
    overall: float
    
    def calculate_overall(self):
        """Calculate weighted overall score"""
        self.overall = (
            0.45 * self.accuracy +
            0.30 * self.coverage +
            0.15 * self.citations_quality +
            0.10 * self.clarity_structure
        )
        return self.overall

class SearchManager:
    """Manages web searches across different providers"""
    
    def __init__(self):
        self.providers = self._detect_available_providers()
        
    def _detect_available_providers(self) -> List[SearchProvider]:
        """Detect which search providers are configured"""
        providers = []
        if os.getenv('TAVILY_API_KEY'):
            providers.append(SearchProvider.TAVILY)
        if os.getenv('SERPAPI_KEY'):
            providers.append(SearchProvider.SERPAPI)
        if os.getenv('BING_API_KEY'):
            providers.append(SearchProvider.BING)
        if os.getenv('GOOGLE_API_KEY') and os.getenv('GOOGLE_CSE_ID'):
            providers.append(SearchProvider.GOOGLE)
        return providers
    
    def search(self, query: str, num_results: int = 4) -> List[Dict[str, str]]:
        """Search using the first available provider"""
        if not self.providers:
            print("Warning: No search providers configured. Using mock data.")
            return self._mock_search(query)
        
        provider = self.providers[0]
        
        if provider == SearchProvider.GOOGLE:
            return self._search_google(query, num_results)
        elif provider == SearchProvider.TAVILY:
            return self._search_tavily(query, num_results)
        elif provider == SearchProvider.SERPAPI:
            return self._search_serpapi(query, num_results)
        elif provider == SearchProvider.BING:
            return self._search_bing(query, num_results)
        
        return []
    
    def _search_google(self, query: str, num_results: int) -> List[Dict[str, str]]:
        """Search using Google Custom Search API"""
        api_key = os.getenv('GOOGLE_API_KEY')
        cse_id = os.getenv('GOOGLE_CSE_ID')
        
        url = "https://www.googleapis.com/customsearch/v1"
        params = {
            'key': api_key,
            'cx': cse_id,
            'q': query,
            'num': min(num_results, 10)
        }
        
        try:
            response = requests.get(url, params=params)
            response.raise_for_status()
            data = response.json()
            
            results = []
            for item in data.get('items', []):
                results.append({
                    'title': item.get('title', ''),
                    'url': item.get('link', ''),
                    'snippet': item.get('snippet', '')
                })
            return results
        except Exception as e:
            print(f"Google search error: {e}")
            return []
    
    def _search_tavily(self, query: str, num_results: int) -> List[Dict[str, str]]:
        """Search using Tavily API"""
        api_key = os.getenv('TAVILY_API_KEY')
        url = "https://api.tavily.com/search"
        
        payload = {
            "api_key": api_key,
            "query": query,
            "max_results": num_results
        }
        
        try:
            response = requests.post(url, json=payload)
            response.raise_for_status()
            data = response.json()
            
            results = []
            for result in data.get('results', []):
                results.append({
                    'title': result.get('title', ''),
                    'url': result.get('url', ''),
                    'snippet': result.get('content', '')[:200]
                })
            return results
        except Exception as e:
            print(f"Tavily search error: {e}")
            return []
    
    def _search_serpapi(self, query: str, num_results: int) -> List[Dict[str, str]]:
        """Search using SerpAPI"""
        api_key = os.getenv('SERPAPI_KEY')
        url = "https://serpapi.com/search"
        
        params = {
            "api_key": api_key,
            "q": query,
            "num": num_results,
            "engine": "google"
        }
        
        try:
            response = requests.get(url, params=params)
            response.raise_for_status()
            data = response.json()
            
            results = []
            for result in data.get('organic_results', []):
                results.append({
                    'title': result.get('title', ''),
                    'url': result.get('link', ''),
                    'snippet': result.get('snippet', '')
                })
            return results
        except Exception as e:
            print(f"SerpAPI search error: {e}")
            return []
    
    def _search_bing(self, query: str, num_results: int) -> List[Dict[str, str]]:
        """Search using Bing Web Search API"""
        api_key = os.getenv('BING_API_KEY')
        url = "https://api.bing.microsoft.com/v7.0/search"
        
        headers = {"Ocp-Apim-Subscription-Key": api_key}
        params = {"q": query, "count": num_results}
        
        try:
            response = requests.get(url, headers=headers, params=params)
            response.raise_for_status()
            data = response.json()
            
            results = []
            for result in data.get('webPages', {}).get('value', []):
                results.append({
                    'title': result.get('name', ''),
                    'url': result.get('url', ''),
                    'snippet': result.get('snippet', '')
                })
            return results
        except Exception as e:
            print(f"Bing search error: {e}")
            return []
    
    def _mock_search(self, query: str) -> List[Dict[str, str]]:
        """Return mock search results for testing"""
        return [
            {
                'title': 'Example Result 1',
                'url': 'https://example.com/1',
                'snippet': f'This is a relevant result about {query}'
            },
            {
                'title': 'Example Result 2', 
                'url': 'https://example.com/2',
                'snippet': f'Another source discussing {query}'
            }
        ]

class ReportEvaluator:
    """Main evaluator class for AI-generated research reports"""
    
    def __init__(self):
        self.search_manager = SearchManager()
        self.api_key = OPENAI_API_KEY
        self.model = OPENAI_MODEL
        self.api_url = "https://api.openai.com/v1/chat/completions"
    
    def extract_criteria(self, user_query: str) -> Criteria:
        """Extract evaluation criteria from user query using OpenAI"""
        if not self.api_key:
            # Fallback to basic extraction
            return self._extract_criteria_basic(user_query)
        
        prompt = f"""
        Extract evaluation criteria from the user's question. Return strict JSON with:
        - goals: list of main objectives the answer should achieve
        - constraints: list of limitations or requirements
        - must_include: list of topics/points that must be covered
        - nice_to_have: list of optional but valuable additions
        - disallowed: list of things to avoid
        
        User question: {user_query}
        
        Return only valid JSON.
        """
        
        try:
            headers = {
                "Authorization": f"Bearer {self.api_key}",
                "Content-Type": "application/json"
            }
            data = {
                "model": self.model,
                "messages": [
                    {"role": "system", "content": "You are a helpful assistant that extracts evaluation criteria from queries. Always respond with valid JSON only."},
                    {"role": "user", "content": prompt}
                ],
                "temperature": 0.3
            }
            response = requests.post(self.api_url, headers=headers, json=data)
            response.raise_for_status()
            text = response.json()['choices'][0]['message']['content'].strip()
            # Clean the response text to extract JSON
            if '```json' in text:
                text = text.split('```json')[1].split('```')[0].strip()
            elif '```' in text:
                text = text.split('```')[1].split('```')[0].strip()
            criteria_dict = json.loads(text)
            return Criteria(**criteria_dict)
        except Exception as e:
            print(f"OpenAI criteria extraction failed: {e}")
            return self._extract_criteria_basic(user_query)
    
    def _extract_criteria_basic(self, user_query: str) -> Criteria:
        """Basic criteria extraction without AI"""
        query_lower = user_query.lower()
        
        goals = []
        if 'compare' in query_lower:
            goals.append("Provide comprehensive comparison")
        if 'best' in query_lower:
            goals.append("Identify best options with justification")
        if 'how' in query_lower:
            goals.append("Provide actionable instructions")
        
        must_include = re.findall(r'\b(?:include|cover|explain|describe)\s+(\w+)', query_lower)
        
        return Criteria(
            goals=goals or ["Answer the user's question comprehensively"],
            constraints=["Be factual and accurate", "Use credible sources"],
            must_include=must_include,
            nice_to_have=["Recent information (2023-2024)", "Multiple perspectives"],
            disallowed=["Speculation without evidence", "Outdated information"]
        )
    
    def extract_claims(self, draft: str) -> List[Claim]:
        """Extract verifiable claims from the assistant's draft"""
        if not self.api_key:
            return self._extract_claims_basic(draft)
        
        prompt = f"""
        Extract verifiable claims (short, atomic statements) from this draft.
        For each claim provide:
        - claim_text: the specific claim being made
        - evidence_needed: what type of evidence would verify this
        - priority: high|medium|low based on importance
        
        Draft:
        {draft[:3000]}  # Limit for API
        
        Return JSON array of claims.
        """
        
        try:
            headers = {
                "Authorization": f"Bearer {self.api_key}",
                "Content-Type": "application/json"
            }
            data = {
                "model": self.model,
                "messages": [
                    {"role": "system", "content": "You are a helpful assistant that extracts verifiable claims from text. Always respond with a valid JSON array only."},
                    {"role": "user", "content": prompt}
                ],
                "temperature": 0.3
            }
            response = requests.post(self.api_url, headers=headers, json=data)
            response.raise_for_status()
            text = response.json()['choices'][0]['message']['content'].strip()
            # Clean the response text to extract JSON
            if '```json' in text:
                text = text.split('```json')[1].split('```')[0].strip()
            elif '```' in text:
                text = text.split('```')[1].split('```')[0].strip()
            claims_data = json.loads(text)
            return [Claim(**claim) for claim in claims_data]
        except Exception as e:
            print(f"OpenAI claim extraction failed: {e}")
            return self._extract_claims_basic(draft)
    
    def _extract_claims_basic(self, draft: str) -> List[Claim]:
        """Basic claim extraction using regex patterns"""
        claims = []
        
        # Look for statements with specific patterns
        patterns = [
            r'(?:is|are|was|were|has|have|can|will)\s+([^.!?]+)[.!?]',
            r'(?:provides?|offers?|includes?|supports?)\s+([^.!?]+)[.!?]',
            r'(?:\d+%|\d+\s+(?:times|percent|million|billion))[^.!?]+[.!?]'
        ]
        
        sentences = draft.split('.')
        for sentence in sentences[:20]:  # Limit to first 20 sentences
            sentence = sentence.strip()
            if len(sentence) > 20:
                claims.append(Claim(
                    claim_text=sentence,
                    evidence_needed="Web search verification",
                    priority="medium"
                ))
        
        return claims[:10]  # Limit total claims
    
    def fact_check_claim(self, claim: Claim) -> FactCheckResult:
        """Fact-check a single claim using web search"""
        # Search for evidence
        search_results = self.search_manager.search(claim.claim_text, num_results=3)
        
        if not self.api_key:
            # Basic fact-checking without AI
            return self._fact_check_basic(claim, search_results)
        
        # Prepare sources for Gemini
        sources_text = "\n".join([
            f"Source {i+1}: {r['title']}\nURL: {r['url']}\nSnippet: {r['snippet']}"
            for i, r in enumerate(search_results)
        ])
        
        prompt = f"""
        Given this claim and these sources, determine if the claim is:
        - supported: sources clearly support the claim
        - contradicted: sources contradict the claim  
        - insufficient: not enough evidence to determine
        
        Claim: {claim.claim_text}
        
        Sources:
        {sources_text}
        
        Return JSON with:
        - verdict: supported|contradicted|insufficient
        - confidence: 0.0 to 1.0
        - rationale: brief explanation
        """
        
        try:
            headers = {
                "Authorization": f"Bearer {self.api_key}",
                "Content-Type": "application/json"
            }
            data = {
                "model": self.model,
                "messages": [
                    {"role": "system", "content": "You are a fact-checking assistant. Analyze claims and determine if they are supported, contradicted, or have insufficient evidence. Always respond with valid JSON only."},
                    {"role": "user", "content": prompt}
                ],
                "temperature": 0.3
            }
            response = requests.post(self.api_url, headers=headers, json=data)
            response.raise_for_status()
            text = response.json()['choices'][0]['message']['content'].strip()
            # Clean the response text to extract JSON
            if '```json' in text:
                text = text.split('```json')[1].split('```')[0].strip()
            elif '```' in text:
                text = text.split('```')[1].split('```')[0].strip()
            result = json.loads(text)
            
            return FactCheckResult(
                claim=claim.claim_text,
                verdict=result.get('verdict', 'insufficient'),
                confidence=float(result.get('confidence', 0.5)),
                rationale=result.get('rationale', 'Unable to determine'),
                sources=search_results
            )
        except Exception as e:
            print(f"OpenAI fact-check failed: {e}")
            return self._fact_check_basic(claim, search_results)
    
    def _fact_check_basic(self, claim: Claim, sources: List[Dict]) -> FactCheckResult:
        """Basic fact-checking without AI"""
        # Simple keyword matching
        claim_words = set(claim.claim_text.lower().split())
        
        match_count = 0
        for source in sources:
            snippet_words = set(source['snippet'].lower().split())
            overlap = len(claim_words & snippet_words) / len(claim_words)
            if overlap > 0.3:
                match_count += 1
        
        if match_count >= 2:
            verdict = "supported"
            confidence = 0.7
            rationale = f"Found {match_count} sources with matching content"
        elif match_count == 1:
            verdict = "insufficient"
            confidence = 0.5
            rationale = "Limited evidence found"
        else:
            verdict = "insufficient"
            confidence = 0.3
            rationale = "No clear supporting evidence found"
        
        return FactCheckResult(
            claim=claim.claim_text,
            verdict=verdict,
            confidence=confidence,
            rationale=rationale,
            sources=sources
        )
    
    def score_report(self, draft: str, criteria: Criteria, 
                    fact_checks: List[FactCheckResult]) -> EvaluationScore:
        """Calculate overall scores for the report"""
        
        # Accuracy score based on fact-checking
        supported = sum(1 for fc in fact_checks if fc.verdict == "supported")
        total_claims = len(fact_checks) if fact_checks else 1
        accuracy = (supported / total_claims) * 5.0
        
        # Coverage score based on criteria
        coverage_items = len(criteria.must_include) if criteria.must_include else 1
        covered = sum(1 for item in criteria.must_include 
                     if item.lower() in draft.lower())
        coverage = (covered / coverage_items) * 5.0
        
        # Citations quality
        unique_sources = set()
        for fc in fact_checks:
            for source in fc.sources:
                unique_sources.add(source['url'])
        
        citations_quality = min(len(unique_sources) / 2, 5.0)  # More sources = better
        
        # Clarity and structure
        clarity_score = 3.0  # Default
        if len(draft) > 500 and len(draft) < 5000:
            clarity_score += 1.0
        if draft.count('#') > 3:  # Has sections
            clarity_score += 1.0
        
        score = EvaluationScore(
            accuracy=accuracy,
            coverage=coverage,
            citations_quality=citations_quality,
            clarity_structure=min(clarity_score, 5.0),
            overall=0.0
        )
        score.calculate_overall()
        
        return score
    
    def auto_fix_draft(self, draft: str, criteria: Criteria, 
                      fact_checks: List[FactCheckResult]) -> str:
        """Auto-fix the draft based on fact-checking results"""
        
        if not self.api_key:
            return self._auto_fix_basic(draft, fact_checks)
        
        # Prepare fact-check summary
        issues = [fc for fc in fact_checks if fc.verdict != "supported"]
        
        prompt = f"""
        Rewrite this draft to:
        1. Correct any factual errors based on fact-checking
        2. Ensure all criteria are met
        3. Include inline citations [1], [2] etc.
        4. Keep it concise and well-structured
        5. Use clear Markdown formatting
        
        Original draft (first 2000 chars):
        {draft[:2000]}
        
        Issues found:
        {json.dumps([{'claim': i.claim, 'verdict': i.verdict} for i in issues], indent=2)}
        
        Criteria to meet:
        {json.dumps(asdict(criteria), indent=2)}
        
        Return the corrected Markdown text.
        """
        
        try:
            headers = {
                "Authorization": f"Bearer {self.api_key}",
                "Content-Type": "application/json"
            }
            data = {
                "model": self.model,
                "messages": [
                    {"role": "system", "content": "You are a helpful assistant that rewrites drafts to correct errors and improve quality. Output clean Markdown text."},
                    {"role": "user", "content": prompt}
                ],
                "temperature": 0.5
            }
            response = requests.post(self.api_url, headers=headers, json=data)
            response.raise_for_status()
            return response.json()['choices'][0]['message']['content']
        except Exception as e:
            print(f"OpenAI auto-fix failed: {e}")
            return self._auto_fix_basic(draft, fact_checks)
    
    def _auto_fix_basic(self, draft: str, fact_checks: List[FactCheckResult]) -> str:
        """Basic auto-fix without AI"""
        fixed = draft
        
        # Add fact-check warnings for disputed claims
        for fc in fact_checks:
            if fc.verdict == "contradicted":
                warning = f"\n**Note**: The claim '{fc.claim[:50]}...' may need verification.\n"
                fixed += warning
        
        # Add sources section if not present
        if "## Sources" not in fixed and "## References" not in fixed:
            fixed += "\n\n## Sources\n"
            for i, fc in enumerate(fact_checks[:5], 1):
                if fc.sources:
                    fixed += f"[{i}] {fc.sources[0]['url']}\n"
        
        return fixed
    
    def generate_report(self, user_query: str, draft: str, 
                       output_dir: Path) -> Dict[str, Any]:
        """Main evaluation pipeline"""
        
        print("[INFO] Starting evaluation pipeline...")
        
        # Step 1: Extract criteria
        print("[1/6] Extracting evaluation criteria...")
        criteria = self.extract_criteria(user_query)
        
        # Step 2: Extract claims
        print("[2/6] Extracting claims from draft...")
        claims = self.extract_claims(draft)
        print(f"      Found {len(claims)} claims to verify")
        
        # Step 3: Fact-check claims
        print("[3/6] Fact-checking claims...")
        fact_checks = []
        for i, claim in enumerate(claims[:10], 1):  # Limit to 10 for performance
            print(f"      Checking claim {i}/{min(len(claims), 10)}...")
            fact_check = self.fact_check_claim(claim)
            fact_checks.append(fact_check)
        
        # Step 4: Score the report
        print("[4/6] Calculating scores...")
        score = self.score_report(draft, criteria, fact_checks)
        
        # Step 5: Auto-fix if needed
        fixed_draft = draft
        if score.overall < 3.5:
            print("[5/6] Auto-fixing draft (score below 3.5)...")
            fixed_draft = self.auto_fix_draft(draft, criteria, fact_checks)
        
        # Generate outputs
        print("[6/6] Generating reports...")
        self._save_markdown_report(
            user_query, draft, fixed_draft, criteria, 
            fact_checks, score, output_dir
        )
        self._save_html_report(
            user_query, draft, fixed_draft, criteria,
            fact_checks, score, output_dir
        )
        self._save_json_report(
            user_query, draft, fixed_draft, criteria,
            fact_checks, score, output_dir
        )
        
        return {
            "score": asdict(score),
            "criteria": asdict(criteria),
            "fact_checks": [asdict(fc) for fc in fact_checks],
            "fixed_draft": fixed_draft,
            "output_files": {
                "markdown": str(output_dir / "report.md"),
                "html": str(output_dir / "report.html"),
                "json": str(output_dir / "report.json")
            }
        }
    
    def _save_markdown_report(self, query, original, fixed, criteria, 
                             fact_checks, score, output_dir):
        """Save Markdown report"""
        
        report = f"""# Evaluation Report

## Query
{query}

## Evaluation Score
- **Overall Score**: {score.overall:.2f}/5.00
- **Accuracy**: {score.accuracy:.2f}/5.00 (45% weight)
- **Coverage**: {score.coverage:.2f}/5.00 (30% weight)  
- **Citations Quality**: {score.citations_quality:.2f}/5.00 (15% weight)
- **Clarity & Structure**: {score.clarity_structure:.2f}/5.00 (10% weight)

## Criteria Extracted
### Goals
{chr(10).join('- ' + g for g in criteria.goals)}

### Must Include
{chr(10).join('- ' + m for m in criteria.must_include)}

## Fact-Check Results
Total claims checked: {len(fact_checks)}

### Summary
- [SUPPORTED]: {sum(1 for fc in fact_checks if fc.verdict == 'supported')}
- [CONTRADICTED]: {sum(1 for fc in fact_checks if fc.verdict == 'contradicted')}
- [INSUFFICIENT]: {sum(1 for fc in fact_checks if fc.verdict == 'insufficient')}

### Details
"""
        
        for i, fc in enumerate(fact_checks[:5], 1):
            report += f"""
#### Claim {i}
**Statement**: {fc.claim[:100]}...
**Verdict**: {fc.verdict} (confidence: {fc.confidence:.2f})
**Rationale**: {fc.rationale}
"""
        
        if score.overall < 3.5:
            report += f"""
## Auto-Fixed Version
The original draft scored below 3.5 and has been automatically corrected:

{fixed}
"""
        
        report += f"""
## Sources Used for Verification
"""
        
        all_sources = set()
        for fc in fact_checks:
            for source in fc.sources:
                all_sources.add(f"- [{source['title']}]({source['url']})")
        
        report += "\n".join(all_sources)
        
        output_dir.mkdir(parents=True, exist_ok=True)
        (output_dir / "report.md").write_text(report, encoding='utf-8')
    
    def _save_html_report(self, query, original, fixed, criteria,
                         fact_checks, score, output_dir):
        """Save HTML report"""
        
        # Convert markdown to HTML
        md_converter = markdown.Markdown(extensions=['extra', 'codehilite'])
        
        html = f"""<!DOCTYPE html>
<html>
<head>
    <title>Evaluation Report</title>
    <style>
        body {{ 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            max-width: 900px; 
            margin: 0 auto; 
            padding: 20px;
            background: #f5f5f5;
        }}
        .container {{
            background: white;
            padding: 30px;
            border-radius: 10px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }}
        h1, h2, h3 {{ color: #333; }}
        .score-badge {{
            display: inline-block;
            padding: 5px 15px;
            border-radius: 20px;
            font-weight: bold;
            margin: 5px;
        }}
        .score-good {{ background: #4caf50; color: white; }}
        .score-medium {{ background: #ff9800; color: white; }}
        .score-poor {{ background: #f44336; color: white; }}
        .fact-check {{
            margin: 10px 0;
            padding: 15px;
            border-left: 4px solid #2196F3;
            background: #f0f8ff;
        }}
        .verdict-supported {{ border-color: #4caf50; background: #e8f5e9; }}
        .verdict-contradicted {{ border-color: #f44336; background: #ffebee; }}
        .verdict-insufficient {{ border-color: #ff9800; background: #fff3e0; }}
        pre {{ background: #f4f4f4; padding: 10px; overflow-x: auto; }}
        .toggle-section {{
            cursor: pointer;
            user-select: none;
            padding: 10px;
            background: #e0e0e0;
            margin: 10px 0;
        }}
        .toggle-content {{
            display: none;
            padding: 10px;
            border: 1px solid #ddd;
        }}
        .toggle-content.active {{
            display: block;
        }}
    </style>
</head>
<body>
    <div class="container">
        <h1>Evaluation Report</h1>
        
        <h2>Query</h2>
        <p>{query}</p>
        
        <h2>Evaluation Scores</h2>
        <p>
            <span class="score-badge {'score-good' if score.overall >= 4 else 'score-medium' if score.overall >= 3 else 'score-poor'}">
                Overall: {score.overall:.2f}/5.00
            </span>
        </p>
        <ul>
            <li>Accuracy: {score.accuracy:.2f}/5.00 (45% weight)</li>
            <li>Coverage: {score.coverage:.2f}/5.00 (30% weight)</li>
            <li>Citations Quality: {score.citations_quality:.2f}/5.00 (15% weight)</li>
            <li>Clarity & Structure: {score.clarity_structure:.2f}/5.00 (10% weight)</li>
        </ul>
        
        <h2>Fact-Check Results</h2>
        <p>Checked {len(fact_checks)} claims:</p>
"""
        
        for i, fc in enumerate(fact_checks[:5], 1):
            verdict_class = f"verdict-{fc.verdict}"
            html += f"""
        <div class="fact-check {verdict_class}">
            <strong>Claim {i}:</strong> {fc.claim[:100]}...<br>
            <strong>Verdict:</strong> {fc.verdict} (confidence: {fc.confidence:.2f})<br>
            <strong>Rationale:</strong> {fc.rationale}
        </div>
"""
        
        if score.overall < 3.5:
            html += f"""
        <div class="toggle-section" onclick="toggleSection('fixed')">
            ▶ Show Auto-Fixed Version
        </div>
        <div id="fixed" class="toggle-content">
            {md_converter.convert(fixed)}
        </div>
"""
        
        html += """
    </div>
    <script>
        function toggleSection(id) {
            const content = document.getElementById(id);
            content.classList.toggle('active');
            const toggle = content.previousElementSibling;
            toggle.textContent = content.classList.contains('active') ? 
                '▼ Hide Auto-Fixed Version' : '▶ Show Auto-Fixed Version';
        }
    </script>
</body>
</html>
"""
        
        output_dir.mkdir(parents=True, exist_ok=True)
        (output_dir / "report.html").write_text(html, encoding='utf-8')
    
    def _save_json_report(self, query, original, fixed, criteria,
                         fact_checks, score, output_dir):
        """Save JSON report for programmatic access"""
        
        report = {
            "timestamp": datetime.now().isoformat(),
            "query": query,
            "score": asdict(score),
            "criteria": asdict(criteria),
            "fact_checks": [
                {
                    "claim": fc.claim,
                    "verdict": fc.verdict,
                    "confidence": fc.confidence,
                    "rationale": fc.rationale,
                    "sources": fc.sources
                }
                for fc in fact_checks
            ],
            "original_draft_length": len(original),
            "fixed_draft_length": len(fixed) if fixed != original else None,
            "auto_fixed": score.overall < 3.5
        }
        
        output_dir.mkdir(parents=True, exist_ok=True)
        (output_dir / "report.json").write_text(
            json.dumps(report, indent=2), 
            encoding='utf-8'
        )


def main():
    """CLI entry point"""
    parser = argparse.ArgumentParser(
        description="Evaluate AI-generated research reports"
    )
    parser.add_argument(
        "--query", 
        required=True,
        help="The original user question/query"
    )
    parser.add_argument(
        "--draft",
        required=True,
        help="Path to the draft file to evaluate"
    )
    parser.add_argument(
        "--out",
        default="evaluation_output",
        help="Output directory for reports"
    )
    
    args = parser.parse_args()
    
    # Read draft
    draft_path = Path(args.draft)
    if not draft_path.exists():
        print(f"Error: Draft file not found: {args.draft}")
        sys.exit(1)
    
    draft_content = draft_path.read_text(encoding='utf-8')
    
    # Create evaluator and run
    evaluator = ReportEvaluator()
    output_dir = Path(args.out)
    
    try:
        results = evaluator.generate_report(
            args.query,
            draft_content,
            output_dir
        )
        
        print("\n[SUCCESS] Evaluation complete!")
        print(f"[SCORE] Overall Score: {results['score']['overall']:.2f}/5.00")
        print(f"[OUTPUT] Reports saved to: {output_dir}")
        
        # Return non-zero exit code if score is poor
        if results['score']['overall'] < 3.0:
            sys.exit(2)  # Indicates poor quality
            
    except Exception as e:
        print(f"[ERROR] Error during evaluation: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    main()
