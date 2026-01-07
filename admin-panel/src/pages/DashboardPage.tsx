import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  FileText,
  Clock,
  CheckCircle,
  AlertTriangle,
  TrendingUp,
  MapPin,
} from 'lucide-react';
import { MapContainer, TileLayer, CircleMarker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { dashboardApi } from '../api/admin';
import Card, { CardHeader, CardTitle, CardContent } from '../components/ui/Card';
import { StatusBadge, SeverityBadge } from '../components/ui/Badge';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import type { DashboardStats, Report } from '../types';

// Status colors for markers
const STATUS_COLORS: Record<string, string> = {
  open: '#EF4444',
  assigned: '#F59E0B',
  in_progress: '#F59E0B',
  verified: '#8B5CF6',
  resolved: '#10B981',
};

interface StatCardProps {
  title: string;
  value: number | string;
  icon: React.ReactNode;
  trend?: number;
  color: string;
}

function StatCard({ title, value, icon, trend, color }: StatCardProps) {
  return (
    <Card className="relative overflow-hidden">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-gray-500">{title}</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
          {trend !== undefined && (
            <div className="flex items-center mt-2">
              <TrendingUp className={`w-4 h-4 ${trend >= 0 ? 'text-primary' : 'text-danger'}`} />
              <span className={`text-sm ml-1 ${trend >= 0 ? 'text-primary' : 'text-danger'}`}>
                {trend >= 0 ? '+' : ''}{trend}%
              </span>
              <span className="text-xs text-gray-400 ml-1">vs last week</span>
            </div>
          )}
        </div>
        <div className={`p-3 rounded-xl ${color}`}>
          {icon}
        </div>
      </div>
    </Card>
  );
}

export default function DashboardPage() {
  const [mapCenter, setMapCenter] = useState<[number, number]>([19.076, 72.8777]);

  // Fetch dashboard stats
  const { data: stats, isLoading: statsLoading } = useQuery<DashboardStats>({
    queryKey: ['dashboardStats'],
    queryFn: dashboardApi.getStats,
    refetchInterval: 60000,
  });

  // Fetch recent reports for map
  const { data: recentReports, isLoading: reportsLoading } = useQuery<Report[]>({
    queryKey: ['recentReports'],
    queryFn: () => dashboardApi.getRecentReports(100),
    refetchInterval: 60000,
  });

  // Update map center based on reports
  useEffect(() => {
    if (recentReports && recentReports.length > 0) {
      const avgLat = recentReports.reduce((sum, r) => sum + r.location.lat, 0) / recentReports.length;
      const avgLng = recentReports.reduce((sum, r) => sum + r.location.lng, 0) / recentReports.length;
      setMapCenter([avgLat, avgLng]);
    }
  }, [recentReports]);

  if (statsLoading) {
    return <LoadingSpinner fullScreen message="Loading dashboard..." />;
  }

  const formatTime = (hours: number) => {
    if (hours < 1) return `${Math.round(hours * 60)}m`;
    if (hours < 24) return `${hours.toFixed(1)}h`;
    return `${(hours / 24).toFixed(1)}d`;
  };

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-500 mt-1">Overview of waste management activities</p>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Reports"
          value={stats?.totalReports || 0}
          icon={<FileText className="w-6 h-6 text-white" />}
          color="bg-secondary"
        />
        <StatCard
          title="Open Reports"
          value={stats?.openReports || 0}
          icon={<AlertTriangle className="w-6 h-6 text-white" />}
          color="bg-danger"
        />
        <StatCard
          title="Resolved Today"
          value={stats?.resolvedToday || 0}
          icon={<CheckCircle className="w-6 h-6 text-white" />}
          color="bg-primary"
        />
        <StatCard
          title="Avg Resolution Time"
          value={formatTime(stats?.avgResolutionTime || 0)}
          icon={<Clock className="w-6 h-6 text-white" />}
          color="bg-warning"
        />
      </div>

      {/* Map and recent reports */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Map - Using FREE OpenStreetMap */}
        <Card padding="none" className="lg:col-span-2 overflow-hidden">
          <div className="p-4 border-b border-gray-100">
            <h3 className="font-semibold text-gray-900">Live Report Map</h3>
            <p className="text-sm text-gray-500 mt-1">Real-time waste report locations</p>
          </div>
          <div className="h-96 w-full">
            <MapContainer
              center={mapCenter}
              zoom={12}
              style={{ height: '100%', width: '100%' }}
              scrollWheelZoom={true}
            >
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              {recentReports?.map((report) => (
                <CircleMarker
                  key={report.id}
                  center={[report.location.lat, report.location.lng]}
                  radius={10}
                  fillColor={STATUS_COLORS[report.status] || '#EF4444'}
                  fillOpacity={0.9}
                  color="#ffffff"
                  weight={2}
                >
                  <Popup>
                    <div className="p-1">
                      <p className="font-semibold">Report #{report.id.slice(0, 8)}</p>
                      <p className="text-sm text-gray-600">Status: {report.status.replace('_', ' ')}</p>
                      <p className="text-sm text-gray-600">Severity: {report.severity}</p>
                    </div>
                  </Popup>
                </CircleMarker>
              ))}
            </MapContainer>
          </div>
          {/* Legend */}
          <div className="p-4 border-t border-gray-100 flex flex-wrap gap-4">
            {Object.entries(STATUS_COLORS).slice(0, 4).map(([status, color]) => (
              <div key={status} className="flex items-center">
                <div
                  className="w-3 h-3 rounded-full mr-2"
                  style={{ backgroundColor: color }}
                />
                <span className="text-xs text-gray-600 capitalize">
                  {status.replace('_', ' ')}
                </span>
              </div>
            ))}
          </div>
        </Card>

        {/* Recent reports */}
        <Card padding="none">
          <div className="p-4 border-b border-gray-100">
            <h3 className="font-semibold text-gray-900">Recent Reports</h3>
            <p className="text-sm text-gray-500 mt-1">Latest waste complaints</p>
          </div>
          <div className="divide-y divide-gray-100 max-h-96 overflow-y-auto">
            {reportsLoading ? (
              <div className="p-8 flex justify-center">
                <LoadingSpinner />
              </div>
            ) : recentReports?.slice(0, 10).map((report) => (
              <div key={report.id} className="p-4 hover:bg-gray-50 transition-colors">
                <div className="flex items-start justify-between">
                  <div className="flex items-start">
                    <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center mr-3">
                      <MapPin className="w-5 h-5 text-gray-400" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        #{report.id.slice(0, 8)}
                      </p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {new Date(report.createdAt).toLocaleString()}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <StatusBadge status={report.status} />
                    <SeverityBadge severity={report.severity} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Area breakdown and top contributors */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Area breakdown */}
        <Card>
          <CardHeader>
            <CardTitle>Area-wise Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {stats?.areaWiseBreakdown?.slice(0, 5).map((area) => (
                <div key={area.areaName}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-gray-700">{area.areaName}</span>
                    <span className="text-sm text-gray-500">
                      {area.totalReports} reports ({area.resolvedPercentage}% resolved)
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-primary h-2 rounded-full transition-all duration-300"
                      style={{ width: `${area.resolvedPercentage}%` }}
                    />
                  </div>
                </div>
              ))}
              {(!stats?.areaWiseBreakdown || stats.areaWiseBreakdown.length === 0) && (
                <p className="text-sm text-gray-500 text-center py-4">No data available</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Top contributors */}
        <Card>
          <CardHeader>
            <CardTitle>Top Contributors</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {stats?.topContributors?.slice(0, 5).map((contributor, index) => (
                <div
                  key={contributor.deviceId}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                >
                  <div className="flex items-center">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-sm ${
                      index === 0 ? 'bg-yellow-500' :
                      index === 1 ? 'bg-gray-400' :
                      index === 2 ? 'bg-amber-600' : 'bg-gray-300'
                    }`}>
                      {index + 1}
                    </div>
                    <div className="ml-3">
                      <p className="text-sm font-medium text-gray-900">
                        Citizen #{contributor.deviceId.slice(0, 8)}
                      </p>
                      <p className="text-xs text-gray-500">
                        {contributor.reportsCount} reports
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold text-primary">{contributor.points}</p>
                    <p className="text-xs text-gray-500">points</p>
                  </div>
                </div>
              ))}
              {(!stats?.topContributors || stats.topContributors.length === 0) && (
                <p className="text-sm text-gray-500 text-center py-4">No contributors yet</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
