import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Plus,
  Search,
  MapPin,
  Phone,
  CheckCircle,
  XCircle,
  Bell,
  Edit,
  X,
  User,
  Clock,
  Target,
} from 'lucide-react';
import { workersApi } from '../api/admin';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Badge from '../components/ui/Badge';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import type { Worker } from '../types';

export default function WorkersPage() {
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedWorker, setSelectedWorker] = useState<Worker | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showNotifyModal, setShowNotifyModal] = useState(false);
  const [notifyWorkerId, setNotifyWorkerId] = useState<string | null>(null);

  // Fetch workers
  const { data: workers, isLoading, error } = useQuery({
    queryKey: ['workers'],
    queryFn: workersApi.getWorkers,
  });

  // Filter workers by search
  const filteredWorkers = workers?.filter(worker =>
    worker.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    worker.phone.includes(searchQuery)
  );

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Workers</h1>
          <p className="text-gray-500 mt-1">Manage sanitation workers and zone assignments</p>
        </div>
        <Button
          leftIcon={<Plus className="w-4 h-4" />}
          onClick={() => setShowAddModal(true)}
        >
          Add Worker
        </Button>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
        <Input
          placeholder="Search by name or phone..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Workers grid */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <LoadingSpinner message="Loading workers..." />
        </div>
      ) : error ? (
        <div className="text-center py-12 text-danger">
          Failed to load workers. Please try again.
        </div>
      ) : filteredWorkers?.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          No workers found
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredWorkers?.map((worker) => (
            <WorkerCard
              key={worker.id}
              worker={worker}
              onView={() => setSelectedWorker(worker)}
              onNotify={() => {
                setNotifyWorkerId(worker.id);
                setShowNotifyModal(true);
              }}
            />
          ))}
        </div>
      )}

      {/* Worker detail modal */}
      {selectedWorker && (
        <WorkerDetailModal
          worker={selectedWorker}
          onClose={() => setSelectedWorker(null)}
        />
      )}

      {/* Add worker modal */}
      {showAddModal && (
        <AddWorkerModal
          onClose={() => setShowAddModal(false)}
          onSuccess={() => {
            setShowAddModal(false);
            queryClient.invalidateQueries({ queryKey: ['workers'] });
          }}
        />
      )}

      {/* Notify worker modal */}
      {showNotifyModal && notifyWorkerId && (
        <NotifyWorkerModal
          workerId={notifyWorkerId}
          onClose={() => {
            setShowNotifyModal(false);
            setNotifyWorkerId(null);
          }}
        />
      )}
    </div>
  );
}

interface WorkerCardProps {
  worker: Worker;
  onView: () => void;
  onNotify: () => void;
}

function WorkerCard({ worker, onView, onNotify }: WorkerCardProps) {
  return (
    <Card className="hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center">
          <div className="w-12 h-12 bg-primary-100 rounded-full flex items-center justify-center">
            <User className="w-6 h-6 text-primary" />
          </div>
          <div className="ml-3">
            <h3 className="font-semibold text-gray-900">{worker.name}</h3>
            <div className="flex items-center text-sm text-gray-500">
              <Phone className="w-3 h-3 mr-1" />
              {worker.phone}
            </div>
          </div>
        </div>
        <Badge variant={worker.isActive ? 'success' : 'default'}>
          {worker.isActive ? 'Active' : 'Inactive'}
        </Badge>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-2 mb-4">
        <div className="text-center p-2 bg-gray-50 rounded-lg">
          <p className="text-lg font-bold text-gray-900">{worker.tasksCompleted}</p>
          <p className="text-xs text-gray-500">Completed</p>
        </div>
        <div className="text-center p-2 bg-gray-50 rounded-lg">
          <p className="text-lg font-bold text-gray-900">{worker.activeTasksCount}</p>
          <p className="text-xs text-gray-500">Active</p>
        </div>
        <div className="text-center p-2 bg-gray-50 rounded-lg">
          <p className="text-lg font-bold text-gray-900">
            {worker.avgResolutionTime ? `${worker.avgResolutionTime.toFixed(1)}h` : '--'}
          </p>
          <p className="text-xs text-gray-500">Avg Time</p>
        </div>
      </div>

      {/* Zones */}
      <div className="mb-4">
        <p className="text-xs text-gray-500 mb-1">Assigned Zones</p>
        <div className="flex flex-wrap gap-1">
          {worker.assignedZones.length > 0 ? (
            worker.assignedZones.slice(0, 3).map((zone) => (
              <span
                key={zone}
                className="px-2 py-0.5 bg-secondary-100 text-secondary-700 text-xs rounded-full"
              >
                {zone}
              </span>
            ))
          ) : (
            <span className="text-xs text-gray-400">No zones assigned</span>
          )}
          {worker.assignedZones.length > 3 && (
            <span className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded-full">
              +{worker.assignedZones.length - 3} more
            </span>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        <Button variant="outline" size="sm" className="flex-1" onClick={onView}>
          View Details
        </Button>
        <Button variant="ghost" size="sm" onClick={onNotify}>
          <Bell className="w-4 h-4" />
        </Button>
      </div>
    </Card>
  );
}

interface WorkerDetailModalProps {
  worker: Worker;
  onClose: () => void;
}

function WorkerDetailModal({ worker, onClose }: WorkerDetailModalProps) {
  const queryClient = useQueryClient();
  const [zones, setZones] = useState(worker.assignedZones.join(', '));
  const [isEditing, setIsEditing] = useState(false);

  const updateZonesMutation = useMutation({
    mutationFn: (newZones: string[]) => workersApi.assignZones(worker.id, newZones),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workers'] });
      setIsEditing(false);
    },
  });

  const handleSaveZones = () => {
    const newZones = zones.split(',').map(z => z.trim()).filter(Boolean);
    updateZonesMutation.mutate(newZones);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      
      <div className="relative bg-white rounded-2xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Worker Details</h2>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Profile */}
          <div className="flex items-center">
            <div className="w-16 h-16 bg-primary-100 rounded-full flex items-center justify-center">
              <User className="w-8 h-8 text-primary" />
            </div>
            <div className="ml-4">
              <h3 className="text-xl font-semibold text-gray-900">{worker.name}</h3>
              <div className="flex items-center text-gray-500 mt-1">
                <Phone className="w-4 h-4 mr-1" />
                {worker.phone}
              </div>
            </div>
            <Badge variant={worker.isActive ? 'success' : 'default'} className="ml-auto">
              {worker.isActive ? 'Active' : 'Inactive'}
            </Badge>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 bg-gray-50 rounded-xl">
              <div className="flex items-center text-gray-500 mb-1">
                <CheckCircle className="w-4 h-4 mr-1" />
                <span className="text-sm">Tasks Completed</span>
              </div>
              <p className="text-2xl font-bold text-gray-900">{worker.tasksCompleted}</p>
            </div>
            <div className="p-4 bg-gray-50 rounded-xl">
              <div className="flex items-center text-gray-500 mb-1">
                <Target className="w-4 h-4 mr-1" />
                <span className="text-sm">Active Tasks</span>
              </div>
              <p className="text-2xl font-bold text-gray-900">{worker.activeTasksCount}</p>
            </div>
            <div className="p-4 bg-gray-50 rounded-xl">
              <div className="flex items-center text-gray-500 mb-1">
                <Clock className="w-4 h-4 mr-1" />
                <span className="text-sm">Avg Resolution</span>
              </div>
              <p className="text-2xl font-bold text-gray-900">
                {worker.avgResolutionTime ? `${worker.avgResolutionTime.toFixed(1)}h` : '--'}
              </p>
            </div>
            <div className="p-4 bg-gray-50 rounded-xl">
              <div className="flex items-center text-gray-500 mb-1">
                <MapPin className="w-4 h-4 mr-1" />
                <span className="text-sm">Zones</span>
              </div>
              <p className="text-2xl font-bold text-gray-900">{worker.assignedZones.length}</p>
            </div>
          </div>

          {/* Zones */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h4 className="font-medium text-gray-900">Assigned Zones</h4>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsEditing(!isEditing)}
              >
                <Edit className="w-4 h-4 mr-1" />
                {isEditing ? 'Cancel' : 'Edit'}
              </Button>
            </div>
            
            {isEditing ? (
              <div className="space-y-2">
                <Input
                  value={zones}
                  onChange={(e) => setZones(e.target.value)}
                  placeholder="Zone A, Zone B, Zone C"
                  helperText="Enter zone names separated by commas"
                />
                <Button
                  size="sm"
                  onClick={handleSaveZones}
                  isLoading={updateZonesMutation.isPending}
                >
                  Save Zones
                </Button>
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {worker.assignedZones.length > 0 ? (
                  worker.assignedZones.map((zone) => (
                    <span
                      key={zone}
                      className="px-3 py-1 bg-secondary-100 text-secondary-700 text-sm rounded-full"
                    >
                      {zone}
                    </span>
                  ))
                ) : (
                  <span className="text-gray-400">No zones assigned</span>
                )}
              </div>
            )}
          </div>

          {/* Last active */}
          {worker.lastActive && (
            <div className="text-sm text-gray-500">
              Last active: {new Date(worker.lastActive).toLocaleString()}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

interface AddWorkerModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

function AddWorkerModal({ onClose, onSuccess }: AddWorkerModalProps) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [zones, setZones] = useState('');
  const [error, setError] = useState('');

  const createMutation = useMutation({
    mutationFn: () => workersApi.createWorker({
      name,
      phone,
      assignedZones: zones.split(',').map(z => z.trim()).filter(Boolean),
    }),
    onSuccess,
    onError: (err: any) => {
      setError(err.response?.data?.error?.message || 'Failed to create worker');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!name || !phone) {
      setError('Name and phone are required');
      return;
    }

    createMutation.mutate();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      
      <div className="relative bg-white rounded-2xl shadow-xl max-w-md w-full">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Add New Worker</h2>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <Input
            label="Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Enter worker name"
            required
          />
          <Input
            label="Phone"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+91 9876543210"
            required
          />
          <Input
            label="Assigned Zones"
            value={zones}
            onChange={(e) => setZones(e.target.value)}
            placeholder="Zone A, Zone B"
            helperText="Enter zone names separated by commas"
          />

          {error && (
            <div className="p-3 bg-danger-50 border border-danger-200 rounded-lg">
              <p className="text-sm text-danger">{error}</p>
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <Button variant="outline" type="button" onClick={onClose} className="flex-1">
              Cancel
            </Button>
            <Button type="submit" isLoading={createMutation.isPending} className="flex-1">
              Add Worker
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

interface NotifyWorkerModalProps {
  workerId: string;
  onClose: () => void;
}

function NotifyWorkerModal({ workerId, onClose }: NotifyWorkerModalProps) {
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const notifyMutation = useMutation({
    mutationFn: () => workersApi.sendNotification(workerId, message),
    onSuccess: onClose,
    onError: (err: any) => {
      setError(err.response?.data?.error?.message || 'Failed to send notification');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!message.trim()) {
      setError('Message is required');
      return;
    }

    notifyMutation.mutate();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      
      <div className="relative bg-white rounded-2xl shadow-xl max-w-md w-full">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Send Notification</h2>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Message
            </label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Enter notification message..."
              rows={4}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
              required
            />
          </div>

          {error && (
            <div className="p-3 bg-danger-50 border border-danger-200 rounded-lg">
              <p className="text-sm text-danger">{error}</p>
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <Button variant="outline" type="button" onClick={onClose} className="flex-1">
              Cancel
            </Button>
            <Button type="submit" isLoading={notifyMutation.isPending} className="flex-1">
              Send
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
