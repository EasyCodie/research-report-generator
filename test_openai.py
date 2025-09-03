#!/usr/bin/env python3
"""
Test script to verify OpenAI integration in evaluator.py
"""

import os
import json
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

def test_openai_connection():
    """Test if OpenAI API is accessible"""
    import requests
    
    api_key = os.getenv('OPENAI_API_KEY')
    model = os.getenv('OPENAI_MODEL', 'gpt-3.5-turbo')
    
    if not api_key:
        print("❌ OPENAI_API_KEY not found in environment variables")
        print("   Please add it to your .env file")
        return False
    
    print(f"✓ Found OPENAI_API_KEY in environment")
    print(f"✓ Using model: {model}")
    
    # Test API connection
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json"
    }
    
    test_data = {
        "model": model,
        "messages": [
            {"role": "user", "content": "Say 'API connection successful' and nothing else."}
        ],
        "max_tokens": 10,
        "temperature": 0
    }
    
    try:
        print("\n🔄 Testing OpenAI API connection...")
        response = requests.post(
            "https://api.openai.com/v1/chat/completions",
            headers=headers,
            json=test_data,
            timeout=10
        )
        
        if response.status_code == 200:
            result = response.json()
            message = result['choices'][0]['message']['content']
            print(f"✅ Success! Response: {message}")
            return True
        elif response.status_code == 401:
            print("❌ Authentication failed - check your API key")
        elif response.status_code == 404:
            print(f"❌ Model '{model}' not found - check OPENAI_MODEL in .env")
        elif response.status_code == 429:
            print("❌ Rate limit exceeded or insufficient credits")
        else:
            print(f"❌ API request failed: {response.status_code}")
            print(f"   Response: {response.text}")
        
        return False
        
    except requests.exceptions.Timeout:
        print("❌ Request timed out - check your internet connection")
        return False
    except Exception as e:
        print(f"❌ Error: {e}")
        return False

def test_evaluator_import():
    """Test if evaluator can be imported with OpenAI changes"""
    try:
        print("\n🔄 Testing evaluator.py import...")
        from evaluator import ReportEvaluator
        print("✅ Successfully imported ReportEvaluator")
        
        # Try to instantiate
        evaluator = ReportEvaluator()
        print("✅ Successfully instantiated ReportEvaluator")
        
        # Check if OpenAI is configured
        if evaluator.api_key:
            print(f"✅ OpenAI API key configured in evaluator")
            print(f"✅ Using model: {evaluator.model}")
        else:
            print("⚠️  No OpenAI API key - evaluator will use fallback mode")
        
        return True
        
    except ImportError as e:
        print(f"❌ Import error: {e}")
        print("   Make sure all Python dependencies are installed:")
        print("   pip install -r requirements.txt")
        return False
    except Exception as e:
        print(f"❌ Error: {e}")
        return False

def main():
    """Run all tests"""
    print("=" * 50)
    print("OpenAI Integration Test for Research Report Generator")
    print("=" * 50)
    
    # Test 1: Check OpenAI connection
    api_ok = test_openai_connection()
    
    # Test 2: Check evaluator import
    import_ok = test_evaluator_import()
    
    # Summary
    print("\n" + "=" * 50)
    print("Test Results:")
    print("=" * 50)
    
    if api_ok and import_ok:
        print("✅ All tests passed! The evaluator is ready to use with OpenAI.")
        print("\nYou can now run:")
        print("  python evaluator.py --query 'your query' --draft report.md --out results")
    elif import_ok and not api_ok:
        print("⚠️  Evaluator imports successfully but OpenAI API is not configured.")
        print("The evaluator will work in fallback mode (basic pattern matching).")
        print("\nTo enable AI features, add your OPENAI_API_KEY to the .env file.")
    else:
        print("❌ Some tests failed. Please check the errors above.")
    
    return 0 if (api_ok and import_ok) else 1

if __name__ == "__main__":
    exit(main())
