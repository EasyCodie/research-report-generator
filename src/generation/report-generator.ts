/**
 * Report generation module with template-based output
 * Generates structured reports in multiple formats (Markdown, HTML, PDF)
 */

import { Report, ProcessedFinding, Citation, OutputFormat, ReportProfile } from '../types';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as crypto from 'crypto';

export interface GenerationOptions {
  format: OutputFormat;
  profile: ReportProfile;
  includeMethodology?: boolean;
  includeAppendix?: boolean;
  maxLength?: number;
  templateOverride?: string;
}

export interface GeneratedArtifact {
  format: OutputFormat;
  content: string;
  path?: string;
  size: number;
  checksum: string;
}

export class ReportGenerator {
  private templates: Map<string, string> = new Map();

  /**
   * Generate report in specified format
   * @param report - Report data to generate from
   * @param options - Generation options
   * @returns Generated artifact
   */
  async generate(
    report: Report,
    options: GenerationOptions
  ): Promise<GeneratedArtifact> {
    let content: string;

    switch (options.format) {
      case OutputFormat.MARKDOWN:
        content = await this.generateMarkdown(report, options);
        break;
      case OutputFormat.HTML:
        content = await this.generateHTML(report, options);
        break;
      case OutputFormat.JSON:
        content = this.generateJSON(report);
        break;
      case OutputFormat.PDF:
        // PDF generation would require additional libraries
        throw new Error('PDF generation not yet implemented');
      default:
        throw new Error(`Unsupported format: ${options.format}`);
    }

    const size = Buffer.byteLength(content, 'utf8');
    const checksum = crypto.createHash('sha256').update(content).digest('hex');

    return {
      format: options.format,
      content,
      size,
      checksum
    };
  }

  /**
   * Generate Markdown report
   * @param report - Report data
   * @param options - Generation options
   * @returns Markdown content
   */
  private async generateMarkdown(
    report: Report,
    options: GenerationOptions
  ): Promise<string> {
    const sections: string[] = [];

    // Header
    sections.push(this.generateMarkdownHeader(report));

    // Executive Summary
    sections.push(this.generateMarkdownSummary(report, options.profile));

    // Table of Contents
    if (report.findings.length > 5) {
      sections.push(this.generateMarkdownTOC(report));
    }

    // Main Findings
    sections.push(this.generateMarkdownFindings(report, options));

    // Methodology (optional)
    if (options.includeMethodology) {
      sections.push(this.generateMarkdownMethodology(report));
    }

    // Citations
    sections.push(this.generateMarkdownCitations(report));

    // Appendix (optional)
    if (options.includeAppendix) {
      sections.push(this.generateMarkdownAppendix(report));
    }

    // Footer
    sections.push(this.generateMarkdownFooter(report));

    const content = sections.join('\n\n');
    
    // Apply length limit if specified
    if (options.maxLength && content.length > options.maxLength) {
      return this.truncateContent(content, options.maxLength);
    }

    return content;
  }

  /**
   * Generate HTML report
   * @param report - Report data
   * @param options - Generation options
   * @returns HTML content
   */
  private async generateHTML(
    report: Report,
    options: GenerationOptions
  ): Promise<string> {
    const markdownContent = await this.generateMarkdown(report, options);
    
    // Convert Markdown to HTML (simplified - in production use a proper markdown parser)
    const htmlBody = this.markdownToHTML(markdownContent);
    
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${this.escapeHtml(report.query.raw)} - Research Report</title>
    <style>
        ${this.getHTMLStyles(options.profile)}
    </style>
</head>
<body>
    <div class="container">
        ${htmlBody}
    </div>
    <script>
        ${this.getHTMLScripts()}
    </script>
</body>
</html>`;
  }

  /**
   * Generate JSON report
   * @param report - Report data
   * @returns JSON string
   */
  private generateJSON(report: Report): string {
    return JSON.stringify(report, null, 2);
  }

  // Markdown generation helpers

  private generateMarkdownHeader(report: Report): string {
    return `# Research Report: ${report.query.raw}

**Report ID:** ${report.id}  
**Generated:** ${report.createdAt.toLocaleString()}  
**Version:** ${report.version}  
**Profile:** ${report.metadata.profile}

---`;
  }

  private generateMarkdownSummary(report: Report, profile: ReportProfile): string {
    const summary = report.summary || this.generateSummaryFromFindings(report.findings);
    
    let sectionTitle = '## Executive Summary';
    if (profile === ReportProfile.ACADEMIC) {
      sectionTitle = '## Abstract';
    } else if (profile === ReportProfile.TECHNICAL) {
      sectionTitle = '## Technical Summary';
    }

    return `${sectionTitle}

${summary}

**Key Statistics:**
- Sources Analyzed: ${report.metadata.sourcesAnalyzed}
- Reliability Score: ${(report.metadata.reliabilityScore * 100).toFixed(1)}%
- Processing Time: ${(report.metadata.processingTime / 1000).toFixed(2)} seconds
${report.metadata.biasWarnings.length > 0 ? `- Bias Warnings: ${report.metadata.biasWarnings.length}` : ''}`;
  }

  private generateMarkdownTOC(report: Report): string {
    const sections: string[] = ['## Table of Contents', ''];
    
    sections.push('1. [Executive Summary](#executive-summary)');
    sections.push('2. [Key Findings](#key-findings)');
    
    // Add finding subsections
    const topFindings = report.findings.slice(0, 10);
    topFindings.forEach((finding, index) => {
      const title = this.truncateText(finding.claim, 50);
      sections.push(`   ${index + 1}. [${title}](#finding-${index + 1})`);
    });
    
    sections.push('3. [Citations](#citations)');
    
    return sections.join('\n');
  }

  private generateMarkdownFindings(report: Report, options: GenerationOptions): string {
    const sections: string[] = ['## Key Findings', ''];
    
    const findingsToInclude = options.maxLength 
      ? report.findings.slice(0, Math.min(20, report.findings.length))
      : report.findings;

    findingsToInclude.forEach((finding, index) => {
      sections.push(this.formatFinding(finding, index + 1, options.profile));
      sections.push('');
    });

    // Add bias warnings if any
    if (report.metadata.biasWarnings.length > 0) {
      sections.push('### ⚠️ Bias Warnings');
      sections.push('');
      report.metadata.biasWarnings.forEach(warning => {
        sections.push(`- ${warning}`);
      });
      sections.push('');
    }

    return sections.join('\n');
  }

  private formatFinding(finding: ProcessedFinding, index: number, profile: ReportProfile): string {
    const lines: string[] = [];
    
    // Finding header
    lines.push(`### ${index}. ${finding.claim}`);
    lines.push('');
    
    // Confidence indicator
    const confidenceEmoji = this.getConfidenceEmoji(finding.confidence);
    lines.push(`**Confidence:** ${confidenceEmoji} ${(finding.confidence * 100).toFixed(1)}%`);
    
    // Sources
    if (finding.sources.length > 0) {
      lines.push(`**Sources:** ${finding.sources.length} source${finding.sources.length > 1 ? 's' : ''}`);
    }
    
    // Tags
    if (finding.tags && finding.tags.length > 0) {
      lines.push(`**Tags:** ${finding.tags.map(t => `\`${t}\``).join(', ')}`);
    }
    
    lines.push('');
    
    // Evidence
    if (finding.evidence.length > 0 && profile !== ReportProfile.EXECUTIVE) {
      lines.push('**Supporting Evidence:**');
      finding.evidence.slice(0, 3).forEach(evidence => {
        lines.push(`> ${this.truncateText(evidence, 200)}`);
        lines.push('');
      });
    }
    
    // Bias indicators
    if (finding.biasIndicators && finding.biasIndicators.length > 0) {
      lines.push('**⚠️ Potential Bias:**');
      finding.biasIndicators.forEach(indicator => {
        lines.push(`- ${indicator}`);
      });
      lines.push('');
    }
    
    return lines.join('\n');
  }

  private generateMarkdownMethodology(report: Report): string {
    return `## Methodology

This report was generated using an automated research synthesis system that:

1. **Query Analysis**: Parsed and analyzed the research query to identify intent and key topics
2. **Multi-Source Search**: Searched across multiple sources including:
   - Web search engines
   - Academic databases
   - Technical documentation
   - Code repositories
3. **Content Processing**:
   - Deduplication of similar content
   - Bias detection and flagging
   - Fact-checking against multiple sources
   - Reliability scoring based on source credibility
4. **Synthesis**: Combined findings from multiple sources into structured insights

**Quality Metrics:**
- Average Source Reliability: ${(report.metadata.reliabilityScore * 100).toFixed(1)}%
- Sources Analyzed: ${report.metadata.sourcesAnalyzed}
- Processing Time: ${(report.metadata.processingTime / 1000).toFixed(2)} seconds`;
  }

  private generateMarkdownCitations(report: Report): string {
    const sections: string[] = ['## Citations', ''];
    
    report.citations.forEach((citation, index) => {
      sections.push(this.formatCitation(citation, index + 1));
    });
    
    return sections.join('\n');
  }

  private formatCitation(citation: Citation, index: number): string {
    const parts: string[] = [`[${index}] `];
    
    if (citation.author) {
      parts.push(`${citation.author}. `);
    }
    
    parts.push(`"${citation.title}". `);
    parts.push(`Available at: ${citation.url}. `);
    parts.push(`Accessed: ${citation.accessedAt.toLocaleDateString()}.`);
    
    if (citation.reliabilityScore) {
      parts.push(` (Reliability: ${(citation.reliabilityScore * 100).toFixed(0)}%)`);
    }
    
    return parts.join('');
  }

  private generateMarkdownAppendix(report: Report): string {
    const sections: string[] = ['## Appendix', ''];
    
    // Add query details
    sections.push('### Query Analysis');
    sections.push(`- **Intent:** ${report.query.intent}`);
    sections.push(`- **Topics:** ${report.query.topics.join(', ')}`);
    if (report.query.subtopics.length > 0) {
      sections.push(`- **Subtopics:** ${report.query.subtopics.join(', ')}`);
    }
    sections.push('');
    
    // Add metadata
    sections.push('### Report Metadata');
    sections.push('```json');
    sections.push(JSON.stringify(report.metadata, null, 2));
    sections.push('```');
    
    return sections.join('\n');
  }

  private generateMarkdownFooter(report: Report): string {
    return `---

*This report was automatically generated by the Research Report Generator system.*  
*Report ID: ${report.id} | Version: ${report.version} | Generated: ${report.createdAt.toISOString()}*`;
  }

  // HTML generation helpers

  private markdownToHTML(markdown: string): string {
    // Simplified markdown to HTML conversion
    let html = markdown
      // Headers
      .replace(/^### (.*$)/gim, '<h3>$1</h3>')
      .replace(/^## (.*$)/gim, '<h2>$1</h2>')
      .replace(/^# (.*$)/gim, '<h1>$1</h1>')
      // Bold
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      // Italic
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      // Links
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
      // Line breaks
      .replace(/\n\n/g, '</p><p>')
      // Code blocks
      .replace(/```([^`]+)```/g, '<pre><code>$1</code></pre>')
      // Inline code
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      // Lists
      .replace(/^\- (.+)$/gm, '<li>$1</li>')
      // Blockquotes
      .replace(/^> (.+)$/gm, '<blockquote>$1</blockquote>');
    
    // Wrap in paragraphs
    html = '<p>' + html + '</p>';
    
    // Clean up
    html = html.replace(/<p><\/p>/g, '');
    
    return html;
  }

  private getHTMLStyles(profile: ReportProfile): string {
    const baseStyles = `
      body {
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
        line-height: 1.6;
        color: #333;
        max-width: 900px;
        margin: 0 auto;
        padding: 20px;
        background: #f5f5f5;
      }
      .container {
        background: white;
        padding: 40px;
        border-radius: 8px;
        box-shadow: 0 2px 4px rgba(0,0,0,0.1);
      }
      h1, h2, h3 {
        color: #2c3e50;
        margin-top: 30px;
      }
      h1 {
        border-bottom: 3px solid #3498db;
        padding-bottom: 10px;
      }
      h2 {
        border-bottom: 1px solid #ecf0f1;
        padding-bottom: 5px;
      }
      code {
        background: #f4f4f4;
        padding: 2px 5px;
        border-radius: 3px;
        font-family: 'Courier New', monospace;
      }
      pre {
        background: #f4f4f4;
        padding: 15px;
        border-radius: 5px;
        overflow-x: auto;
      }
      blockquote {
        border-left: 4px solid #3498db;
        padding-left: 15px;
        color: #666;
        font-style: italic;
      }
      strong {
        color: #2c3e50;
      }
      a {
        color: #3498db;
        text-decoration: none;
      }
      a:hover {
        text-decoration: underline;
      }
      ul, ol {
        margin-left: 20px;
      }
    `;

    // Add profile-specific styles
    const profileStyles = {
      [ReportProfile.EXECUTIVE]: `
        h1 { color: #1a5490; }
        .container { max-width: 700px; }
      `,
      [ReportProfile.TECHNICAL]: `
        h1 { color: #0366d6; }
        code { background: #f6f8fa; }
      `,
      [ReportProfile.ACADEMIC]: `
        body { font-family: 'Times New Roman', serif; }
        h1 { color: #4a4a4a; }
      `
    };

    return baseStyles + (profileStyles[profile] || '');
  }

  private getHTMLScripts(): string {
    return `
      // Add interactive features
      document.addEventListener('DOMContentLoaded', function() {
        // Add copy buttons to code blocks
        const codeBlocks = document.querySelectorAll('pre code');
        codeBlocks.forEach(block => {
          const button = document.createElement('button');
          button.textContent = 'Copy';
          button.style.cssText = 'position: absolute; top: 5px; right: 5px; padding: 5px 10px;';
          button.onclick = () => {
            navigator.clipboard.writeText(block.textContent);
            button.textContent = 'Copied!';
            setTimeout(() => button.textContent = 'Copy', 2000);
          };
          block.parentElement.style.position = 'relative';
          block.parentElement.appendChild(button);
        });
      });
    `;
  }

  // Utility methods

  private generateSummaryFromFindings(findings: ProcessedFinding[]): string {
    if (findings.length === 0) {
      return 'No significant findings were identified in the analyzed sources.';
    }

    const topFindings = findings.slice(0, 3);
    const summary = [
      `This research analyzed multiple sources and identified ${findings.length} key findings.`,
      `The most significant insights include:`,
      ...topFindings.map(f => `- ${this.truncateText(f.claim, 100)}`),
    ];

    return summary.join('\n');
  }

  private getConfidenceEmoji(confidence: number): string {
    if (confidence >= 0.8) return '✅';
    if (confidence >= 0.6) return '✓';
    if (confidence >= 0.4) return '⚠️';
    return '❓';
  }

  private truncateText(text: string, maxLength: number): string {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength - 3) + '...';
  }

  private truncateContent(content: string, maxLength: number): string {
    if (content.length <= maxLength) return content;
    
    // Try to truncate at a sensible point
    const truncated = content.substring(0, maxLength);
    const lastNewline = truncated.lastIndexOf('\n');
    
    if (lastNewline > maxLength * 0.8) {
      return truncated.substring(0, lastNewline) + '\n\n*[Report truncated due to length constraints]*';
    }
    
    return truncated + '...\n\n*[Report truncated due to length constraints]*';
  }

  private escapeHtml(text: string): string {
    const map: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, m => map[m]);
  }
}
