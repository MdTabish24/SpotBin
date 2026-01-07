# 🆓 CleanCity - FREE Setup Guide (No Credit Card Required!)

## ✅ What You Need

| Tool | Required | How to Get |
|------|----------|------------|
| Docker Desktop | ✅ Yes | [Download Free](https://www.docker.com/products/docker-desktop/) |
| Node.js 18+ | ✅ Yes | [Download Free](https://nodejs.org/) |
| Git | ✅ Yes | [Download Free](https://git-scm.com/) |

## 🚀 Quick Start (5 Minutes)

### Step 1: Start Database & Redis
```bash
cd cleancity
docker-compose -f docker-compose.dev.yml up -d
```

Wait 30 seconds for containers to start.

### Step 2: Setup Backend
```bash
cd backend
npm install
npm run migrate
npm run dev
```

Backend will start at: http://localhost:3000
API Docs at: http://localhost:3000/api-docs

### Step 3: Setup Admin Panel (New Terminal)
```bash
cd admin-panel
npm install
npm run dev
```

Admin Panel will start at: http://localhost:5173

### Step 4: Setup Mobile App (New Terminal)
```bash
cd cleancity
npm install
npx expo start
```

Scan QR code with Expo Go app on your phone.

---

## 📱 Mobile App Configuration

Edit `src/config/env.ts` and update your local IP:

```typescript
// Find your IP: Run 'ipconfig' in CMD
API_BASE_URL: __DEV__ 
  ? 'http://YOUR_LOCAL_IP:3000/api/v1'  // e.g., 192.168.1.5
  : 'https://api.cleancity.in/v1',
```

---

## 🎯 What Works Without Paid Services

| Feature | Status | Notes |
|---------|--------|-------|
| Report Submission | ✅ Works | Images saved locally |
| View Reports | ✅ Works | Full functionality |
| Admin Dashboard | ✅ Works | Uses FREE OpenStreetMap |
| Worker Management | ✅ Works | Full functionality |
| Analytics | ✅ Works | Charts and stats |
| Leaderboard | ✅ Works | Points system |
| **Visual Maps (Mobile)** | ✅ Works | **FREE OpenStreetMap!** |
| **Visual Maps (Admin)** | ✅ Works | **FREE OpenStreetMap!** |
| Push Notifications | ⚠️ Disabled | Need Firebase (free but needs setup) |

---

## 🔧 Optional: Enable Push Notifications (FREE)

1. Go to [Firebase Console](https://console.firebase.google.com)
2. Create new project (no card needed)
3. Go to Project Settings → Service Accounts
4. Generate New Private Key (downloads JSON)
5. Update `backend/.env`:

```env
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxx@your-project.iam.gserviceaccount.com
```

---

## 🔧 Optional: Enable Cloud Storage (FREE - Cloudflare R2)

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com)
2. Create account (free)
3. Go to R2 → Create Bucket → "cleancity-uploads"
4. Create API Token with Object Read & Write
5. Update `backend/.env`:

```env
AWS_ACCESS_KEY_ID=your-r2-access-key
AWS_SECRET_ACCESS_KEY=your-r2-secret-key
S3_BUCKET_NAME=cleancity-uploads
S3_ENDPOINT=https://YOUR_ACCOUNT_ID.r2.cloudflarestorage.com
```

---

## 🛑 Troubleshooting

### Docker not starting?
- Make sure Docker Desktop is running
- Try: `docker-compose -f docker-compose.dev.yml down` then `up -d`

### Backend errors?
- Check if PostgreSQL is running: `docker ps`
- Check logs: `docker logs cleancity-postgres-dev`

### Mobile app can't connect?
- Make sure phone and computer are on same WiFi
- Check firewall isn't blocking port 3000
- Use correct local IP in env.ts

### Admin panel map not showing?
- Clear browser cache
- Check browser console for errors

---

## 📞 Need Help?

Open an issue on GitHub or check the docs folder.

Happy coding! 🎉
