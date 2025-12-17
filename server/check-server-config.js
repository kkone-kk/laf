// Check ServerConfig values
require('dotenv').config();

console.log('Environment variables:');
console.log('DISABLED_INSTANCE_TASK:', process.env.DISABLED_INSTANCE_TASK);
console.log('Type:', typeof process.env.DISABLED_INSTANCE_TASK);
console.log('Comparison result:', process.env.DISABLED_INSTANCE_TASK === 'true');

// Simulate ServerConfig logic
const DISABLED_INSTANCE_TASK = process.env.DISABLED_INSTANCE_TASK === 'true';
console.log('ServerConfig.DISABLED_INSTANCE_TASK would be:', DISABLED_INSTANCE_TASK);

if (DISABLED_INSTANCE_TASK) {
  console.log('❌ Instance task is DISABLED - this is the problem!');
} else {
  console.log('✅ Instance task is ENABLED');
}