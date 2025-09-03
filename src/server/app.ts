import fastify, { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import fastifyStatic from '@fastify/static';
import { ResearchReportGenerator } from '../core/ResearchReportGenerator';
import { ReportProfile, OutputFormat } from '../types';
import { jobManager } from './job-manager';
import * as fs from 'fs/promises';
import * as path from 'path';

interface GenerateReportBody {
  query: string;
  profile?: ReportProfile;
  formats?: OutputFormat[];
  maxSources?: number;
}

export async function startServer(port: number = 3000): Promise<FastifyInstance> {
  const server = fastify({
    logger: {
      level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
      transport: {
        target: 'pino-pretty',
        options: {
          colorize: true
        }
      }
    }
  });

  // Register plugins
  await server.register(cors, {
    origin: true
  });

  // Serve static files from public directory
  await server.register(fastifyStatic, {
    root: path.join(process.cwd(), 'public'),
    prefix: '/public/',
  });

  // Serve the web interface at root
  server.get('/', async (request, reply) => {
    return reply.sendFile('index.html');
  });

  // Health check endpoint
  server.get('/api/health', async (request, reply) => {
    return {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime()
    };
  });

  // Create report endpoint
  server.post<{ Body: GenerateReportBody }>('/api/reports', async (request, reply) => {
    const {
      query,
      profile = ReportProfile.TECHNICAL,
      formats = [OutputFormat.MARKDOWN],
      maxSources = 10
    } = request.body;

    if (!query) {
      return reply.code(400).send({
        error: 'Query is required'
      });
    }

    const generator = new ResearchReportGenerator();
    const jobId = generator['reportId']; // Access private property for demo

    // Create job with automatic cleanup
    jobManager.createJob(jobId);

    // Start generation in background
    generator.generateReport(query, {
      profile,
      formats,
      maxSources,
      outputDir: process.env.REPORTS_DIR || 'reports'
    }).then(report => {
      jobManager.completeJob(jobId, report);
    }).catch(error => {
      jobManager.failJob(jobId, error.message);
    });

    // Track progress
    generator.on('progress', (event) => {
      jobManager.updateProgress(jobId, event.percent, event.stage);
    });

    return {
      jobId,
      status: 'accepted',
      message: 'Report generation started'
    };
  });

  // Get report status
  server.get<{ Params: { id: string } }>('/api/reports/:id', async (request, reply) => {
    const { id } = request.params;
    const job = jobManager.getJob(id);

    if (!job) {
      return reply.code(404).send({
        error: 'Report not found'
      });
    }

    return {
      jobId: id,
      status: job.status,
      progress: job.progress,
      currentStage: job.currentStage,
      startedAt: job.startedAt,
      completedAt: job.completedAt,
      failedAt: job.failedAt,
      error: job.error
    };
  });

  // Download report
  server.get<{ 
    Params: { id: string },
    Querystring: { format?: string }
  }>('/api/reports/:id/download', async (request, reply) => {
    const { id } = request.params;
    const { format = 'md' } = request.query;
    const job = jobManager.getJob(id);

    if (!job) {
      return reply.code(404).send({
        error: 'Report not found'
      });
    }

    if (job.status !== 'completed') {
      return reply.code(400).send({
        error: 'Report is not ready yet',
        status: job.status
      });
    }

    const artifact = job.report.artifacts.find((a: any) => a.format === format);
    if (!artifact) {
      return reply.code(404).send({
        error: `Format ${format} not available`
      });
    }

    try {
      const content = await fs.readFile(artifact.path, 'utf-8');
      const mimeTypes: Record<string, string> = {
        md: 'text/markdown',
        html: 'text/html',
        pdf: 'application/pdf',
        json: 'application/json'
      };

      reply.type(mimeTypes[format] || 'text/plain');
      return content;
    } catch (error) {
      return reply.code(500).send({
        error: 'Failed to read report file'
      });
    }
  });

  // List all reports
  server.get('/api/reports', async (request, reply) => {
    const jobs = jobManager.getAllJobs();
    const reports = jobs.map(job => ({
      id: job.id,
      status: job.status,
      progress: job.progress,
      startedAt: job.startedAt,
      completedAt: job.completedAt
    }));

    return { reports };
  });

  // Get job statistics
  server.get('/api/stats', async (request, reply) => {
    return jobManager.getStats();
  });

  // Get reliability database
  server.get('/api/sources/reliability', async (request, reply) => {
    try {
      const reliabilityPath = path.join('config', 'sources', 'reliability.json');
      if (await fs.access(reliabilityPath).then(() => true).catch(() => false)) {
        const data = await fs.readFile(reliabilityPath, 'utf-8');
        return JSON.parse(data);
      }
      return { message: 'Reliability database not configured' };
    } catch (error) {
      return reply.code(500).send({
        error: 'Failed to load reliability database'
      });
    }
  });

  // Evaluate a report
  server.post<{ 
    Body: { 
      query: string; 
      reportId?: string;
      draft?: string;
    } 
  }>('/api/evaluate', async (request, reply) => {
    const { query, reportId, draft } = request.body;
    
    if (!query) {
      return reply.code(400).send({
        error: 'Query is required'
      });
    }
    
    let draftContent = draft;
    
    // If reportId provided, fetch the report content
    if (reportId && !draft) {
      const job = activeJobs.get(reportId);
      if (!job || job.status !== 'completed') {
        return reply.code(404).send({
          error: 'Report not found or not completed'
        });
      }
      
      // Read the markdown report
      const mdArtifact = job.report.artifacts.find((a: any) => a.format === 'md');
      if (mdArtifact) {
        draftContent = await fs.readFile(mdArtifact.path, 'utf-8');
      }
    }
    
    if (!draftContent) {
      return reply.code(400).send({
        error: 'Either draft content or valid reportId is required'
      });
    }
    
    // Run Python evaluator
    const { spawn } = require('child_process');
    const tempDir = path.join('temp', `eval_${Date.now()}`);
    const draftPath = path.join(tempDir, 'draft.md');
    
    // Create temp directory and save draft
    await fs.mkdir(tempDir, { recursive: true });
    await fs.writeFile(draftPath, draftContent);
    
    return new Promise((resolve) => {
      const pythonProcess = spawn('python', [
        'evaluator.py',
        '--query', query,
        '--draft', draftPath,
        '--out', tempDir
      ]);
      
      let output = '';
      let error = '';
      
      pythonProcess.stdout.on('data', (data: Buffer) => {
        output += data.toString();
      });
      
      pythonProcess.stderr.on('data', (data: Buffer) => {
        error += data.toString();
      });
      
      pythonProcess.on('close', async (code: number) => {
        if (code === 0 || code === 2) { // 2 = poor quality but successful
          try {
            // Read the JSON report
            const jsonPath = path.join(tempDir, 'report.json');
            const jsonContent = await fs.readFile(jsonPath, 'utf-8');
            const evaluation = JSON.parse(jsonContent);
            
            // Clean up temp files
            await fs.rm(tempDir, { recursive: true, force: true });
            
            resolve(reply.send({
              success: true,
              evaluation,
              output
            }));
          } catch (err) {
            resolve(reply.code(500).send({
              error: 'Failed to read evaluation results',
              details: err
            }));
          }
        } else {
          resolve(reply.code(500).send({
            error: 'Evaluation failed',
            output,
            stderr: error
          }));
        }
      });
    });
  });

  // Start server
  try {
    await server.listen({ port, host: '0.0.0.0' });
    console.log(`Server listening on http://localhost:${port}`);
    console.log(`Health check: http://localhost:${port}/api/health`);
    return server;
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
}

// Only start if this file is run directly
if (require.main === module) {
  const port = parseInt(process.env.PORT || '3000', 10);
  startServer(port);
}
