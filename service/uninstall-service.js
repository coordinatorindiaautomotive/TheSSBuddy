// service/uninstall-service.js
const { Service } = require('node-windows');
const path = require('path');

const svc = new Service({
  name: 'TheSSBuddyPortal',
  script: path.join(__dirname, 'service-runner.js'),
});

svc.on('uninstall', function () {
  console.log('✅ TheSSBuddy Windows Service uninstalled successfully.');
  console.log('The service has been removed from services.msc.');
});

svc.on('error', function (err) {
  console.error('❌ Service uninstall error:', err);
});

console.log('Uninstalling TheSSBuddy Windows Service...');
svc.uninstall();
