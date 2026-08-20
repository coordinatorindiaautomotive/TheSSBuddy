// service/install-service.js
const { Service } = require('node-windows');
const path = require('path');

const svc = new Service({
  name: 'TheSSBuddyPortal',
  description: 'TheSSBuddy B2B Dealer Incentive & Financial Operations Management Platform',
  script: path.join(__dirname, 'service-runner.js'),
  nodeOptions: [
    '--max-old-space-size=4096'
  ],
  wait: 2,
  grow: 0.5,
  maxRetries: 5
});

svc.on('install', function () {
  console.log('✅ TheSSBuddy Windows Service installed successfully!');
  console.log('Starting the service now...');
  svc.start();
});

svc.on('alreadyinstalled', function () {
  console.log('ℹ️ TheSSBuddy Windows Service is already installed.');
  console.log('Starting the service...');
  svc.start();
});

svc.on('start', function () {
  console.log('🚀 TheSSBuddy Windows Service is RUNNING!');
  console.log('Portal Frontend: http://localhost:3001');
  console.log('Backend API: http://localhost:3000/api');
});

svc.on('error', function (err) {
  console.error('❌ Service installation error:', err);
});

console.log('Installing TheSSBuddy as a Windows Service (Automatic Startup)...');
svc.install();
