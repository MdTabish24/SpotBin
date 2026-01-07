# 🌿 CleanCity - Smart Waste Management Platform

A full-stack waste management app where citizens report waste, workers clean it, and admins monitor everything.

## 📱 What's Included

| Component | Description | Port |
|-----------|-------------|------|
| Mobile App | React Native + Expo (Citizen reporting) | 8081 |
| Backend API | Node.js + Express | 3000 |
| Admin Panel | React + Vite (Government dashboard) | 3001 |
| PostgreSQL | Database | 5432 |
| Redis | Cache | 6379 |

---

## 🚀 Quick Start (Complete Setup)

### Prerequisites - Install These First

1. **Node.js 20+** - https://nodejs.org/
2. **Docker Desktop** - https://www.docker.com/products/docker-desktop/
3. **Git** - https://git-scm.com/downloads
4. **Expo Go App** - Install on your phone from Play Store/App Store

### Step 1: Clone the Repository

```bash
git clone https://github.com/your-username/cleancity.git
cd cleancity
```

### Step 2: Start Database (Docker)

```bash
docker-compose -f docker-compose.dev.yml up -d
```

Wait 10 seconds for databases to start. Verify:
```bash
docker ps
```
You should see `cleancity-postgres-dev` and `cleancity-redis-dev` running.

### Step 3: Setup Backend

```bash
cd backend
npm install
```

Create `.env` file in `backend/` folder:
```env
PORT=3000
NODE_ENV=development
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/cleancity
REDIS_URL=redis://localhost:6379
JWT_SECRET=your-super-secret-key-change-in-production
JWT_EXPIRES_IN=7d
CORS_ORIGIN=*
```

Run database migrations and seed data:
```bash
npm run migrate
npm run seed
```

Start backend:
```bash
npm run dev
```

✅ Backend running at http://localhost:3000
✅ API Docs at http://localhost:3000/api-docs

### Step 4: Setup Admin Panel

Open NEW terminal:
```bash
cd cleancity/admin-panel
npm install
```

`.env` file already exists. Start admin panel:
```bash
npm run dev
```

✅ Admin Panel at http://localhost:3001

**Login Credentials:**
- Email: `admin@cleancity.in`
- Password: `admin123`

### Step 5: Setup Mobile App

Open NEW terminal:
```bash
cd cleancity
npm install --legacy-peer-deps
```

Find your computer's IP address:
- **Windows**: Run `ipconfig` → Look for IPv4 Address (e.g., 192.168.0.103)
- **Mac/Linux**: Run `ifconfig` or `ip addr`

Update IP in `src/config/env.ts`:
```typescript
API_BASE_URL: __DEV__ 
  ? 'http://YOUR_IP_HERE:3000/api/v1'  // Replace with your IP
  : 'https://api.cleancity.in/v1',
```

Also update in `src/api/client.ts`:
```typescript
const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://YOUR_IP_HERE:3000/api/v1';
```

Start Expo:
```bash
npx expo start --lan --clear
```

✅ Scan QR code with Expo Go app on your phone

---

## 📱 Using the App

### Citizen Flow (Mobile App)
1. Open app → You're on Report tab
2. Tap camera → Take photo of waste
3. Add description (optional) → Submit
4. Go to "My Reports" tab → See your submitted reports
5. Go to "Leaderboard" → See points and rankings

### Admin Flow (Web Panel)
1. Open http://localhost:3001
2. Login with `admin@cleancity.in` / `admin123`
3. Dashboard → See overview stats
4. Reports → See all citizen reports with photos
5. Workers → Manage cleanup workers

---

## 🔧 Troubleshooting

### "Cannot connect to backend" on mobile
- Make sure phone and computer are on SAME WiFi
- Check IP address is correct in `src/config/env.ts`
- Backend must be running (`npm run dev` in backend folder)

### "Port already in use"
```bash
# Kill process on port 3000 (Windows)
netstat -ano | findstr :3000
taskkill /PID <PID> /F

# Kill process on port 3000 (Mac/Linux)
lsof -i :3000
kill -9 <PID>
```

### "Docker containers not starting"
```bash
docker-compose -f docker-compose.dev.yml down
docker-compose -f docker-compose.dev.yml up -d
```

### "Database migration failed"
```bash
cd backend
docker exec cleancity-postgres-dev psql -U postgres -d cleancity -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"
npm run migrate
npm run seed
```

### "White screen on mobile app"
- Shake phone → Tap "Reload"
- Or restart Expo: `npx expo start --lan --clear`

---

## 📁 Project Structure

```
cleancity/
├── app/                    # Mobile app screens (Expo Router)
│   ├── (citizen)/          # Citizen tabs (Report, My Reports, Leaderboard, Profile)
│   └── index.tsx           # Entry screen
├── src/
│   ├── api/                # API client
│   ├── components/         # Reusable UI components
│   └── hooks/              # Custom React hooks
├── backend/
│   ├── src/
│   │   ├── routes/         # API endpoints
│   │   ├── services/       # Business logic
│   │   └── db/             # Database migrations
│   └── uploads/            # Uploaded images (local dev)
├── admin-panel/
│   └── src/
│       ├── pages/          # Admin pages
│       └── components/     # Admin UI components
└── docker-compose.dev.yml  # Database containers
```

---

## 🌐 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/reports` | Submit waste report |
| GET | `/api/v1/reports/my` | Get user's reports |
| GET | `/api/v1/leaderboard` | Get leaderboard |
| GET | `/api/v1/citizens/stats` | Get user stats |
| POST | `/api/auth/admin/login` | Admin login |
| GET | `/api/v1/admin/reports` | Get all reports (admin) |
| GET | `/api/v1/admin/dashboard` | Dashboard stats (admin) |

Full API docs: http://localhost:3000/api-docs

---

## 🎮 Demo Credentials

### Admin Panel
- **URL**: http://localhost:3001
- **Email**: admin@cleancity.in
- **Password**: admin123

---

## 🛠️ Tech Stack

- **Mobile**: React Native + Expo SDK 54 + NativeWind
- **Backend**: Node.js + Express + TypeScript
- **Admin**: React + Vite + Tailwind CSS
- **Database**: PostgreSQL 16
- **Cache**: Redis 7
- **Maps**: OpenStreetMap (free, no API key needed)

---

## 📄 License

MIT License - feel free to use for hackathons and projects!

---

Made with 💚 for cleaner cities
