#!/usr/bin/env node

import { Command } from 'commander';
import { ResearchReportGenerator } from './core/ResearchReportGenerator';
import { ReportProfile, OutputFormat } from './types';
import * as fs from 'fs';
import * as path from 'path';

const program = new Command();

program
  .name('research-report')
  .description('Autonomous research report generator')
  .version('1.0.0');

program
  .command('generate')
  .description('Generate a research report from a query')
  .argument('<query>', 'Research query in natural language')
  .option('-p, --profile <profile>', 'Report profile (executive, technical, academic)', 'technical')
  .option('-f, --formats <formats>', 'Output formats (comma-separated: md,html,pdf)', 'md')
  .option('-m, --max-sources <number>', 'Maximum sources to analyze', '10')
  .option('-o, --output <dir>', 'Output directory', 'reports')
  .action(async (query: string, options) => {
    console.log('🔍 Starting research report generation...');
    console.log(`Query: "${query}"`);
    console.log(`Profile: ${options.profile}`);
    console.log(`Formats: ${options.formats}`);
    console.log(`Max sources: ${options.maxSources}`);
    
    try {
      // Parse options
      const profile = options.profile as ReportProfile;
      const formats = options.formats.split(',').map((f: string) => f.trim() as OutputFormat);
      const maxSources = parseInt(options.maxSources, 10);
      
      // Initialize generator
      const generator = new ResearchReportGenerator();
      
      // Set up progress monitoring
      generator.on('progress', (event) => {
        console.log(`[${event.stage}] ${event.message} (${event.percent}%)`);
      });
      
      // Generate report
      const report = await generator.generateReport(query, {
        profile,
        formats,
        maxSources,
        outputDir: options.output
      });
      
      console.log('✅ Report generation complete!');
      console.log(`Report ID: ${report.id}`);
      console.log(`Version: ${report.version}`);
      console.log('Artifacts:');
      report.artifacts.forEach(artifact => {
        console.log(`  - ${artifact.format.toUpperCase()}: ${artifact.path}`);
      });
      
    } catch (error) {
      console.error('❌ Error generating report:', error);
      process.exit(1);
    }
  });

program
  .command('interactive')
  .description('Start interactive research session')
  .action(async () => {
    console.log('🚀 Starting interactive research session...');
    console.log('This feature is coming soon!');
    // TODO: Implement interactive mode with readline or inquirer
  });

program
  .command('serve')
  .description('Start the API server')
  .option('-p, --port <port>', 'Server port', '3000')
  .action(async (options) => {
    console.log(`🌐 Starting API server on port ${options.port}...`);
    // Import and start the server
    const { startServer } = await import('./server/app');
    await startServer(parseInt(options.port, 10));
  });

program
  .command('schedule')
  .description('Schedule periodic report generation')
  .option('-c, --config <file>', 'Schedule configuration file', 'config/schedules.json')
  .action(async (options) => {
    console.log(`⏰ Loading schedule configuration from ${options.config}...`);
    
    if (!fs.existsSync(options.config)) {
      console.error(`Configuration file not found: ${options.config}`);
      process.exit(1);
    }
    
    const config = JSON.parse(fs.readFileSync(options.config, 'utf-8'));
    console.log(`Loaded ${config.schedules?.length || 0} schedules`);
    
    // TODO: Implement scheduler with node-cron
    console.log('Scheduler feature is coming soon!');
  });

program.parse();
