/**
 * Job Manager for handling report generation jobs with automatic cleanup
 * Prevents memory leaks by removing old jobs and managing job lifecycle
 */

import { Report } from '../types';

export interface Job {
  id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;
  currentStage?: string;
  startedAt: Date;
  completedAt?: Date;
  failedAt?: Date;
  lastUpdate?: Date;
  report?: Report;
  error?: string;
}

export class JobManager {
  private jobs = new Map<string, Job>();
  private cleanupInterval: NodeJS.Timeout | null = null;
  private readonly maxJobAge = 24 * 60 * 60 * 1000; // 24 hours
  private readonly maxJobs = 1000; // Maximum number of jobs to keep
  private readonly cleanupIntervalMs = 60 * 60 * 1000; // Run cleanup every hour

  constructor() {
    this.startCleanupScheduler();
  }

  /**
   * Create a new job
   * @param id - Unique job identifier
   * @returns The created job
   */
  createJob(id: string): Job {
    // Clean up if we're at capacity
    if (this.jobs.size >= this.maxJobs) {
      this.removeOldestJobs(Math.floor(this.maxJobs * 0.1)); // Remove 10% of oldest jobs
    }

    const job: Job = {
      id,
      status: 'pending',
      progress: 0,
      startedAt: new Date()
    };

    this.jobs.set(id, job);
    return job;
  }

  /**
   * Get a job by ID
   * @param id - Job identifier
   * @returns The job if found, undefined otherwise
   */
  getJob(id: string): Job | undefined {
    return this.jobs.get(id);
  }

  /**
   * Update job status
   * @param id - Job identifier
   * @param updates - Partial job updates
   */
  updateJob(id: string, updates: Partial<Job>): void {
    const job = this.jobs.get(id);
    if (job) {
      Object.assign(job, updates, { lastUpdate: new Date() });
    }
  }

  /**
   * Mark job as completed
   * @param id - Job identifier
   * @param report - The generated report
   */
  completeJob(id: string, report: Report): void {
    this.updateJob(id, {
      status: 'completed',
      progress: 100,
      completedAt: new Date(),
      report
    });
  }

  /**
   * Mark job as failed
   * @param id - Job identifier
   * @param error - Error message
   */
  failJob(id: string, error: string): void {
    this.updateJob(id, {
      status: 'failed',
      failedAt: new Date(),
      error
    });
  }

  /**
   * Update job progress
   * @param id - Job identifier
   * @param progress - Progress percentage (0-100)
   * @param stage - Current stage description
   */
  updateProgress(id: string, progress: number, stage?: string): void {
    this.updateJob(id, {
      status: 'processing',
      progress,
      currentStage: stage
    });
  }

  /**
   * Get all jobs (with optional status filter)
   * @param status - Optional status filter
   * @returns Array of jobs
   */
  getAllJobs(status?: Job['status']): Job[] {
    const jobs = Array.from(this.jobs.values());
    if (status) {
      return jobs.filter(job => job.status === status);
    }
    return jobs;
  }

  /**
   * Clean up old jobs to prevent memory leaks
   * @returns Number of jobs removed
   */
  cleanupOldJobs(): number {
    const now = Date.now();
    const jobsToRemove: string[] = [];

    for (const [id, job] of this.jobs) {
      const jobAge = now - job.startedAt.getTime();
      
      // Remove jobs older than maxJobAge
      if (jobAge > this.maxJobAge) {
        jobsToRemove.push(id);
        continue;
      }

      // Remove failed jobs after 6 hours
      if (job.status === 'failed' && job.failedAt) {
        const failedAge = now - job.failedAt.getTime();
        if (failedAge > 6 * 60 * 60 * 1000) {
          jobsToRemove.push(id);
        }
      }
    }

    jobsToRemove.forEach(id => this.jobs.delete(id));
    
    if (jobsToRemove.length > 0) {
      console.log(`JobManager: Cleaned up ${jobsToRemove.length} old jobs`);
    }

    return jobsToRemove.length;
  }

  /**
   * Remove oldest jobs to make room for new ones
   * @param count - Number of jobs to remove
   */
  private removeOldestJobs(count: number): void {
    const sortedJobs = Array.from(this.jobs.entries())
      .sort((a, b) => a[1].startedAt.getTime() - b[1].startedAt.getTime())
      .slice(0, count);

    sortedJobs.forEach(([id]) => this.jobs.delete(id));
    
    if (sortedJobs.length > 0) {
      console.log(`JobManager: Removed ${sortedJobs.length} oldest jobs to make room`);
    }
  }

  /**
   * Start the automatic cleanup scheduler
   */
  private startCleanupScheduler(): void {
    if (this.cleanupInterval) {
      return; // Already running
    }

    this.cleanupInterval = setInterval(() => {
      this.cleanupOldJobs();
    }, this.cleanupIntervalMs);

    // Run initial cleanup
    this.cleanupOldJobs();
  }

  /**
   * Stop the cleanup scheduler (for graceful shutdown)
   */
  stopCleanupScheduler(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }

  /**
   * Get statistics about current jobs
   * @returns Job statistics
   */
  getStats(): {
    total: number;
    pending: number;
    processing: number;
    completed: number;
    failed: number;
    oldestJob?: Date;
    newestJob?: Date;
  } {
    const jobs = this.getAllJobs();
    const stats = {
      total: jobs.length,
      pending: 0,
      processing: 0,
      completed: 0,
      failed: 0,
      oldestJob: undefined as Date | undefined,
      newestJob: undefined as Date | undefined
    };

    jobs.forEach(job => {
      stats[job.status]++;
      
      if (!stats.oldestJob || job.startedAt < stats.oldestJob) {
        stats.oldestJob = job.startedAt;
      }
      if (!stats.newestJob || job.startedAt > stats.newestJob) {
        stats.newestJob = job.startedAt;
      }
    });

    return stats;
  }
}

// Export singleton instance
export const jobManager = new JobManager();
