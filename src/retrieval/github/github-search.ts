import { Octokit } from '@octokit/rest';
import { SearchResult, SearchProvider } from '../../types';
import { config } from '../../config/config';

export class GitHubSearchProvider implements SearchProvider {
  name = 'GitHub';
  private octokit: Octokit;

  constructor() {
    this.octokit = new Octokit({
      auth: config.github.token,
      timeoutMs: config.timeouts.request,
    });
  }

  async search(query: string, maxResults: number = 10): Promise<SearchResult[]> {
    const results: SearchResult[] = [];
    
    try {
      // Search repositories
      const repoResults = await this.searchRepositories(query, Math.ceil(maxResults / 2));
      results.push(...repoResults);

      // Search code (if we need more results)
      if (results.length < maxResults) {
        const codeResults = await this.searchCode(query, maxResults - results.length);
        results.push(...codeResults);
      }

      return results.slice(0, maxResults);
    } catch (error) {
      console.error('GitHub Search API error:', error);
      return results;
    }
  }

  private async searchRepositories(query: string, limit: number): Promise<SearchResult[]> {
    try {
      const response = await this.octokit.search.repos({
        q: query,
        sort: 'stars',
        order: 'desc',
        per_page: Math.min(limit, 30), // GitHub API max is 100, but 30 is reasonable
      });

      return response.data.items.map(repo => this.transformRepoResult(repo));
    } catch (error: any) {
      if (error.status === 403 && error.response?.headers['x-ratelimit-remaining'] === '0') {
        console.warn('GitHub API rate limit reached for repository search');
      }
      return [];
    }
  }

  private async searchCode(query: string, limit: number): Promise<SearchResult[]> {
    try {
      const response = await this.octokit.search.code({
        q: query,
        sort: 'indexed',
        order: 'desc',
        per_page: Math.min(limit, 30),
      });

      return response.data.items.map(item => this.transformCodeResult(item));
    } catch (error: any) {
      if (error.status === 403 && error.response?.headers['x-ratelimit-remaining'] === '0') {
        console.warn('GitHub API rate limit reached for code search');
      }
      return [];
    }
  }

  private transformRepoResult(repo: any): SearchResult {
    const description = repo.description || 'No description available';
    const topics = repo.topics?.length > 0 ? `Topics: ${repo.topics.join(', ')}. ` : '';
    const stats = `⭐ ${repo.stargazers_count} stars, 🍴 ${repo.forks_count} forks. `;
    
    return {
      title: repo.full_name,
      url: repo.html_url,
      snippet: `${description}. ${topics}${stats}Language: ${repo.language || 'Unknown'}`,
      source: 'GitHub Repository',
      score: this.calculateRepoScore(repo),
      fetchedAt: new Date(),
    };
  }

  private transformCodeResult(item: any): SearchResult {
    return {
      title: `${item.repository.full_name} - ${item.name}`,
      url: item.html_url,
      snippet: `Code file: ${item.path}. Repository: ${item.repository.description || 'No description'}`,
      source: 'GitHub Code',
      score: this.calculateCodeScore(item),
      fetchedAt: new Date(),
    };
  }

  private calculateRepoScore(repo: any): number {
    let score = 0.5; // Base score

    // Stars contribution (logarithmic scale)
    if (repo.stargazers_count > 0) {
      score += Math.min(Math.log10(repo.stargazers_count) / 10, 0.2);
    }

    // Forks contribution
    if (repo.forks_count > 0) {
      score += Math.min(Math.log10(repo.forks_count) / 10, 0.1);
    }

    // Recent update boost
    const updatedAt = new Date(repo.updated_at);
    const daysSinceUpdate = (Date.now() - updatedAt.getTime()) / (1000 * 60 * 60 * 24);
    if (daysSinceUpdate < 30) score += 0.15;
    else if (daysSinceUpdate < 90) score += 0.1;
    else if (daysSinceUpdate < 180) score += 0.05;

    // Has description and topics
    if (repo.description) score += 0.05;
    if (repo.topics && repo.topics.length > 0) score += 0.05;

    return Math.min(score, 1.0);
  }

  private calculateCodeScore(item: any): number {
    let score = 0.6; // Base score for code results

    // Repository quality affects code score
    if (item.repository) {
      const repo = item.repository;
      if (repo.stargazers_count > 100) score += 0.1;
      if (repo.stargazers_count > 1000) score += 0.1;
    }

    // File type boost for documentation and examples
    const fileName = item.name.toLowerCase();
    if (fileName.includes('readme') || fileName.includes('doc')) {
      score += 0.1;
    }
    if (fileName.includes('example') || fileName.includes('demo')) {
      score += 0.1;
    }

    return Math.min(score, 1.0);
  }
}
