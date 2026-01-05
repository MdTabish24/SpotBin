import pool from './pool';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../config/logger';

// Mock data for seeding
const MOCK_CITIZENS = [
  { device_id: 'device_001', city: 'Mumbai', area: 'Andheri' },
  { device_id: 'device_002', city: 'Mumbai', area: 'Bandra' },
  { device_id: 'device_003', city: 'Mumbai', area: 'Dadar' },
  { device_id: 'device_004', city: 'Delhi', area: 'Connaught Place' },
  { device_id: 'device_005', city: 'Delhi', area: 'Karol Bagh' },
  { device_id: 'device_006', city: 'Bangalore', area: 'Koramangala' },
  { device_id: 'device_007', city: 'Bangalore', area: 'Indiranagar' },
  { device_id: 'device_008', city: 'Chennai', area: 'T Nagar' },
  { device_id: 'device_009', city: 'Hyderabad', area: 'Banjara Hills' },
  { device_id: 'device_010', city: 'Pune', area: 'Koregaon Park' },
];

const MOCK_WORKERS = [
  { name: 'Ramesh Kumar', phone: '+919876543210', zones: ['Andheri', 'Bandra'] },
  { name: 'Suresh Sharma', phone: '+919876543211', zones: ['Dadar', 'Worli'] },
  { name: 'Mahesh Singh', phone: '+919876543212', zones: ['Connaught Place', 'Karol Bagh'] },
  { name: 'Rajesh Verma', phone: '+919876543213', zones: ['Koramangala', 'Indiranagar'] },
  { name: 'Dinesh Patel', phone: '+919876543214', zones: ['T Nagar', 'Anna Nagar'] },
];

const MOCK_ADMINS = [
  { email: 'admin@cleancity.in', password: 'admin123', name: 'Admin User', role: 'super_admin' },
  { email: 'manager@cleancity.in', password: 'manager123', name: 'Manager User', role: 'admin' },
];

const WASTE_TYPES = ['plastic', 'organic', 'paper', 'metal', 'glass', 'e-waste', 'construction'];
const SEVERITIES = ['low', 'medium', 'high'];
const STATUSES = ['open', 'assigned', 'in_progress', 'verified', 'resolved'];

// Mumbai coordinates for mock data
const LOCATIONS = [
  { lat: 19.1136, lng: 72.8697, area: 'Andheri' },
  { lat: 19.0596, lng: 72.8295, area: 'Bandra' },
  { lat: 19.0178, lng: 72.8478, area: 'Dadar' },
  { lat: 28.6315, lng: 77.2167, area: 'Connaught Place' },
  { lat: 28.6519, lng: 77.1909, area: 'Karol Bagh' },
  { lat: 12.9352, lng: 77.6245, area: 'Koramangala' },
  { lat: 12.9784, lng: 77.6408, area: 'Indiranagar' },
  { lat: 13.0418, lng: 80.2341, area: 'T Nagar' },
  { lat: 17.4156, lng: 78.4347, area: 'Banjara Hills' },
  { lat: 18.5362, lng: 73.8939, area: 'Koregaon Park' },
];

function randomElement<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomFloat(min: number, max: number): number {
  return Math.random() * (max - min) + min;
}

function randomDate(daysAgo: number): Date {
  const date = new Date();
  date.setDate(date.getDate() - Math.floor(Math.random() * daysAgo));
  return date;
}

async function seedCitizens(): Promise<void> {
  logger.info('Seeding citizens...');
  
  for (const citizen of MOCK_CITIZENS) {
    await pool.query(
      `INSERT INTO citizens (device_id, city, area, total_points, reports_count, current_badge, streak_days)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (device_id) DO NOTHING`,
      [
        citizen.device_id,
        citizen.city,
        citizen.area,
        Math.floor(Math.random() * 300),
        Math.floor(Math.random() * 30),
        randomElement(['Cleanliness Rookie', 'Eco Warrior', 'Community Champion']),
        Math.floor(Math.random() * 10),
      ]
    );
  }
  
  logger.info(`Seeded ${MOCK_CITIZENS.length} citizens`);
}

async function seedWorkers(): Promise<string[]> {
  logger.info('Seeding workers...');
  const workerIds: string[] = [];
  
  for (const worker of MOCK_WORKERS) {
    const id = uuidv4();
    workerIds.push(id);
    
    await pool.query(
      `INSERT INTO workers (id, name, phone, assigned_zones, is_active)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (phone) DO UPDATE SET name = $2, assigned_zones = $4`,
      [id, worker.name, worker.phone, JSON.stringify(worker.zones), true]
    );
  }
  
  logger.info(`Seeded ${MOCK_WORKERS.length} workers`);
  return workerIds;
}

async function seedAdmins(): Promise<void> {
  logger.info('Seeding admins...');
  
  for (const admin of MOCK_ADMINS) {
    const passwordHash = await bcrypt.hash(admin.password, 10);
    
    await pool.query(
      `INSERT INTO admins (email, password_hash, name, role)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (email) DO UPDATE SET password_hash = $2, name = $3`,
      [admin.email, passwordHash, admin.name, admin.role]
    );
  }
  
  logger.info(`Seeded ${MOCK_ADMINS.length} admins`);
}

async function seedReports(workerIds: string[]): Promise<void> {
  logger.info('Seeding reports...');
  
  for (let i = 0; i < 50; i++) {
    const location = randomElement(LOCATIONS);
    const status = randomElement(STATUSES);
    const citizen = randomElement(MOCK_CITIZENS);
    const createdAt = randomDate(30);
    
    // Add some randomness to coordinates
    const lat = location.lat + randomFloat(-0.01, 0.01);
    const lng = location.lng + randomFloat(-0.01, 0.01);
    
    const reportId = uuidv4();
    const workerId = status !== 'open' ? randomElement(workerIds) : null;
    
    await pool.query(
      `INSERT INTO reports (
        id, device_id, photo_url, latitude, longitude, location_accuracy,
        description, status, severity, waste_types, created_at, worker_id, points_awarded
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
      [
        reportId,
        citizen.device_id,
        `https://cleancity-uploads.s3.amazonaws.com/reports/${reportId}.jpg`,
        lat,
        lng,
        randomFloat(5, 50),
        `Waste spotted near ${location.area}`,
        status,
        randomElement(SEVERITIES),
        JSON.stringify([randomElement(WASTE_TYPES), randomElement(WASTE_TYPES)]),
        createdAt,
        workerId,
        status === 'resolved' ? (randomElement(SEVERITIES) === 'high' ? 15 : 10) : 0,
      ]
    );
    
    // Create verification for resolved/verified reports
    if (status === 'resolved' || status === 'verified') {
      const startedAt = new Date(createdAt.getTime() + 3600000); // 1 hour after creation
      const completedAt = new Date(startedAt.getTime() + 1800000); // 30 min after start
      
      await pool.query(
        `INSERT INTO verifications (
          report_id, worker_id, before_photo_url, after_photo_url,
          started_at, completed_at, worker_lat, worker_lng, time_spent, approval_status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [
          reportId,
          workerId,
          `https://cleancity-uploads.s3.amazonaws.com/verifications/${reportId}_before.jpg`,
          `https://cleancity-uploads.s3.amazonaws.com/verifications/${reportId}_after.jpg`,
          startedAt,
          completedAt,
          lat + randomFloat(-0.0001, 0.0001),
          lng + randomFloat(-0.0001, 0.0001),
          30,
          status === 'resolved' ? 'approved' : 'pending',
        ]
      );
    }
  }
  
  logger.info('Seeded 50 reports with verifications');
}

async function seed(): Promise<void> {
  try {
    logger.info('Starting database seed...');
    
    await seedCitizens();
    const workerIds = await seedWorkers();
    await seedAdmins();
    await seedReports(workerIds);
    
    logger.info('✅ Database seeding completed successfully!');
    logger.info('');
    logger.info('Test credentials:');
    logger.info('  Admin: admin@cleancity.in / admin123');
    logger.info('  Manager: manager@cleancity.in / manager123');
    logger.info('  Worker phones: +919876543210 to +919876543214');
    
  } catch (error) {
    logger.error({ error }, 'Database seeding failed');
    throw error;
  } finally {
    await pool.end();
  }
}

// Run seed if called directly
seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
