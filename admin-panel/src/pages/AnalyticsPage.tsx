import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import {
  Calendar,
  Download,
  FileText,
  TrendingUp,
  TrendingDown,
  Users,
  Clock,
  Trash2,
} from 'lucide-react';
import { format, subDays, startOfMonth, endOfMonth } from 'date-fns';
import { analyticsApi } from '../api/admin';
import Card, { CardHeader, CardTitle, CardContent } from '../components/ui/Card';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import type { AnalyticsReport } from '../types';

const COLORS = ['#10B981', '#3B82F6', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899'];

export default function AnalyticsPage() {
  const [startDate, setStartDate] = useState(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(endOfMonth(new Date()), 'yyyy-MM-dd'));
  const [isExporting, setIsExporting] = useState(false);

  // Fetch analytics data
  const { data: analytics, isLoading, error, refetch } = useQuery<AnalyticsReport>({
    queryKey: ['analytics', startDate, endDate],
    queryFn: () => analyticsApi.getReport(startDate, endDate),
    enabled: !!startDate && !!endDate,
  });

  const handleExportPdf = async () => {
    setIsExporting(true);
    try {
      const blob = await analyticsApi.exportPdf(startDate, endDate);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `cleancity-report-${startDate}-to-${endDate}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      console.error('Export failed:', err);
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportExcel = async () => {
    setIsExporting(true);
    try {
      const blob = await analyticsApi.exportExcel(startDate, endDate);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `cleancity-report-${startDate}-to-${endDate}.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      console.error('Export failed:', err);
    } finally {
      setIsExporting(false);
    }
  };

  const setQuickRange = (days: number) => {
    const end = new Date();
    const start = subDays(end, days);
    setStartDate(format(start, 'yyyy-MM-dd'));
    setEndDate(format(end, 'yyyy-MM-dd'));
  };

  const TrendIndicator = ({ value, label }: { value: number; label: string }) => {
    const isPositive = value >= 0;
    return (
      <div className="flex items-center">
        {isPositive ? (
          <TrendingUp className="w-4 h-4 text-primary mr-1" />
        ) : (
          <TrendingDown className="w-4 h-4 text-danger mr-1" />
        )}
        <span className={`text-sm font-medium ${isPositive ? 'text-primary' : 'text-danger'}`}>
          {isPositive ? '+' : ''}{value.toFixed(1)}%
        </span>
        <span className="text-xs text-gray-500 ml-1">{label}</span>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Analytics</h1>
          <p className="text-gray-500 mt-1">Insights and reports for waste management</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            leftIcon={<FileText className="w-4 h-4" />}
            onClick={handleExportPdf}
            disabled={isExporting || !analytics}
          >
            Export PDF
          </Button>
          <Button
            variant="outline"
            leftIcon={<Download className="w-4 h-4" />}
            onClick={handleExportExcel}
            disabled={isExporting || !analytics}
          >
            Export Excel
          </Button>
        </div>
      </div>

      {/* Date range selector */}
      <Card>
        <div className="flex flex-col md:flex-row md:items-end gap-4">
          <div className="flex-1 grid grid-cols-2 gap-4">
            <Input
              label="Start Date"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
            <Input
              label="End Date"
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={() => setQuickRange(7)}>
              Last 7 days
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setQuickRange(30)}>
              Last 30 days
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setQuickRange(90)}>
              Last 90 days
            </Button>
          </div>
        </div>
      </Card>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <LoadingSpinner message="Loading analytics..." />
        </div>
      ) : error ? (
        <div className="text-center py-12 text-danger">
          Failed to load analytics. Please try again.
        </div>
      ) : analytics ? (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            <Card>
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-gray-500">Total Reports</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">
                    {analytics.summary.totalReports}
                  </p>
                  <TrendIndicator value={analytics.trends.reportsTrend} label="vs prev" />
                </div>
                <div className="p-2 bg-secondary-100 rounded-lg">
                  <FileText className="w-5 h-5 text-secondary" />
                </div>
              </div>
            </Card>

            <Card>
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-gray-500">Resolved</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">
                    {analytics.summary.resolvedReports}
                  </p>
                  <TrendIndicator value={analytics.trends.resolutionTrend} label="vs prev" />
                </div>
                <div className="p-2 bg-primary-100 rounded-lg">
                  <TrendingUp className="w-5 h-5 text-primary" />
                </div>
              </div>
            </Card>

            <Card>
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-gray-500">Avg Resolution</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">
                    {analytics.summary.avgResolutionTime.toFixed(1)}h
                  </p>
                </div>
                <div className="p-2 bg-warning-100 rounded-lg">
                  <Clock className="w-5 h-5 text-warning" />
                </div>
              </div>
            </Card>

            <Card>
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-gray-500">Participation</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">
                    {analytics.summary.citizenParticipation}
                  </p>
                  <TrendIndicator value={analytics.trends.participationTrend} label="vs prev" />
                </div>
                <div className="p-2 bg-purple-100 rounded-lg">
                  <Users className="w-5 h-5 text-purple-600" />
                </div>
              </div>
            </Card>

            <Card>
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-gray-500">Waste Collected</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">
                    {analytics.summary.wasteCollected}kg
                  </p>
                </div>
                <div className="p-2 bg-danger-100 rounded-lg">
                  <Trash2 className="w-5 h-5 text-danger" />
                </div>
              </div>
            </Card>
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Daily reports chart */}
            <Card>
              <CardHeader>
                <CardTitle>Daily Reports</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={analytics.charts.dailyReports}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                      <XAxis
                        dataKey="date"
                        tick={{ fontSize: 12 }}
                        tickFormatter={(value) => format(new Date(value), 'MMM d')}
                      />
                      <YAxis tick={{ fontSize: 12 }} />
                      <Tooltip
                        labelFormatter={(value) => format(new Date(value), 'MMM d, yyyy')}
                        contentStyle={{
                          backgroundColor: 'white',
                          border: '1px solid #E5E7EB',
                          borderRadius: '8px',
                        }}
                      />
                      <Line
                        type="monotone"
                        dataKey="count"
                        stroke="#10B981"
                        strokeWidth={2}
                        dot={{ fill: '#10B981', strokeWidth: 2 }}
                        activeDot={{ r: 6 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Area-wise breakdown */}
            <Card>
              <CardHeader>
                <CardTitle>Area-wise Breakdown</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={analytics.charts.areaWise} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                      <XAxis type="number" tick={{ fontSize: 12 }} />
                      <YAxis
                        type="category"
                        dataKey="area"
                        tick={{ fontSize: 12 }}
                        width={100}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: 'white',
                          border: '1px solid #E5E7EB',
                          borderRadius: '8px',
                        }}
                      />
                      <Bar dataKey="count" fill="#3B82F6" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Waste types distribution */}
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Waste Type Distribution</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col lg:flex-row items-center gap-8">
                  <div className="h-64 w-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={analytics.charts.wasteTypes}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={100}
                          paddingAngle={2}
                          dataKey="percentage"
                          nameKey="type"
                        >
                          {analytics.charts.wasteTypes.map((_, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip
                          formatter={(value: number) => `${value.toFixed(1)}%`}
                          contentStyle={{
                            backgroundColor: 'white',
                            border: '1px solid #E5E7EB',
                            borderRadius: '8px',
                          }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="flex-1 grid grid-cols-2 md:grid-cols-3 gap-4">
                    {analytics.charts.wasteTypes.map((item, index) => (
                      <div key={item.type} className="flex items-center">
                        <div
                          className="w-4 h-4 rounded-full mr-2"
                          style={{ backgroundColor: COLORS[index % COLORS.length] }}
                        />
                        <div>
                          <p className="text-sm font-medium text-gray-900">{item.type}</p>
                          <p className="text-xs text-gray-500">{item.percentage.toFixed(1)}%</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Resolution rate */}
          <Card>
            <CardHeader>
              <CardTitle>Resolution Rate</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-gray-600">
                      {analytics.summary.resolvedReports} of {analytics.summary.totalReports} reports resolved
                    </span>
                    <span className="text-sm font-semibold text-primary">
                      {((analytics.summary.resolvedReports / analytics.summary.totalReports) * 100).toFixed(1)}%
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-3">
                    <div
                      className="bg-primary h-3 rounded-full transition-all duration-500"
                      style={{
                        width: `${(analytics.summary.resolvedReports / analytics.summary.totalReports) * 100}%`,
                      }}
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      ) : null}
    </div>
  );
}
