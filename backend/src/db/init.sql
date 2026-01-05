-- CleanCity Database Schema
-- This file is executed on first Docker container startup

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Citizens (anonymous tracking via device fingerprint)
CREATE TABLE IF NOT EXISTS citizens (
  device_id VARCHAR(64) PRIMARY KEY,
  first_seen TIMESTAMP DEFAULT NOW(),
  last_active TIMESTAMP DEFAULT NOW(),
  total_points INTEGER DEFAULT 0,
  reports_count INTEGER DEFAULT 0,
  current_badge VARCHAR(50) DEFAULT 'Cleanliness Rookie',
  city VARCHAR(100),
  area VARCHAR(100),
  streak_days INTEGER DEFAULT 0,
  last_report_date DATE,
  fcm_token TEXT
);

-- Waste Reports
CREATE TABLE IF NOT EXISTS reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  device_id VARCHAR(64) REFERENCES citizens(device_id) ON DELETE SET NULL,
  photo_url TEXT NOT NULL,
  latitude DECIMAL(10, 8) NOT NULL,
  longitude DECIMAL(11, 8) NOT NULL,
  location_accuracy DECIMAL(5, 2),
  description VARCHAR(50),
  status VARCHAR(20) DEFAULT 'open' CHECK (status IN ('open', 'assigned', 'in_progress', 'verified', 'resolved')),
  severity VARCHAR(10) CHECK (severity IN ('low', 'medium', 'high')),
  waste_types JSONB DEFAULT '[]',
  created_at TIMESTAMP DEFAULT NOW(),
  assigned_at TIMESTAMP,
  in_progress_at TIMESTAMP,
  verified_at TIMESTAMP,
  resolved_at TIMESTAMP,
  worker_id UUID,
  points_awarded INTEGER DEFAULT 0
);

-- Workers
CREATE TABLE IF NOT EXISTS workers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(100) NOT NULL,
  phone VARCHAR(15) UNIQUE NOT NULL,
  assigned_zones JSONB DEFAULT '[]',
  created_at TIMESTAMP DEFAULT NOW(),
  is_active BOOLEAN DEFAULT true,
  fcm_token TEXT
);

-- Add foreign key for worker_id in reports
ALTER TABLE reports 
  ADD CONSTRAINT fk_reports_worker 
  FOREIGN KEY (worker_id) REFERENCES workers(id) ON DELETE SET NULL;

-- Task Verifications
CREATE TABLE IF NOT EXISTS verifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  report_id UUID REFERENCES reports(id) ON DELETE CASCADE,
  worker_id UUID REFERENCES workers(id) ON DELETE SET NULL,
  before_photo_url TEXT NOT NULL,
  after_photo_url TEXT NOT NULL,
  started_at TIMESTAMP NOT NULL,
  completed_at TIMESTAMP NOT NULL,
  worker_lat DECIMAL(10, 8),
  worker_lng DECIMAL(11, 8),
  time_spent INTEGER, -- minutes
  quality_score DECIMAL(3, 2),
  approval_status VARCHAR(20) DEFAULT 'pending' CHECK (approval_status IN ('pending', 'approved', 'rejected'))
);

-- Admins
CREATE TABLE IF NOT EXISTS admins (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email VARCHAR(100) UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  name VARCHAR(100),
  role VARCHAR(20) DEFAULT 'admin' CHECK (role IN ('admin', 'super_admin')),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Points History
CREATE TABLE IF NOT EXISTS points_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  device_id VARCHAR(64) REFERENCES citizens(device_id) ON DELETE CASCADE,
  report_id UUID REFERENCES reports(id) ON DELETE SET NULL,
  points INTEGER NOT NULL,
  reason VARCHAR(100),
  created_at TIMESTAMP DEFAULT NOW()
);

-- OTP Storage (temporary)
CREATE TABLE IF NOT EXISTS otp_codes (
  phone VARCHAR(15) PRIMARY KEY,
  code VARCHAR(6) NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  attempts INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_reports_status ON reports(status);
CREATE INDEX IF NOT EXISTS idx_reports_location ON reports(latitude, longitude);
CREATE INDEX IF NOT EXISTS idx_reports_created_at ON reports(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reports_device_id ON reports(device_id);
CREATE INDEX IF NOT EXISTS idx_reports_worker_id ON reports(worker_id);
CREATE INDEX IF NOT EXISTS idx_citizens_points ON citizens(total_points DESC);
CREATE INDEX IF NOT EXISTS idx_citizens_area ON citizens(city, area);
CREATE INDEX IF NOT EXISTS idx_workers_zones ON workers USING GIN(assigned_zones);
CREATE INDEX IF NOT EXISTS idx_workers_active ON workers(is_active);
CREATE INDEX IF NOT EXISTS idx_verifications_status ON verifications(approval_status);
CREATE INDEX IF NOT EXISTS idx_verifications_report ON verifications(report_id);
CREATE INDEX IF NOT EXISTS idx_points_history_device ON points_history(device_id);
CREATE INDEX IF NOT EXISTS idx_points_history_created ON points_history(created_at DESC);

-- Function to update last_active timestamp
CREATE OR REPLACE FUNCTION update_citizen_last_active()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE citizens SET last_active = NOW() WHERE device_id = NEW.device_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update citizen last_active on new report
DROP TRIGGER IF EXISTS trigger_update_citizen_last_active ON reports;
CREATE TRIGGER trigger_update_citizen_last_active
  AFTER INSERT ON reports
  FOR EACH ROW
  EXECUTE FUNCTION update_citizen_last_active();

-- Grant permissions (for production, adjust as needed)
-- GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO cleancity_user;
-- GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO cleancity_user;
