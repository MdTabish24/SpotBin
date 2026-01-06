# 🎬 CleanCity Demo Script for Judges

## Overview
This demo showcases CleanCity's complete waste management workflow across three user types: Citizens, Workers, and Administrators.

**Total Demo Time**: ~8-10 minutes

---

## 🎯 Demo Flow

### Part 1: Citizen Experience (3 minutes)

#### 1.1 Zero-Friction Reporting
1. **Open Citizen App** - Camera view loads immediately (no login required)
2. **Capture Waste Photo** - Point at any waste/litter
3. **Auto GPS Capture** - Location captured automatically with accuracy indicator
4. **Optional Description** - Add brief description (max 50 chars)
5. **Submit Report** - One tap submission with success animation
6. **Show Estimated Time** - Display estimated cleanup time

**Key Points to Highlight**:
- No account creation needed (device fingerprint tracking)
- Live camera only (no gallery access for authenticity)
- Works offline (auto-syncs when connected)

#### 1.2 Gamification
1. **Navigate to Profile** - Show points, badge, and rank
2. **View Leaderboard** - City-wide and area-wise rankings
3. **Explain Badge System**:
   - 🌱 Cleanliness Rookie (0 pts)
   - 🌿 Eco Warrior (50 pts)
   - 🏆 Community Champion (200 pts)
   - 👑 Cleanup Legend (500 pts)

#### 1.3 Report Tracking
1. **Navigate to My Reports** - Show list of submitted reports
2. **Show Status Progression** - Open → Assigned → In Progress → Resolved
3. **View Before/After Photos** - For resolved reports

---

### Part 2: Worker Experience (3 minutes)

#### 2.1 Authentication
1. **Open Worker App** - Login screen
2. **Enter Phone Number** - +91 9876543210
3. **Enter OTP** - 123456 (demo mode)
4. **JWT Token Stored** - Secure 7-day session

#### 2.2 Task Management
1. **Map View** - Show clustered markers color-coded by status
   - 🔴 Red = Open
   - 🟡 Yellow = In Progress
   - 🟢 Green = Resolved
2. **List View** - Tasks sorted by priority (severity + age)
3. **Filter Tasks** - By status (Open, In Progress)
4. **Navigate to Task** - Opens Google Maps with directions

#### 2.3 Verification Flow
1. **Select a Task** - Show task details
2. **Start Task** - GPS validation (must be within 50m)
3. **Capture Before Photo** - With GPS stamp
4. **Complete Task** - After cleanup
5. **Capture After Photo** - With GPS stamp
6. **Submit for Approval** - Status changes to "Verified"

**Key Points to Highlight**:
- GPS proximity validation prevents fake verifications
- 2-240 minute timing constraint between photos
- Offline task caching for areas with poor connectivity

---

### Part 3: Admin Experience (3 minutes)

#### 3.1 Dashboard
1. **Open Admin Panel** - https://admin.cleancity.in
2. **Login** - admin@cleancity.in / demo123
3. **Show Summary Cards**:
   - Total Reports
   - Pending Reports
   - Resolved Today
   - Average Resolution Time
4. **Interactive Map** - Clustered markers with popup details

#### 3.2 Report Management
1. **View Reports List** - Filterable by date, area, status, severity
2. **Click Report** - Show details with photos
3. **Approve Verification** - Points credited to citizen, notification sent
4. **Reject Verification** - Returns to worker queue

#### 3.3 Worker Management
1. **View Workers** - Stats: tasks completed, efficiency
2. **Assign Zones** - Geographic zone assignment
3. **Send Notification** - Direct message to worker

#### 3.4 Analytics
1. **Select Date Range** - Last 30 days
2. **Show Charts**:
   - Daily reports trend
   - Area-wise breakdown
   - Waste type distribution
3. **Export Report** - PDF or Excel

---

## 🔑 Key Technical Highlights

### For Technical Judges

1. **Property-Based Testing**
   - 39 correctness properties with fast-check
   - 424 tests, 100+ iterations each
   - Run: `cd backend && npm test`

2. **Abuse Prevention**
   - 10 reports/day limit per device
   - 5-minute cooldown between reports
   - 50m duplicate detection radius
   - EXIF stripping for privacy

3. **Offline Support**
   - SQLite local storage
   - Auto-sync with exponential backoff
   - Cached tasks for workers

4. **Security**
   - Rate limiting (100 req/min/IP)
   - XSS sanitization
   - JWT authentication
   - Parameterized SQL queries

5. **Accessibility**
   - WCAG 2.1 AA compliant
   - 44x44px touch targets
   - 4.5:1 color contrast
   - Hindi + English i18n

---

## 📱 Demo Credentials

| Platform | Credentials |
|----------|-------------|
| Admin Panel | admin@cleancity.in / demo123 |
| Worker App | +91 9876543210 / OTP: 123456 |
| Citizen App | No login required |

---

## 🎤 Talking Points

### Problem Statement
- 62 million tons of waste generated annually in India
- Only 43% collected, 12% treated
- Citizens want to help but lack easy reporting mechanism

### Solution
- Zero-friction reporting (no account needed)
- Gamification drives engagement
- Real-time tracking builds trust
- Worker verification ensures accountability

### Impact Metrics (Projected)
- 10x faster report submission vs traditional apps
- 80% citizen retention through gamification
- 50% reduction in average resolution time
- 100% verification accuracy with GPS validation

### Scalability
- Handles 1000+ markers with clustering
- Redis caching for leaderboards
- OTA updates without app store approval
- Multi-language support ready

---

## ⚠️ Demo Troubleshooting

| Issue | Solution |
|-------|----------|
| Camera not working | Check permissions in device settings |
| GPS not accurate | Wait for GPS lock (accuracy < 20m) |
| Map not loading | Check Google Maps API key |
| OTP not received | Use demo OTP: 123456 |
| Offline mode | Toggle airplane mode to demonstrate |

---

## 🏆 Closing Statement

> "CleanCity transforms every citizen into a cleanliness champion. With zero-friction reporting, gamified engagement, and verified cleanup, we're building a movement for cleaner cities—one report at a time."

---

*Good luck with the demo! 🍀*
