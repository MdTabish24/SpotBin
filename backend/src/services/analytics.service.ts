/**
 * Analytics Service - Generate reports and analytics data
 * Requirements: 12.1, 12.2, 12.3, 12.4, 12.5
 * Property 33: Analytics data completeness
 */

import pool from '../db/pool';
import redis from '../config/redis';
import { logger } from '../config/logger';
import { ReportStatus, Severity, MonthlyReport } from '../types';

// ============================================
// Analytics Types
// ============================================

export interface AnalyticsDateRange {
  startDate: Date;
  endDate: Date;
}

export interface DailyReportData {
  date: string;
  count: number;
}

export interface AreaWiseData {
  area: string;
  count: number;
}

export interface WasteTypeData {
  type: string;
  percentage: number;
  count: number;
}

export interface AnalyticsSummary {
  totalReports: number;
  resolvedReports: number;
  avgResolutionTime: number;
  citizenParticipation: number;
  wasteCollected: number;
}

export interface AnalyticsTrends {
  reportsTrend: number;
  resolutionTrend: number;
  participationTrend: number;
}

export interface AnalyticsCharts {
  dailyReports: DailyReportData[];
  areaWise: AreaWiseData[];
  wasteTypes: WasteTypeData[];
}

export interface AnalyticsReport {
  period: AnalyticsDateRange;
  summary: AnalyticsSummary;
  trends: AnalyticsTrends;
  charts: AnalyticsCharts;
  generatedAt: Date;
}

// ============================================
// Analytics Service Interface
// ============================================

export interface IAnalyticsService {
  generateReport(startDate: Date, endDate: Date): Promise<AnalyticsReport>;
  getSummary(startDate: Date, endDate: Date): Promise<AnalyticsSummary>;
  getTrends(startDate: Date, endDate: Date): Promise<AnalyticsTrends>;
  getDailyReports(startDate: Date, endDate: Date): Promise<DailyReportData[]>;
  getAreaWiseBreakdown(startDate: Date, endDate: Date): Promise<AreaWiseData[]>;
  getWasteTypeDistribution(startDate: Date, endDate: Date): Promise<WasteTypeData[]>;
  calculateTrendPercentage(current: number, previous: number): number;
  exportToPDF(report: AnalyticsReport): Promise<Buffer>;
  exportToExcel(report: AnalyticsReport): Promise<Buffer>;
}

// ============================================
// Analytics Service Implementation
// ============================================

class AnalyticsService implements IAnalyticsService {
  private readonly CACHE_TTL = 300; // 5 minutes cache
  private readonly CACHE_KEY_PREFIX = 'analytics';
  private readonly ESTIMATED_WASTE_PER_REPORT_KG = 5; // Estimated 5kg per report

  /**
   * Generate complete analytics report for a date range
   * Property 33: Analytics data completeness
   * - Summary SHALL include: totalReports, resolvedReports, avgResolutionTime, citizenParticipation, wasteCollected
   * - Trends SHALL include percentage changes from previous period
   * - Charts data SHALL include: dailyReports, areaWise breakdown, wasteTypes distribution
   */
  async generateReport(startDate: Date, endDate: Date): Promise<AnalyticsReport> {
    const cacheKey = `${this.CACHE_KEY_PREFIX}:report:${startDate.toISOString()}:${endDate.toISOString()}`;

    // Try cache first
    try {
      const cached = await redis.get(cacheKey);
      if (cached) {
        logger.debug({ cacheKey }, 'Analytics report cache hit');
        const parsed = JSON.parse(cached);
        // Restore Date objects
        parsed.period.startDate = new Date(parsed.period.startDate);
        parsed.period.endDate = new Date(parsed.period.endDate);
        parsed.generatedAt = new Date(parsed.generatedAt);
        return parsed;
      }
    } catch (error) {
      logger.warn({ error }, 'Redis cache read failed for analytics report');
    }

    // Generate report in parallel
    const [summary, trends, dailyReports, areaWise, wasteTypes] = await Promise.all([
      this.getSummary(startDate, endDate),
      this.getTrends(startDate, endDate),
      this.getDailyReports(startDate, endDate),
      this.getAreaWiseBreakdown(startDate, endDate),
      this.getWasteTypeDistribution(startDate, endDate)
    ]);

    const report: AnalyticsReport = {
      period: { startDate, endDate },
      summary,
      trends,
      charts: {
        dailyReports,
        areaWise,
        wasteTypes
      },
      generatedAt: new Date()
    };

    // Cache the result
    try {
      await redis.setex(cacheKey, this.CACHE_TTL, JSON.stringify(report));
    } catch (error) {
      logger.warn({ error }, 'Redis cache write failed for analytics report');
    }

    logger.info({ 
      startDate, 
      endDate, 
      totalReports: summary.totalReports 
    }, 'Analytics report generated');

    return report;
  }

  /**
   * Get summary statistics for a date range
   * Requirements: 12.2
   */
  async getSummary(startDate: Date, endDate: Date): Promise<AnalyticsSummary> {
    // Get total reports
    const totalResult = await pool.query(
      `SELECT COUNT(*) as count FROM reports 
       WHERE created_at >= $1 AND created_at <= $2`,
      [startDate, endDate]
    );
    const totalReports = parseInt(totalResult.rows[0].count, 10);

    // Get resolved reports
    const resolvedResult = await pool.query(
      `SELECT COUNT(*) as count FROM reports 
       WHERE created_at >= $1 AND created_at <= $2 
       AND status = $3`,
      [startDate, endDate, ReportStatus.RESOLVED]
    );
    const resolvedReports = parseInt(resolvedResult.rows[0].count, 10);

    // Get average resolution time in hours
    const avgTimeResult = await pool.query(
      `SELECT AVG(EXTRACT(EPOCH FROM (resolved_at - created_at)) / 3600) as avg_hours
       FROM reports 
       WHERE created_at >= $1 AND created_at <= $2 
       AND status = $3 AND resolved_at IS NOT NULL`,
      [startDate, endDate, ReportStatus.RESOLVED]
    );
    const avgResolutionTime = avgTimeResult.rows[0].avg_hours 
      ? Math.round(parseFloat(avgTimeResult.rows[0].avg_hours) * 100) / 100 
      : 0;

    // Get unique citizen participation (unique device IDs)
    const participationResult = await pool.query(
      `SELECT COUNT(DISTINCT device_id) as count FROM reports 
       WHERE created_at >= $1 AND created_at <= $2`,
      [startDate, endDate]
    );
    const citizenParticipation = parseInt(participationResult.rows[0].count, 10);

    // Estimate waste collected (resolved reports * estimated kg per report)
    const wasteCollected = resolvedReports * this.ESTIMATED_WASTE_PER_REPORT_KG;

    return {
      totalReports,
      resolvedReports,
      avgResolutionTime,
      citizenParticipation,
      wasteCollected
    };
  }

  /**
   * Calculate trends compared to previous period
   * Requirements: 12.3
   */
  async getTrends(startDate: Date, endDate: Date): Promise<AnalyticsTrends> {
    // Calculate previous period (same duration before startDate)
    const periodDuration = endDate.getTime() - startDate.getTime();
    const prevEndDate = new Date(startDate.getTime() - 1); // Day before start
    const prevStartDate = new Date(prevEndDate.getTime() - periodDuration);

    // Get current period stats
    const currentSummary = await this.getSummary(startDate, endDate);

    // Get previous period stats
    const prevSummary = await this.getSummary(prevStartDate, prevEndDate);

    return {
      reportsTrend: this.calculateTrendPercentage(
        currentSummary.totalReports, 
        prevSummary.totalReports
      ),
      resolutionTrend: this.calculateTrendPercentage(
        currentSummary.resolvedReports, 
        prevSummary.resolvedReports
      ),
      participationTrend: this.calculateTrendPercentage(
        currentSummary.citizenParticipation, 
        prevSummary.citizenParticipation
      )
    };
  }

  /**
   * Calculate percentage change between two values
   */
  calculateTrendPercentage(current: number, previous: number): number {
    if (previous === 0) {
      return current > 0 ? 100 : 0;
    }
    const change = ((current - previous) / previous) * 100;
    return Math.round(change * 100) / 100; // Round to 2 decimal places
  }

  /**
   * Get daily report counts for chart
   * Requirements: 12.4
   */
  async getDailyReports(startDate: Date, endDate: Date): Promise<DailyReportData[]> {
    const result = await pool.query(
      `SELECT DATE(created_at) as date, COUNT(*) as count
       FROM reports
       WHERE created_at >= $1 AND created_at <= $2
       GROUP BY DATE(created_at)
       ORDER BY date ASC`,
      [startDate, endDate]
    );

    // Fill in missing dates with 0 counts
    const dailyData: DailyReportData[] = [];
    const currentDate = new Date(startDate);
    const endDateTime = endDate.getTime();

    while (currentDate.getTime() <= endDateTime) {
      const dateStr = currentDate.toISOString().split('T')[0];
      const found = result.rows.find(row => {
        const rowDate = new Date(row.date).toISOString().split('T')[0];
        return rowDate === dateStr;
      });

      dailyData.push({
        date: dateStr,
        count: found ? parseInt(found.count, 10) : 0
      });

      currentDate.setDate(currentDate.getDate() + 1);
    }

    return dailyData;
  }

  /**
   * Get area-wise breakdown for chart
   * Requirements: 12.4
   */
  async getAreaWiseBreakdown(startDate: Date, endDate: Date): Promise<AreaWiseData[]> {
    const result = await pool.query(
      `SELECT COALESCE(c.area, 'Unknown') as area, COUNT(r.id) as count
       FROM reports r
       LEFT JOIN citizens c ON r.device_id = c.device_id
       WHERE r.created_at >= $1 AND r.created_at <= $2
       GROUP BY COALESCE(c.area, 'Unknown')
       ORDER BY count DESC
       LIMIT 20`,
      [startDate, endDate]
    );

    return result.rows.map(row => ({
      area: row.area,
      count: parseInt(row.count, 10)
    }));
  }

  /**
   * Get waste type distribution for chart
   * Requirements: 12.4
   */
  async getWasteTypeDistribution(startDate: Date, endDate: Date): Promise<WasteTypeData[]> {
    // Get total count first
    const totalResult = await pool.query(
      `SELECT COUNT(*) as total FROM reports 
       WHERE created_at >= $1 AND created_at <= $2 
       AND waste_types IS NOT NULL`,
      [startDate, endDate]
    );
    const total = parseInt(totalResult.rows[0].total, 10);

    if (total === 0) {
      return [];
    }

    // Get waste type counts (unnest JSONB array)
    const result = await pool.query(
      `SELECT waste_type, COUNT(*) as count
       FROM reports, jsonb_array_elements_text(waste_types) as waste_type
       WHERE created_at >= $1 AND created_at <= $2
       GROUP BY waste_type
       ORDER BY count DESC
       LIMIT 10`,
      [startDate, endDate]
    );

    // Calculate total for percentage
    const typeTotal = result.rows.reduce((sum, row) => sum + parseInt(row.count, 10), 0);

    return result.rows.map(row => {
      const count = parseInt(row.count, 10);
      return {
        type: row.waste_type || 'Unknown',
        count,
        percentage: typeTotal > 0 ? Math.round((count / typeTotal) * 100) : 0
      };
    });
  }


  /**
   * Export analytics report to PDF
   * Requirements: 12.5
   */
  async exportToPDF(report: AnalyticsReport): Promise<Buffer> {
    const PDFDocument = require('pdfkit');
    
    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({ margin: 50 });
        const chunks: Buffer[] = [];

        doc.on('data', (chunk: Buffer) => chunks.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', reject);

        // Title
        doc.fontSize(24).font('Helvetica-Bold').text('CleanCity Analytics Report', { align: 'center' });
        doc.moveDown();

        // Period
        const startStr = report.period.startDate.toLocaleDateString();
        const endStr = report.period.endDate.toLocaleDateString();
        doc.fontSize(12).font('Helvetica').text(`Report Period: ${startStr} - ${endStr}`, { align: 'center' });
        doc.moveDown(2);

        // Summary Section
        doc.fontSize(16).font('Helvetica-Bold').text('Summary');
        doc.moveDown(0.5);
        doc.fontSize(11).font('Helvetica');
        
        const summaryItems = [
          { label: 'Total Reports', value: report.summary.totalReports.toString() },
          { label: 'Resolved Reports', value: report.summary.resolvedReports.toString() },
          { label: 'Average Resolution Time', value: `${report.summary.avgResolutionTime.toFixed(2)} hours` },
          { label: 'Citizen Participation', value: `${report.summary.citizenParticipation} unique citizens` },
          { label: 'Estimated Waste Collected', value: `${report.summary.wasteCollected} kg` }
        ];

        summaryItems.forEach(item => {
          doc.text(`• ${item.label}: ${item.value}`);
        });
        doc.moveDown(1.5);

        // Trends Section
        doc.fontSize(16).font('Helvetica-Bold').text('Trends (vs Previous Period)');
        doc.moveDown(0.5);
        doc.fontSize(11).font('Helvetica');

        const formatTrend = (value: number) => {
          const sign = value >= 0 ? '+' : '';
          return `${sign}${value.toFixed(2)}%`;
        };

        const trendItems = [
          { label: 'Reports Trend', value: formatTrend(report.trends.reportsTrend) },
          { label: 'Resolution Trend', value: formatTrend(report.trends.resolutionTrend) },
          { label: 'Participation Trend', value: formatTrend(report.trends.participationTrend) }
        ];

        trendItems.forEach(item => {
          doc.text(`• ${item.label}: ${item.value}`);
        });
        doc.moveDown(1.5);

        // Area-wise Breakdown
        if (report.charts.areaWise.length > 0) {
          doc.fontSize(16).font('Helvetica-Bold').text('Area-wise Breakdown');
          doc.moveDown(0.5);
          doc.fontSize(11).font('Helvetica');

          report.charts.areaWise.slice(0, 10).forEach(area => {
            doc.text(`• ${area.area}: ${area.count} reports`);
          });
          doc.moveDown(1.5);
        }

        // Waste Type Distribution
        if (report.charts.wasteTypes.length > 0) {
          doc.fontSize(16).font('Helvetica-Bold').text('Waste Type Distribution');
          doc.moveDown(0.5);
          doc.fontSize(11).font('Helvetica');

          report.charts.wasteTypes.forEach(type => {
            doc.text(`• ${type.type}: ${type.percentage}% (${type.count} reports)`);
          });
          doc.moveDown(1.5);
        }

        // Daily Reports Summary
        if (report.charts.dailyReports.length > 0) {
          doc.fontSize(16).font('Helvetica-Bold').text('Daily Reports Summary');
          doc.moveDown(0.5);
          doc.fontSize(11).font('Helvetica');

          const totalDays = report.charts.dailyReports.length;
          const totalReports = report.charts.dailyReports.reduce((sum, d) => sum + d.count, 0);
          const avgPerDay = totalDays > 0 ? (totalReports / totalDays).toFixed(2) : '0';
          const maxDay = report.charts.dailyReports.reduce((max, d) => d.count > max.count ? d : max, { date: '', count: 0 });
          const minDay = report.charts.dailyReports.reduce((min, d) => d.count < min.count ? d : min, { date: '', count: Infinity });

          doc.text(`• Total Days: ${totalDays}`);
          doc.text(`• Average Reports per Day: ${avgPerDay}`);
          if (maxDay.date) {
            doc.text(`• Peak Day: ${maxDay.date} (${maxDay.count} reports)`);
          }
          if (minDay.date && minDay.count !== Infinity) {
            doc.text(`• Lowest Day: ${minDay.date} (${minDay.count} reports)`);
          }
        }

        // Footer
        doc.moveDown(2);
        doc.fontSize(9).font('Helvetica').fillColor('gray');
        doc.text(`Generated on: ${report.generatedAt.toLocaleString()}`, { align: 'center' });
        doc.text('CleanCity - Smart Waste Management Platform', { align: 'center' });

        doc.end();
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Export analytics report to Excel
   * Requirements: 12.5
   */
  async exportToExcel(report: AnalyticsReport): Promise<Buffer> {
    const ExcelJS = require('exceljs');
    const workbook = new ExcelJS.Workbook();
    
    workbook.creator = 'CleanCity';
    workbook.created = new Date();

    // Summary Sheet
    const summarySheet = workbook.addWorksheet('Summary');
    summarySheet.columns = [
      { header: 'Metric', key: 'metric', width: 30 },
      { header: 'Value', key: 'value', width: 25 }
    ];

    // Style header row
    summarySheet.getRow(1).font = { bold: true };
    summarySheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF10B981' }
    };

    const startStr = report.period.startDate.toLocaleDateString();
    const endStr = report.period.endDate.toLocaleDateString();

    summarySheet.addRows([
      { metric: 'Report Period', value: `${startStr} - ${endStr}` },
      { metric: 'Total Reports', value: report.summary.totalReports },
      { metric: 'Resolved Reports', value: report.summary.resolvedReports },
      { metric: 'Resolution Rate', value: `${report.summary.totalReports > 0 ? ((report.summary.resolvedReports / report.summary.totalReports) * 100).toFixed(2) : 0}%` },
      { metric: 'Average Resolution Time (hours)', value: report.summary.avgResolutionTime.toFixed(2) },
      { metric: 'Citizen Participation', value: report.summary.citizenParticipation },
      { metric: 'Estimated Waste Collected (kg)', value: report.summary.wasteCollected },
      { metric: '', value: '' },
      { metric: 'TRENDS (vs Previous Period)', value: '' },
      { metric: 'Reports Trend', value: `${report.trends.reportsTrend >= 0 ? '+' : ''}${report.trends.reportsTrend.toFixed(2)}%` },
      { metric: 'Resolution Trend', value: `${report.trends.resolutionTrend >= 0 ? '+' : ''}${report.trends.resolutionTrend.toFixed(2)}%` },
      { metric: 'Participation Trend', value: `${report.trends.participationTrend >= 0 ? '+' : ''}${report.trends.participationTrend.toFixed(2)}%` }
    ]);

    // Daily Reports Sheet
    const dailySheet = workbook.addWorksheet('Daily Reports');
    dailySheet.columns = [
      { header: 'Date', key: 'date', width: 15 },
      { header: 'Report Count', key: 'count', width: 15 }
    ];
    dailySheet.getRow(1).font = { bold: true };
    dailySheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF3B82F6' }
    };
    dailySheet.addRows(report.charts.dailyReports);

    // Area-wise Sheet
    const areaSheet = workbook.addWorksheet('Area Breakdown');
    areaSheet.columns = [
      { header: 'Area', key: 'area', width: 25 },
      { header: 'Report Count', key: 'count', width: 15 }
    ];
    areaSheet.getRow(1).font = { bold: true };
    areaSheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFF59E0B' }
    };
    areaSheet.addRows(report.charts.areaWise);

    // Waste Types Sheet
    const wasteSheet = workbook.addWorksheet('Waste Types');
    wasteSheet.columns = [
      { header: 'Waste Type', key: 'type', width: 20 },
      { header: 'Count', key: 'count', width: 12 },
      { header: 'Percentage', key: 'percentage', width: 12 }
    ];
    wasteSheet.getRow(1).font = { bold: true };
    wasteSheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFEF4444' }
    };
    wasteSheet.addRows(report.charts.wasteTypes.map(wt => ({
      type: wt.type,
      count: wt.count,
      percentage: `${wt.percentage}%`
    })));

    // Generate buffer
    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }

  /**
   * Validate analytics report structure
   * Used for property testing
   */
  validateReportStructure(report: AnalyticsReport): boolean {
    // Check period
    if (!report.period || !report.period.startDate || !report.period.endDate) {
      return false;
    }

    // Check summary fields
    const summary = report.summary;
    if (
      typeof summary.totalReports !== 'number' ||
      typeof summary.resolvedReports !== 'number' ||
      typeof summary.avgResolutionTime !== 'number' ||
      typeof summary.citizenParticipation !== 'number' ||
      typeof summary.wasteCollected !== 'number'
    ) {
      return false;
    }

    // Check trends fields
    const trends = report.trends;
    if (
      typeof trends.reportsTrend !== 'number' ||
      typeof trends.resolutionTrend !== 'number' ||
      typeof trends.participationTrend !== 'number'
    ) {
      return false;
    }

    // Check charts fields
    const charts = report.charts;
    if (
      !Array.isArray(charts.dailyReports) ||
      !Array.isArray(charts.areaWise) ||
      !Array.isArray(charts.wasteTypes)
    ) {
      return false;
    }

    // Check generatedAt
    if (!report.generatedAt || !(report.generatedAt instanceof Date)) {
      return false;
    }

    return true;
  }

  /**
   * Validate summary structure
   */
  validateSummaryStructure(summary: AnalyticsSummary): boolean {
    return (
      typeof summary.totalReports === 'number' &&
      summary.totalReports >= 0 &&
      typeof summary.resolvedReports === 'number' &&
      summary.resolvedReports >= 0 &&
      typeof summary.avgResolutionTime === 'number' &&
      summary.avgResolutionTime >= 0 &&
      typeof summary.citizenParticipation === 'number' &&
      summary.citizenParticipation >= 0 &&
      typeof summary.wasteCollected === 'number' &&
      summary.wasteCollected >= 0
    );
  }

  /**
   * Validate trends structure
   */
  validateTrendsStructure(trends: AnalyticsTrends): boolean {
    return (
      typeof trends.reportsTrend === 'number' &&
      typeof trends.resolutionTrend === 'number' &&
      typeof trends.participationTrend === 'number'
    );
  }

  /**
   * Validate charts structure
   */
  validateChartsStructure(charts: AnalyticsCharts): boolean {
    // Check dailyReports
    if (!Array.isArray(charts.dailyReports)) return false;
    for (const item of charts.dailyReports) {
      if (typeof item.date !== 'string' || typeof item.count !== 'number') {
        return false;
      }
    }

    // Check areaWise
    if (!Array.isArray(charts.areaWise)) return false;
    for (const item of charts.areaWise) {
      if (typeof item.area !== 'string' || typeof item.count !== 'number') {
        return false;
      }
    }

    // Check wasteTypes
    if (!Array.isArray(charts.wasteTypes)) return false;
    for (const item of charts.wasteTypes) {
      if (
        typeof item.type !== 'string' ||
        typeof item.percentage !== 'number' ||
        typeof item.count !== 'number'
      ) {
        return false;
      }
    }

    return true;
  }
}

// Export singleton instance
export const analyticsService = new AnalyticsService();
export default analyticsService;
