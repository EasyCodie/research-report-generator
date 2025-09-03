/**
 * Centralized domain reliability configuration
 * Single source of truth for domain scoring and categorization
 */

export interface DomainInfo {
  score: number;
  category: 'academic' | 'technical' | 'government' | 'news' | 'social' | 'unknown';
  rationale: string;
}

export const RELIABLE_DOMAINS = {
  // Specific high-value domains with their reliability scores
  specific: {
    'github.com': {
      score: 0.95,
      category: 'technical',
      rationale: 'Official source code repository'
    },
    'stackoverflow.com': {
      score: 0.90,
      category: 'technical',
      rationale: 'Peer-reviewed technical Q&A'
    },
    'developer.mozilla.org': {
      score: 0.95,
      category: 'technical',
      rationale: 'Official web standards documentation'
    },
    'docs.microsoft.com': {
      score: 0.92,
      category: 'technical',
      rationale: 'Official Microsoft documentation'
    },
    'aws.amazon.com': {
      score: 0.92,
      category: 'technical',
      rationale: 'Official AWS documentation'
    },
    'cloud.google.com': {
      score: 0.92,
      category: 'technical',
      rationale: 'Official Google Cloud documentation'
    },
    'developer.android.com': {
      score: 0.93,
      category: 'technical',
      rationale: 'Official Android documentation'
    },
    'developer.apple.com': {
      score: 0.93,
      category: 'technical',
      rationale: 'Official Apple developer documentation'
    },
    'arxiv.org': {
      score: 0.88,
      category: 'academic',
      rationale: 'Pre-print academic papers'
    },
    'nature.com': {
      score: 0.95,
      category: 'academic',
      rationale: 'Peer-reviewed scientific journal'
    },
    'sciencedirect.com': {
      score: 0.90,
      category: 'academic',
      rationale: 'Academic paper database'
    },
    'ieee.org': {
      score: 0.92,
      category: 'academic',
      rationale: 'Professional engineering organization'
    },
    'acm.org': {
      score: 0.92,
      category: 'academic',
      rationale: 'Computing machinery professional organization'
    },
    'springer.com': {
      score: 0.88,
      category: 'academic',
      rationale: 'Academic publisher'
    },
    'wikipedia.org': {
      score: 0.75,
      category: 'academic',
      rationale: 'Crowd-sourced encyclopedia with citations'
    },
    'medium.com': {
      score: 0.60,
      category: 'social',
      rationale: 'User-generated content platform'
    },
    'dev.to': {
      score: 0.65,
      category: 'social',
      rationale: 'Developer community platform'
    },
    'reddit.com': {
      score: 0.55,
      category: 'social',
      rationale: 'Community discussion platform'
    },
    'hackernoon.com': {
      score: 0.65,
      category: 'technical',
      rationale: 'Tech blog platform'
    },
    'towardsdatascience.com': {
      score: 0.70,
      category: 'technical',
      rationale: 'Data science blog platform'
    },
    'freecodecamp.org': {
      score: 0.80,
      category: 'technical',
      rationale: 'Educational coding platform'
    },
    'w3schools.com': {
      score: 0.75,
      category: 'technical',
      rationale: 'Web development tutorials'
    },
    'geeksforgeeks.org': {
      score: 0.78,
      category: 'technical',
      rationale: 'Computer science tutorials'
    },
    'tutorialspoint.com': {
      score: 0.70,
      category: 'technical',
      rationale: 'Programming tutorials'
    }
  } as Record<string, DomainInfo>,

  // Category-based scoring for TLD patterns
  categories: {
    academic: {
      score: 0.85,
      category: 'academic' as const,
      rationale: 'Educational institution'
    },
    government: {
      score: 0.90,
      category: 'government' as const,
      rationale: 'Government website'
    },
    nonprofit: {
      score: 0.75,
      category: 'academic' as const,
      rationale: 'Non-profit organization'
    }
  },

  // Pattern-based matching for domain categories
  patterns: {
    technical: [
      'docs.',
      'developer.',
      'developers.',
      'dev.',
      'api.',
      'engineering.',
      'tech.',
      'code.',
      'git.',
      'docker.',
      'kubernetes.'
    ],
    academic: [
      'research.',
      'journal.',
      'academic.',
      'scholar.',
      'university.',
      'edu.',
      'science.',
      'publication.'
    ],
    news: [
      'news.',
      'reuters.',
      'bloomberg.',
      'techcrunch.',
      'verge.',
      'wired.',
      'arstechnica.',
      'zdnet.',
      'cnet.',
      'engadget.'
    ],
    social: [
      'blog.',
      'blogs.',
      'medium.',
      'wordpress.',
      'tumblr.',
      'blogger.',
      'substack.',
      'hashnode.',
      'dev.to'
    ]
  },

  // Unreliable or low-quality domains to flag
  lowQuality: [
    'example.com',
    'test.com',
    'localhost',
    '127.0.0.1',
    'demo.com',
    'sample.com'
  ],

  // Scoring adjustments based on various factors
  adjustments: {
    // Bonus for HTTPS
    httpsBonus: 0.05,
    
    // Penalty for user-generated content
    userGeneratedPenalty: -0.15,
    
    // Bonus for peer review
    peerReviewBonus: 0.10,
    
    // Penalty for no author attribution
    noAuthorPenalty: -0.10,
    
    // Bonus for citations/references
    citationsBonus: 0.08,
    
    // Age-based adjustments
    freshContentBonus: 0.10, // < 30 days
    staleContentPenalty: -0.10, // > 2 years
    
    // Length-based adjustments
    comprehensiveBonus: 0.05, // > 5000 words
    stubPenalty: -0.15 // < 200 words
  }
};

/**
 * Get domain reliability information
 * @param domain - Domain to evaluate
 * @returns Domain reliability info
 */
export function getDomainInfo(domain: string): DomainInfo {
  const lowerDomain = domain.toLowerCase();
  
  // Check specific domains
  for (const [pattern, info] of Object.entries(RELIABLE_DOMAINS.specific)) {
    if (lowerDomain.includes(pattern)) {
      return info;
    }
  }
  
  // Check TLD categories
  if (lowerDomain.endsWith('.edu')) {
    return RELIABLE_DOMAINS.categories.academic;
  }
  if (lowerDomain.endsWith('.gov')) {
    return RELIABLE_DOMAINS.categories.government;
  }
  if (lowerDomain.endsWith('.org')) {
    return RELIABLE_DOMAINS.categories.nonprofit;
  }
  
  // Check patterns
  for (const [category, patterns] of Object.entries(RELIABLE_DOMAINS.patterns)) {
    for (const pattern of patterns) {
      if (lowerDomain.includes(pattern)) {
        return {
          score: category === 'technical' ? 0.80 : 
                 category === 'academic' ? 0.85 :
                 category === 'news' ? 0.70 : 0.60,
          category: category as any,
          rationale: `${category} content domain`
        };
      }
    }
  }
  
  // Check if it's a low-quality domain
  for (const lowQualityDomain of RELIABLE_DOMAINS.lowQuality) {
    if (lowerDomain.includes(lowQualityDomain)) {
      return {
        score: 0.10,
        category: 'unknown',
        rationale: 'Low-quality or test domain'
      };
    }
  }
  
  // Default for unknown domains
  return {
    score: 0.50,
    category: 'unknown',
    rationale: 'Unknown domain - baseline reliability'
  };
}

/**
 * Calculate adjusted domain score based on additional factors
 * @param baseScore - Base domain score
 * @param factors - Additional factors to consider
 * @returns Adjusted score
 */
export function adjustDomainScore(
  baseScore: number,
  factors: {
    isHttps?: boolean;
    hasAuthor?: boolean;
    hasCitations?: boolean;
    contentAge?: number; // in days
    contentLength?: number; // in characters
    isUserGenerated?: boolean;
    isPeerReviewed?: boolean;
  }
): number {
  let score = baseScore;
  const adj = RELIABLE_DOMAINS.adjustments;
  
  if (factors.isHttps) score += adj.httpsBonus;
  if (factors.isUserGenerated) score += adj.userGeneratedPenalty;
  if (factors.isPeerReviewed) score += adj.peerReviewBonus;
  if (factors.hasAuthor === false) score += adj.noAuthorPenalty;
  if (factors.hasCitations) score += adj.citationsBonus;
  
  // Age adjustments
  if (factors.contentAge !== undefined) {
    if (factors.contentAge < 30) score += adj.freshContentBonus;
    else if (factors.contentAge > 730) score += adj.staleContentPenalty;
  }
  
  // Length adjustments
  if (factors.contentLength !== undefined) {
    if (factors.contentLength > 5000) score += adj.comprehensiveBonus;
    else if (factors.contentLength < 200) score += adj.stubPenalty;
  }
  
  // Ensure score stays within bounds
  return Math.max(0.1, Math.min(1.0, score));
}

/**
 * Categorize a URL based on its domain and path
 * @param url - Full URL to categorize
 * @returns Category and confidence
 */
export function categorizeUrl(url: string): {
  category: string;
  confidence: number;
  rationale: string;
} {
  try {
    const urlObj = new URL(url);
    const domain = urlObj.hostname;
    const path = urlObj.pathname.toLowerCase();
    
    // Get base domain info
    const domainInfo = getDomainInfo(domain);
    
    // Path-based categorization hints
    let pathCategory = 'unknown';
    let pathConfidence = 0.5;
    
    if (path.includes('/docs/') || path.includes('/documentation/')) {
      pathCategory = 'technical';
      pathConfidence = 0.8;
    } else if (path.includes('/blog/') || path.includes('/posts/')) {
      pathCategory = 'social';
      pathConfidence = 0.7;
    } else if (path.includes('/research/') || path.includes('/papers/')) {
      pathCategory = 'academic';
      pathConfidence = 0.8;
    } else if (path.includes('/news/') || path.includes('/article/')) {
      pathCategory = 'news';
      pathConfidence = 0.7;
    } else if (path.includes('/api/') || path.includes('/reference/')) {
      pathCategory = 'technical';
      pathConfidence = 0.85;
    }
    
    // Combine domain and path categorization
    if (domainInfo.category !== 'unknown' && pathCategory !== 'unknown') {
      // Both have opinions
      if (domainInfo.category === pathCategory) {
        // Agreement - high confidence
        return {
          category: domainInfo.category,
          confidence: Math.max(domainInfo.score, pathConfidence),
          rationale: `Domain and path both indicate ${domainInfo.category} content`
        };
      } else {
        // Disagreement - use domain with lower confidence
        return {
          category: domainInfo.category,
          confidence: domainInfo.score * 0.8,
          rationale: `Domain suggests ${domainInfo.category}, but path suggests ${pathCategory}`
        };
      }
    } else if (domainInfo.category !== 'unknown') {
      // Only domain has opinion
      return {
        category: domainInfo.category,
        confidence: domainInfo.score,
        rationale: domainInfo.rationale
      };
    } else if (pathCategory !== 'unknown') {
      // Only path has opinion
      return {
        category: pathCategory,
        confidence: pathConfidence * 0.7, // Lower confidence without domain support
        rationale: `Path pattern suggests ${pathCategory} content`
      };
    }
    
    // Neither has strong opinion
    return {
      category: 'unknown',
      confidence: 0.5,
      rationale: 'Unable to determine content category'
    };
  } catch (e) {
    return {
      category: 'unknown',
      confidence: 0,
      rationale: 'Invalid URL'
    };
  }
}
