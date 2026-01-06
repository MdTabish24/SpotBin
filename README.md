# 🌿 CleanCity - Smart Waste Management Platform

<p align="center">
  <img src="assets/icon.png" alt="CleanCity Logo" width="120" height="120">
</p>

<p align="center">
  <strong>Empowering citizens to keep cities clean through gamified waste reporting</strong>
</p>

<p align="center">
  <a href="#features">Features</a> •
  <a href="#architecture">Architecture</a> •
  <a href="#quick-start">Quick Start</a> •
  <a href="#deployment">Deployment</a> •
  <a href="#api-docs">API Docs</a>
</p>

---

## 🎯 Overview

CleanCity is a full-stack waste management platform that enables:
- **Citizens** to report waste hotspots with zero friction (no account required)
- **Workers** to efficiently manage and verify cleanup tasks
- **Administrators** to monitor city cleanliness through real-time dashboards

Built with modern technologies for performance on low-end devices and offline support.

## ✨ Features

### Citizen App
- 📸 One-tap photo capture with GPS tagging
- 🎮 Gamification with points, badges, and leaderboards
- 📊 Track report status in real-time
- 🔔 Push notifications on status updates
- 📴 Offline support with auto-sync

### Worker App
- 🗺️ Map view with clustered task markers
- 📋 Priority-sorted task list
- 📍 GPS-validated before/after photos
- 🧭 Navigation integration with Google Maps
- 📴 Offline task caching

### Admin Panel
- 📈 Real-time analytics dashboard
- 🗺️ Interactive map with report clusters
- 👷 Worker management and zone assignment
- ✅ Verification approval workflow
- 📊 Export reports as PDF/Excel

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      Client Layer                            │
├─────────────────┬─────────────────┬─────────────────────────┤
│  Citizen App    │   Worker App    │     Admin Panel         │
│  (React Native) │  (React Native) │    (React + Vite)       │
└────────┬────────┴────────┬────────┴───────────┬─────────────┘
         │                 │                     │
         └─────────────────┼─────────────────────┘
                           │
                    ┌──────▼──────┐
                    │   Express   │
                    │   Backend   │
                    └──────┬──────┘
                           │
         ┌─────────────────┼─────────────────┐
         │                 │                 │
    ┌────▼────┐      ┌─────▼─────┐     ┌─────▼─────┐
    │PostgreSQL│      │   Redis   │     │  S3/R2    │
    │ Database │      │   Cache   │     │  Storage  │
    └──────────┘      └───────────┘     └───────────┘
```

## 🛠️ Tech Stack

| Layer | Technology |
|-------|------------|
| Mobile Apps | React Native + Expo SDK 54 |
| Styling | NativeWind (Tailwind CSS) |
| Admin Panel | React 18 + Vite + Tailwind |
| Backend | Node.js + Express.js |
| Database | PostgreSQL 16 |
| Cache | Redis 7 |
| Storage | AWS S3 / Cloudflare R2 |
| Maps | Google Maps |
| Push Notifications | Firebase Cloud Messaging |
| CI/CD | GitHub Actions + EAS Build |

## 🚀 Quick Start

### Prerequisites

- Node.js 20+
- Docker & Docker Compose
- Expo CLI (`npm install -g expo-cli`)
- EAS CLI (`npm install -g eas-cli`)

### 1. Clone Repository

```bash
git clone https://github.com/your-org/cleancity.git
cd cleancity
```

### 2. Start Database Services

```bash
docker-compose -f docker-compose.dev.yml up -d
```

### 3. Setup Backend

```bash
cd backend
cp .env.example .env
npm install
npm run migrate
npm run seed
npm run dev
```

### 4. Setup Mobile App

```bash
cd ..
npm install --legacy-peer-deps
npx expo start
```

### 5. Setup Admin Panel

```bash
cd admin-panel
cp .env.example .env
npm install
npm run dev
```

## 📱 Running on Device

### Android

```bash
npx expo start --android
```

### iOS

```bash
npx expo start --ios
```

### Development Build

```bash
eas build --profile development --platform android
```

## 🌐 Deployment

### Backend (Railway)

```bash
railway up
```

### Admin Panel (Vercel)

```bash
cd admin-panel
vercel --prod
```

### Mobile Apps (EAS)

```bash
# Build for production
eas build --platform all --profile production

# Submit to stores
eas submit --platform all

# OTA Update
eas update --branch production --message "Bug fixes"
```

See [PRODUCTION_SETUP.md](docs/PRODUCTION_SETUP.md) for detailed deployment guide.

## 📚 API Documentation

API documentation is available at:
- **Local**: http://localhost:3000/api-docs
- **Production**: https://api.cleancity.in/api-docs

### Key Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/reports` | Submit waste report |
| GET | `/api/reports/:deviceId` | Get reports by device |
| GET | `/api/leaderboard` | Get leaderboard |
| POST | `/api/auth/otp/send` | Send OTP to worker |
| POST | `/api/auth/otp/verify` | Verify OTP |
| GET | `/api/tasks` | Get worker tasks |
| POST | `/api/verifications` | Submit verification |
| GET | `/api/admin/dashboard` | Get dashboard stats |

## 🧪 Testing

### Run All Tests

```bash
cd backend
npm test
```

### Run Property Tests

```bash
npm test -- --testPathPattern=property
```

### Test Coverage

```bash
npm test -- --coverage
```

## 📁 Project Structure

```
cleancity/
├── app/                    # Expo Router pages
│   ├── (citizen)/          # Citizen app screens
│   ├── (worker)/           # Worker app screens
│   └── index.tsx           # Entry point
├── src/
│   ├── components/         # Shared UI components
│   ├── hooks/              # Custom React hooks
│   ├── services/           # API services
│   ├── utils/              # Utility functions
│   └── i18n/               # Translations
├── backend/
│   ├── src/
│   │   ├── routes/         # API routes
│   │   ├── services/       # Business logic
│   │   ├── middleware/     # Express middleware
│   │   └── db/             # Database migrations
│   └── tests/              # Test files
├── admin-panel/
│   └── src/
│       ├── pages/          # Admin pages
│       ├── components/     # Admin components
│       └── services/       # API services
└── docs/                   # Documentation
```

## 🔐 Environment Variables

### Backend

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string |
| `REDIS_URL` | Redis connection string |
| `JWT_SECRET` | JWT signing secret |
| `AWS_ACCESS_KEY_ID` | S3/R2 access key |
| `AWS_SECRET_ACCESS_KEY` | S3/R2 secret key |
| `S3_BUCKET_NAME` | Storage bucket name |
| `FIREBASE_PROJECT_ID` | Firebase project ID |
| `GOOGLE_MAPS_API_KEY` | Google Maps API key |

### Mobile App

| Variable | Description |
|----------|-------------|
| `EXPO_PUBLIC_API_URL` | Backend API URL |
| `GOOGLE_MAPS_ANDROID_API_KEY` | Android Maps key |
| `GOOGLE_MAPS_IOS_API_KEY` | iOS Maps key |

## 🎮 Demo Credentials

### Admin Panel
- **URL**: https://admin.cleancity.in
- **Email**: admin@cleancity.in
- **Password**: demo123

### Worker App
- **Phone**: +91 9876543210
- **OTP**: 123456 (demo mode)

## 📊 Property-Based Tests

CleanCity uses property-based testing with fast-check for comprehensive validation:

| Property | Description |
|----------|-------------|
| P1-P4 | Report validation (GPS, timestamp, description) |
| P5-P9 | Abuse prevention (limits, cooldown, duplicates) |
| P10-P12 | Points and gamification |
| P13-P17 | Report tracking and status |
| P18-P19 | Authentication |
| P20-P25 | Worker task management |
| P26-P33 | Admin dashboard and analytics |
| P34 | Offline sync |
| P35-P36 | Security (rate limiting, XSS) |
| P37-P39 | Accessibility and i18n |

## 🤝 Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open Pull Request

## 📄 License

This project is licensed under the MIT License - see [LICENSE](LICENSE) file.

## 🙏 Acknowledgments

- [Expo](https://expo.dev) for the amazing React Native toolchain
- [NativeWind](https://nativewind.dev) for Tailwind CSS in React Native
- [fast-check](https://github.com/dubzzz/fast-check) for property-based testing

---

<p align="center">
  Made with 💚 for cleaner cities
</p>
