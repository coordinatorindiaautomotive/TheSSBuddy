# TheSSBuddy Windows Service Setup

This directory contains the production Windows Service setup for running **TheSSBuddy Incentive & Operations Platform** automatically in the background on Windows boot.

---

## 🚀 Quick Setup (1-Click)

### 1. Install & Start the Windows Service
Double click on:
```text
install-service.bat
```
*(Accept the Windows Administrator UAC prompt when prompted).*

This will:
1. Build the production NestJS backend
2. Build the production Next.js frontend
3. Register **`TheSSBuddyPortal`** in Windows Services (`services.msc`)
4. Set startup type to **Automatic** (starts automatically when the PC/Server powers on).
5. Start both Backend (Port 3000) and Frontend (Port 3001) in background.

---

## 🛠️ Management Batch Files

| File | Action |
|---|---|
| **`install-service.bat`** | Installs and starts the Windows Service |
| **`restart-service.bat`** | Restarts the Windows Service |
| **`uninstall-service.bat`** | Removes the service from `services.msc` |

---

## 🌐 URLs

- **Portal Frontend**: [http://localhost:3001](http://localhost:3001)
- **Backend API**: [http://localhost:3000/api](http://localhost:3000/api)
- **API Swagger Docs**: [http://localhost:3000/api/docs](http://localhost:3000/api/docs)

---

## 📝 Logs

All background service logs are stored in:
```text
logs/service.log
```
