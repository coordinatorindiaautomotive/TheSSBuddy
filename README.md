# TheSSBuddy - B2B Dealer Management Portal

> Maruti Suzuki Parts Division | B2B Dealer Incentive & Financial Operations Platform

## Tech Stack

| Layer      | Technology                          |
|------------|-------------------------------------|
| Backend    | NestJS 10 + TypeScript              |
| Database   | PostgreSQL + Prisma ORM             |
| Frontend   | Next.js 16 + React 19 + Tailwind 4 |
| Auth       | JWT (Access + Refresh tokens)       |
| Queue      | BullMQ + Redis (or Mock Redis)      |

---

## Quick Start (Local Development)

```bash
# 1. Clone the repository
git clone https://github.com/coordinatorindiaautomotive/TheSSBuddy.git
cd TheSSBuddy

# 2. Set up environment
cp .env.example .env
# Edit .env with your database credentials

# 3. Install all dependencies
npm install
npm install --prefix frontend

# 4. Set up database
npx prisma generate
npx prisma migrate dev

# 5. Start development servers
npm run dev
# Backend on http://localhost:3000
# Frontend on http://localhost:3001
```

---

## Production Build

```bash
# Build backend + frontend
npm run build
npm run build --prefix frontend

# Start production backend
npm run start:prod
```

---

## cPanel Deployment (Git Version Control)

### Pre-requisites on cPanel Server

1. Node.js 18+ enabled via **cPanel → Node.js Selector**
2. PostgreSQL database created
3. **.env file** placed at root with production credentials (see .env.example)

### Deploy Steps

1. **cPanel → Git Version Control → Create Repository**
2. Clone URL: https://github.com/coordinatorindiaautomotive/TheSSBuddy.git
3. Set deployment path (e.g., /home/USERNAME/thessbuddy)
4. **Pull** from main branch
5. cPanel automatically runs .cpanel.yml tasks which:
   - Installs backend dependencies
   - Generates Prisma client
   - Runs database migrations (prisma migrate deploy)
   - Builds NestJS backend
   - Installs frontend dependencies
   - Builds Next.js frontend
   - Creates required runtime directories
   - Restarts the application via Passenger

### Environment Variables (.env)

```env
DATABASE_URL=postgresql://user:password@localhost:5432/thessbuddy
PORT=3000
NODE_ENV=production
JWT_ACCESS_SECRET=<random 64 char string>
JWT_REFRESH_SECRET=<another random 64 char string>
USE_MOCK_REDIS=true
CORS_ORIGINS=https://yourdomain.com
```

### Node.js Application Settings (cPanel)

| Setting           | Value                        |
|-------------------|------------------------------|
| Application Root  | /home/USERNAME/thessbuddy  |
| Application URL   | Your domain/subdomain        |
| Application File  | dist/src/main.js           |
| Node.js Version   | 18 or 20 (LTS)               |

> **Frontend**: Deploy the Next.js standalone build separately or serve from a subdomain.

---

## API Documentation

Swagger UI available at http://your-server/api/docs  
*(Disabled in production by default. Set ENABLE_SWAGGER=true in .env to enable.)*

---

## Git Workflow

```bash
# Feature branch workflow
git checkout -b feature/my-feature
git add .
git commit -m "feat: description"
git push origin feature/my-feature
# Create PR → merge to main → cPanel auto-deploys
```

---

## Scripts Reference

| Command                       | Description                             |
|-------------------------------|-----------------------------------------|
| 
pm run dev                 | Start both backend + frontend (dev)     |
| 
pm run build               | Build NestJS backend only               |
| 
pm run build:full          | Build backend + frontend                |
| 
pm run start:prod          | Start production backend                |
| 
pm run prisma:migrate      | Run dev migrations                      |
| 
pm run prisma:migrate:prod | Run production migrations (safe)        |
| 
pm run prisma:studio       | Open Prisma Studio (database browser)   |

---

## Directory Structure

```
thessbuddy/
├── src/                   # NestJS backend source
│   ├── auth/              # JWT authentication
│   ├── reports/           # Excel + PDF export engine
│   ├── dashboard/         # KPIs and analytics
│   ├── outstanding/       # Outstanding management
│   ├── target-achievement/# Target vs Achievement
│   └── ...
├── frontend/              # Next.js frontend
│   └── src/app/           # Pages (App Router)
├── prisma/                # Database schema + migrations
│   └── schema.prisma
├── .cpanel.yml            # cPanel auto-deploy tasks
├── .env.example           # Environment template
└── package.json
```