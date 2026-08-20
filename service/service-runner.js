// service/service-runner.js
const path = require('path');
const { spawn } = require('child_process');
const fs = require('fs');

const rootDir = path.resolve(__dirname, '..');
const frontendDir = path.join(rootDir, 'frontend');
const logDir = path.join(rootDir, 'logs');

if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

const serviceLogStream = fs.createWriteStream(path.join(logDir, 'service.log'), { flags: 'a' });

function log(msg) {
  const line = `[${new Date().toISOString()}] ${msg}\n`;
  process.stdout.write(line);
  serviceLogStream.write(line);
}

log('=== TheSSBuddy Windows Service Starting ===');
log(`Root Dir: ${rootDir}`);

let backendProcess = null;
let frontendProcess = null;
let isShuttingDown = false;

function startBackend() {
  if (isShuttingDown) return;
  log('Starting NestJS Backend on port 3000...');

  // Run compiled production main
  const mainPath = path.join(rootDir, 'dist', 'src', 'main.js');
  const fallbackMainPath = path.join(rootDir, 'dist', 'main.js');
  const targetScript = fs.existsSync(mainPath) ? mainPath : fallbackMainPath;

  backendProcess = spawn(process.execPath, ['--max-old-space-size=4096', targetScript], {
    cwd: rootDir,
    env: { ...process.env, NODE_ENV: 'production', PORT: '3000' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  backendProcess.stdout.on('data', (data) => {
    serviceLogStream.write(`[BACKEND] ${data}`);
  });

  backendProcess.stderr.on('data', (data) => {
    serviceLogStream.write(`[BACKEND ERR] ${data}`);
  });

  backendProcess.on('exit', (code, signal) => {
    log(`Backend exited with code ${code} signal ${signal}`);
    if (!isShuttingDown) {
      log('Restarting Backend in 3 seconds...');
      setTimeout(startBackend, 3000);
    }
  });
}

function startFrontend() {
  if (isShuttingDown) return;
  log('Starting Next.js Frontend on port 3001...');

  const nextBin = path.join(frontendDir, 'node_modules', 'next', 'dist', 'bin', 'next');

  frontendProcess = spawn(process.execPath, [nextBin, 'start', '-H', '0.0.0.0', '-p', '3001'], {
    cwd: frontendDir,
    env: { ...process.env, NODE_ENV: 'production', PORT: '3001', HOSTNAME: '0.0.0.0' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  frontendProcess.stdout.on('data', (data) => {
    serviceLogStream.write(`[FRONTEND] ${data}`);
  });

  frontendProcess.stderr.on('data', (data) => {
    serviceLogStream.write(`[FRONTEND ERR] ${data}`);
  });

  frontendProcess.on('exit', (code, signal) => {
    log(`Frontend exited with code ${code} signal ${signal}`);
    if (!isShuttingDown) {
      log('Restarting Frontend in 3 seconds...');
      setTimeout(startFrontend, 3000);
    }
  });
}

function shutdown() {
  log('Received shutdown signal. Stopping services...');
  isShuttingDown = true;
  if (backendProcess) {
    backendProcess.kill('SIGTERM');
  }
  if (frontendProcess) {
    frontendProcess.kill('SIGTERM');
  }
  setTimeout(() => {
    process.exit(0);
  }, 2000);
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
process.on('uncaughtException', (err) => {
  log(`Uncaught exception in service runner: ${err.stack || err.message}`);
});

// Start both
startBackend();
startFrontend();
log('Both Backend (3000) and Frontend (3001) processes spawned.');
