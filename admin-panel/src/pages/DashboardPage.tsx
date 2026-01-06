import { useEffect, useState, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  FileText,
  Clock,
  CheckCircle,
  AlertTriangle,
  TrendingUp,
  MapPin,
} from 'lucide-react';
import { Loader } from '@googlemaps/js-api-loader';
import { dashboardApi } from '../api/admin';
import Card, { CardHeader, CardTitle, CardContent } from '../components/ui/Card';
import { StatusBadge, SeverityBadge } from '../components/ui/Badge';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import type { DashboardStats, Report } from '../types';

// Google Maps API Key (should be in env)
const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';

// Status colors for markers
const STATUS_COLORS: Record<string, string> = {
  open: '#EF4444',      // Red
  assigned: '#F59E0B',  // Yellow/Orange
  in_progress: '#F59E0B', // Yellow
  verified: '#8B5CF6',  // Purple
  resolved: '#10B981',  // Green
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
  const mapRef = useRef<HTMLDivElement>(null);
  const [map, setMap] = useState<google.maps.Map | null>(null);
  const [markers, setMarkers] = useState<google.maps.Marker[]>([]);

  // Fetch dashboard stats
  const { data: stats, isLoading: statsLoading } = useQuery<DashboardStats>({
    queryKey: ['dashboardStats'],
    queryFn: dashboardApi.getStats,
    refetchInterval: 60000, // Refresh every minute
  });

  // Fetch recent reports for map
  const { data: recentReports, isLoading: reportsLoading } = useQuery<Report[]>({
    queryKey: ['recentReports'],
    queryFn: () => dashboardApi.getRecentReports(100),
    refetchInterval: 60000,
  });

  // Initialize Google Maps
  useEffect(() => {
    if (!mapRef.current || map) return;

    const loader = new Loader({
      apiKey: GOOGLE_MAPS_API_KEY,
      version: 'weekly',
    });

    loader.load().then(() => {
      const newMap = new google.maps.Map(mapRef.current!, {
        center: { lat: 19.076, lng: 72.8777 }, // Mumbai default
        zoom: 12,
        styles: [
          {
            featureType: 'poi',
            elementType: 'labels',
            stylers: [{ visibility: 'off' }],
          },
        ],
      });
      setMap(newMap);
    }).catch(console.error);
  }, []);

  // Update markers when reports change
  useEffect(() => {
    if (!map || !recentReports) return;

    // Clear existing markers
    markers.forEach(marker => marker.setMap(null));

    // Create new markers
    const newMarkers = recentReports.map(report => {
      const marker = new google.maps.Marker({
        position: { lat: report.location.lat, lng: report.location.lng },
        map,
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          fillColor: STATUS_COLORS[report.status] || '#EF4444',
          fillOpacity: 0.9,
          strokeColor: '#ffffff',
          strokeWeight: 2,
          scale: 10,
        },
        title: `Report #${report.id.slice(0, 8)}`,
      });

      // Info window on click
      const infoWindow = new google.maps.InfoWindow({
        content: `
          <div style="padding: 8px; max-width: 200px;">
            <p style="font-weight: 600; margin-bottom: 4px;">Report #${report.id.slice(0, 8)}</p>
            <p style="font-size: 12px; color: #666; margin-bottom: 4px;">
              Status: ${report.status.replace('_', ' ')}
            </p>
            <p style="font-size: 12px; color: #666;">
              Severity: ${report.severity}
            </p>
          </div>
        `,
      });

      marker.addListener('click', () => {
        infoWindow.open(map, marker);
      });

      return marker;
    });

    setMarkers(newMarkers);

    // Fit bounds to show all markers
    if (newMarkers.length > 0) {
      const bounds = new google.maps.LatLngBounds();
      newMarkers.forEach(marker => {
        const pos = marker.getPosition();
        if (pos) bounds.extend(pos);
      });
      map.fitBounds(bounds);
    }
  }, [map, recentReports]);

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
        {/* Map */}
        <Card padding="none" className="lg:col-span-2 overflow-hidden">
          <div className="p-4 border-b border-gray-100">
            <h3 className="font-semibold text-gray-900">Live Report Map</h3>
            <p className="text-sm text-gray-500 mt-1">Real-time waste report locations</p>
          </div>
          <div ref={mapRef} className="h-96 w-full" />
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
