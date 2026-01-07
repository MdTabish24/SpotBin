import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Filter,
  ChevronLeft,
  ChevronRight,
  Eye,
  CheckCircle,
  XCircle,
  X,
  MapPin,
  Calendar,
  User,
} from 'lucide-react';
import { reportsApi } from '../api/admin';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Select from '../components/ui/Select';
import { StatusBadge, SeverityBadge } from '../components/ui/Badge';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import type { Report, ReportFilters } from '../types';

const STATUS_OPTIONS = [
  { value: '', label: 'All Status' },
  { value: 'open', label: 'Open' },
  { value: 'assigned', label: 'Assigned' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'verified', label: 'Verified' },
  { value: 'resolved', label: 'Resolved' },
];

const SEVERITY_OPTIONS = [
  { value: '', label: 'All Severity' },
  { value: 'high', label: 'High' },
  { value: 'medium', label: 'Medium' },
  { value: 'low', label: 'Low' },
];

export default function ReportsPage() {
  const queryClient = useQueryClient();
  const [filters, setFilters] = useState<ReportFilters>({
    page: 1,
    limit: 10,
  });
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);
  const [showFilters, setShowFilters] = useState(false);

  // Fetch reports
  const { data, isLoading, error } = useQuery({
    queryKey: ['reports', filters],
    queryFn: () => reportsApi.getReports(filters),
  });

  // Approve mutation
  const approveMutation = useMutation({
    mutationFn: (reportId: string) => reportsApi.approveVerification(reportId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reports'] });
      setSelectedReport(null);
    },
  });

  // Reject mutation
  const rejectMutation = useMutation({
    mutationFn: (reportId: string) => reportsApi.rejectVerification(reportId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reports'] });
      setSelectedReport(null);
    },
  });

  const handleFilterChange = (key: keyof ReportFilters, value: string) => {
    setFilters(prev => ({
      ...prev,
      [key]: value || undefined,
      page: 1, // Reset to first page on filter change
    }));
  };

  const handlePageChange = (newPage: number) => {
    setFilters(prev => ({ ...prev, page: newPage }));
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Reports</h1>
          <p className="text-gray-500 mt-1">Manage waste reports and verifications</p>
        </div>
        <Button
          variant="outline"
          leftIcon={<Filter className="w-4 h-4" />}
          onClick={() => setShowFilters(!showFilters)}
        >
          Filters
        </Button>
      </div>

      {/* Filters */}
      {showFilters && (
        <Card>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Select
              label="Status"
              options={STATUS_OPTIONS}
              value={filters.status || ''}
              onChange={(e) => handleFilterChange('status', e.target.value)}
            />
            <Select
              label="Severity"
              options={SEVERITY_OPTIONS}
              value={filters.severity || ''}
              onChange={(e) => handleFilterChange('severity', e.target.value)}
            />
            <Input
              label="Start Date"
              type="date"
              value={filters.startDate || ''}
              onChange={(e) => handleFilterChange('startDate', e.target.value)}
            />
            <Input
              label="End Date"
              type="date"
              value={filters.endDate || ''}
              onChange={(e) => handleFilterChange('endDate', e.target.value)}
            />
          </div>
        </Card>
      )}

      {/* Reports table */}
      <Card padding="none">
        {isLoading ? (
          <div className="p-8 flex justify-center">
            <LoadingSpinner message="Loading reports..." />
          </div>
        ) : error ? (
          <div className="p-8 text-center text-danger">
            Failed to load reports. Please try again.
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Report
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Severity
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Location
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Created
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {data?.reports?.map((report) => (
                    <tr key={report.id} className="hover:bg-gray-50">
                      <td className="px-4 py-4">
                        <div className="flex items-center">
                          <img
                            src={report.photoUrl?.startsWith('http') ? report.photoUrl : `http://localhost:3000${report.photoUrl}`}
                            alt="Report"
                            className="w-12 h-12 rounded-lg object-cover"
                            onError={(e) => {
                              (e.target as HTMLImageElement).src = 'https://via.placeholder.com/48?text=No+Image';
                            }}
                          />
                          <div className="ml-3">
                            <p className="text-sm font-medium text-gray-900">
                              #{report.id.slice(0, 8)}
                            </p>
                            <p className="text-xs text-gray-500">
                              {report.description || 'No description'}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <StatusBadge status={report.status} />
                      </td>
                      <td className="px-4 py-4">
                        <SeverityBadge severity={report.severity} />
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex items-center text-sm text-gray-500">
                          <MapPin className="w-4 h-4 mr-1" />
                          {report.location.lat.toFixed(4)}, {report.location.lng.toFixed(4)}
                        </div>
                      </td>
                      <td className="px-4 py-4 text-sm text-gray-500">
                        {formatDate(report.createdAt)}
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setSelectedReport(report)}
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                          {report.status === 'verified' && (
                            <>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-primary hover:text-primary-600"
                                onClick={() => approveMutation.mutate(report.id)}
                                disabled={approveMutation.isPending}
                              >
                                <CheckCircle className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-danger hover:text-danger-600"
                                onClick={() => rejectMutation.mutate(report.id)}
                                disabled={rejectMutation.isPending}
                              >
                                <XCircle className="w-4 h-4" />
                              </Button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {data && data.totalPages > 1 && (
              <div className="px-4 py-3 border-t border-gray-200 flex items-center justify-between">
                <p className="text-sm text-gray-500">
                  Showing {((data.page - 1) * data.limit) + 1} to {Math.min(data.page * data.limit, data.total)} of {data.total} results
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handlePageChange(data.page - 1)}
                    disabled={data.page === 1}
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  <span className="text-sm text-gray-700">
                    Page {data.page} of {data.totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handlePageChange(data.page + 1)}
                    disabled={data.page === data.totalPages}
                  >
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </Card>

      {/* Report detail modal */}
      {selectedReport && (
        <ReportDetailModal
          report={selectedReport}
          onClose={() => setSelectedReport(null)}
          onApprove={() => approveMutation.mutate(selectedReport.id)}
          onReject={() => rejectMutation.mutate(selectedReport.id)}
          isApproving={approveMutation.isPending}
          isRejecting={rejectMutation.isPending}
        />
      )}
    </div>
  );
}

interface ReportDetailModalProps {
  report: Report;
  onClose: () => void;
  onApprove: () => void;
  onReject: () => void;
  isApproving: boolean;
  isRejecting: boolean;
}

function ReportDetailModal({
  report,
  onClose,
  onApprove,
  onReject,
  isApproving,
  isRejecting,
}: ReportDetailModalProps) {
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">
            Report #{report.id.slice(0, 8)}
          </h2>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Photo */}
          <div>
            <h3 className="text-sm font-medium text-gray-700 mb-2">Report Photo</h3>
            <img
              src={report.photoUrl?.startsWith('http') ? report.photoUrl : `http://localhost:3000${report.photoUrl}`}
              alt="Report"
              className="w-full h-64 object-cover rounded-xl"
              onError={(e) => {
                (e.target as HTMLImageElement).src = 'https://via.placeholder.com/400x256?text=No+Image';
              }}
            />
          </div>

          {/* Status and severity */}
          <div className="flex items-center gap-4">
            <div>
              <span className="text-sm text-gray-500">Status:</span>
              <div className="mt-1">
                <StatusBadge status={report.status} />
              </div>
            </div>
            <div>
              <span className="text-sm text-gray-500">Severity:</span>
              <div className="mt-1">
                <SeverityBadge severity={report.severity} />
              </div>
            </div>
          </div>

          {/* Details */}
          <div className="grid grid-cols-2 gap-4">
            <div className="flex items-start">
              <MapPin className="w-5 h-5 text-gray-400 mr-2 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-gray-700">Location</p>
                <p className="text-sm text-gray-500">
                  {report.location.lat.toFixed(6)}, {report.location.lng.toFixed(6)}
                </p>
              </div>
            </div>
            <div className="flex items-start">
              <Calendar className="w-5 h-5 text-gray-400 mr-2 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-gray-700">Created</p>
                <p className="text-sm text-gray-500">{formatDate(report.createdAt)}</p>
              </div>
            </div>
            <div className="flex items-start">
              <User className="w-5 h-5 text-gray-400 mr-2 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-gray-700">Citizen</p>
                <p className="text-sm text-gray-500">#{report.deviceId.slice(0, 8)}</p>
              </div>
            </div>
            {report.workerName && (
              <div className="flex items-start">
                <User className="w-5 h-5 text-gray-400 mr-2 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-gray-700">Assigned Worker</p>
                  <p className="text-sm text-gray-500">{report.workerName}</p>
                </div>
              </div>
            )}
          </div>

          {/* Description */}
          {report.description && (
            <div>
              <h3 className="text-sm font-medium text-gray-700 mb-1">Description</h3>
              <p className="text-sm text-gray-600">{report.description}</p>
            </div>
          )}

          {/* Waste types */}
          {report.wasteTypes && report.wasteTypes.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-gray-700 mb-2">Waste Types</h3>
              <div className="flex flex-wrap gap-2">
                {report.wasteTypes.map((type) => (
                  <span
                    key={type}
                    className="px-3 py-1 bg-gray-100 text-gray-700 text-sm rounded-full"
                  >
                    {type}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Verification photos */}
          {report.verification && (
            <div>
              <h3 className="text-sm font-medium text-gray-700 mb-2">Verification Photos</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-gray-500 mb-1">Before</p>
                  <img
                    src={report.verification.beforePhotoUrl}
                    alt="Before"
                    className="w-full h-40 object-cover rounded-lg"
                  />
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">After</p>
                  <img
                    src={report.verification.afterPhotoUrl}
                    alt="After"
                    className="w-full h-40 object-cover rounded-lg"
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        {report.status === 'verified' && (
          <div className="sticky bottom-0 bg-white border-t border-gray-200 px-6 py-4 flex justify-end gap-3">
            <Button
              variant="outline"
              onClick={onReject}
              isLoading={isRejecting}
              leftIcon={<XCircle className="w-4 h-4" />}
            >
              Reject
            </Button>
            <Button
              variant="primary"
              onClick={onApprove}
              isLoading={isApproving}
              leftIcon={<CheckCircle className="w-4 h-4" />}
            >
              Approve
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
