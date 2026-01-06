interface BadgeProps {
  children: React.ReactNode;
  variant?: 'success' | 'warning' | 'danger' | 'info' | 'default';
  size?: 'sm' | 'md';
  className?: string;
}

export default function Badge({ 
  children, 
  variant = 'default', 
  size = 'sm',
  className = '' 
}: BadgeProps) {
  const variantStyles = {
    success: 'bg-primary-100 text-primary-800',
    warning: 'bg-warning-100 text-warning-800',
    danger: 'bg-danger-100 text-danger-800',
    info: 'bg-secondary-100 text-secondary-800',
    default: 'bg-gray-100 text-gray-800',
  };

  const sizeStyles = {
    sm: 'px-2 py-0.5 text-xs',
    md: 'px-2.5 py-1 text-sm',
  };

  return (
    <span
      className={`inline-flex items-center font-medium rounded-full ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}
    >
      {children}
    </span>
  );
}

// Status badge helper
export function StatusBadge({ status }: { status: string }) {
  const statusConfig: Record<string, { variant: BadgeProps['variant']; label: string }> = {
    open: { variant: 'danger', label: 'Open' },
    assigned: { variant: 'warning', label: 'Assigned' },
    in_progress: { variant: 'info', label: 'In Progress' },
    verified: { variant: 'info', label: 'Verified' },
    resolved: { variant: 'success', label: 'Resolved' },
  };

  const config = statusConfig[status] || { variant: 'default', label: status };

  return <Badge variant={config.variant}>{config.label}</Badge>;
}

// Severity badge helper
export function SeverityBadge({ severity }: { severity: string }) {
  const severityConfig: Record<string, { variant: BadgeProps['variant']; label: string }> = {
    high: { variant: 'danger', label: 'High' },
    medium: { variant: 'warning', label: 'Medium' },
    low: { variant: 'success', label: 'Low' },
  };

  const config = severityConfig[severity] || { variant: 'default', label: severity };

  return <Badge variant={config.variant}>{config.label}</Badge>;
}
