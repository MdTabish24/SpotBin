# Production Setup Guide

This guide covers setting up production infrastructure for CleanCity.

## 1. Database Setup (PostgreSQL)

### Option A: Supabase (Recommended for Hackathon)

1. Create account at [supabase.com](https://supabase.com)
2. Create new project in `ap-south-1` (Mumbai) region
3. Go to Settings → Database → Connection string
4. Copy the connection string and add to `DATABASE_URL`

```bash
DATABASE_URL=postgresql://postgres:[YOUR-PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres
```

### Option B: Neon (Serverless PostgreSQL)

1. Create account at [neon.tech](https://neon.tech)
2. Create new project
3. Copy connection string from dashboard

```bash
DATABASE_URL=postgresql://user:password@ep-xxx.ap-south-1.aws.neon.tech/cleancity?sslmode=require
```

### Run Migrations

```bash
cd backend
DATABASE_URL="your-production-url" npm run migrate
```

## 2. Redis Setup (Upstash)

1. Create account at [upstash.com](https://upstash.com)
2. Create new Redis database in `ap-south-1` region
3. Enable TLS/SSL
4. Copy the Redis URL

```bash
REDIS_URL=rediss://default:[PASSWORD]@[HOST]:6379
```

## 3. File Storage (AWS S3 / Cloudflare R2)

### Option A: AWS S3

1. Create S3 bucket in `ap-south-1`
2. Configure CORS:

```json
[
  {
    "AllowedHeaders": ["*"],
    "AllowedMethods": ["GET", "PUT", "POST", "DELETE"],
    "AllowedOrigins": ["https://admin.cleancity.in", "https://api.cleancity.in"],
    "ExposeHeaders": ["ETag"]
  }
]
```

3. Create IAM user with S3 access
4. Set environment variables:

```bash
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key
AWS_REGION=ap-south-1
S3_BUCKET_NAME=cleancity-uploads-prod
```

### Option B: Cloudflare R2 (Cheaper)

1. Create R2 bucket in Cloudflare dashboard
2. Create API token with R2 permissions
3. Set environment variables:

```bash
AWS_ACCESS_KEY_ID=your-r2-access-key
AWS_SECRET_ACCESS_KEY=your-r2-secret-key
S3_BUCKET_NAME=cleancity-uploads
S3_ENDPOINT=https://[ACCOUNT-ID].r2.cloudflarestorage.com
```

## 4. Firebase Setup (Push Notifications)

1. Go to [Firebase Console](https://console.firebase.google.com)
2. Create new project or use existing
3. Enable Cloud Messaging
4. Go to Project Settings → Service Accounts
5. Generate new private key
6. Set environment variables:

```bash
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxx@your-project.iam.gserviceaccount.com
```

### Android Setup

1. Download `google-services.json` from Firebase
2. Place in `cleancity/` root directory

### iOS Setup

1. Download `GoogleService-Info.plist` from Firebase
2. Add to iOS project via EAS Build secrets

## 5. Google Maps API

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Enable APIs:
   - Maps SDK for Android
   - Maps SDK for iOS
   - Maps JavaScript API
3. Create API key with restrictions:
   - Android: Package name `com.cleancity.app`
   - iOS: Bundle ID `com.cleancity.app`
   - Web: Referrer `admin.cleancity.in`

```bash
GOOGLE_MAPS_API_KEY=your-api-key
```

## 6. Domain Setup

### Backend API
- Domain: `api.cleancity.in`
- SSL: Auto-provisioned by Railway/Render

### Admin Panel
- Domain: `admin.cleancity.in`
- SSL: Auto-provisioned by Vercel

### DNS Configuration

```
api.cleancity.in     CNAME  your-railway-domain.up.railway.app
admin.cleancity.in   CNAME  cname.vercel-dns.com
```

## 7. Environment Variables Checklist

### Backend (Railway/Render)

| Variable | Required | Description |
|----------|----------|-------------|
| `NODE_ENV` | Yes | `production` |
| `PORT` | Yes | `3000` |
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `REDIS_URL` | Yes | Redis connection string |
| `JWT_SECRET` | Yes | Min 32 characters |
| `AWS_ACCESS_KEY_ID` | Yes | S3/R2 access key |
| `AWS_SECRET_ACCESS_KEY` | Yes | S3/R2 secret key |
| `S3_BUCKET_NAME` | Yes | Bucket name |
| `FIREBASE_PROJECT_ID` | Yes | Firebase project ID |
| `FIREBASE_PRIVATE_KEY` | Yes | Firebase service account key |
| `FIREBASE_CLIENT_EMAIL` | Yes | Firebase service account email |
| `GOOGLE_MAPS_API_KEY` | Yes | Google Maps API key |
| `CORS_ORIGIN` | Yes | Allowed origins |

### Admin Panel (Vercel)

| Variable | Required | Description |
|----------|----------|-------------|
| `VITE_API_URL` | Yes | Backend API URL |
| `VITE_GOOGLE_MAPS_API_KEY` | Yes | Google Maps API key |

### Mobile App (EAS Secrets)

```bash
eas secret:create --name EXPO_PUBLIC_API_URL --value https://api.cleancity.in
eas secret:create --name GOOGLE_MAPS_ANDROID_API_KEY --value your-key
eas secret:create --name GOOGLE_MAPS_IOS_API_KEY --value your-key
```

## 8. Monitoring (Optional)

### Sentry Error Tracking

1. Create account at [sentry.io](https://sentry.io)
2. Create project for Node.js
3. Add DSN to environment:

```bash
SENTRY_DSN=https://xxx@sentry.io/xxx
```

### Uptime Monitoring

- Use [UptimeRobot](https://uptimerobot.com) or [Better Uptime](https://betteruptime.com)
- Monitor: `https://api.cleancity.in/health`

## 9. Deployment Commands

### Backend

```bash
# Railway
railway up

# Render
# Push to main branch triggers auto-deploy
```

### Admin Panel

```bash
# Vercel
vercel --prod
```

### Mobile App

```bash
# Build for production
eas build --platform all --profile production

# Submit to stores
eas submit --platform all

# OTA Update
eas update --branch production --message "Bug fixes"
```

## 10. Post-Deployment Checklist

- [ ] Database migrations applied
- [ ] Seed data loaded (if needed)
- [ ] Health endpoint responding
- [ ] API endpoints working
- [ ] Admin panel loading
- [ ] Push notifications working
- [ ] File uploads working
- [ ] Maps loading correctly
- [ ] SSL certificates valid
- [ ] Error tracking configured
- [ ] Uptime monitoring active
