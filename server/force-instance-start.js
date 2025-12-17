const { MongoClient } = require('mongodb');

(async () => {
  const client = new MongoClient('mongodb://admin:123456@localhost:27017?authSource=admin');
  await client.connect();
  const db = client.db('laf');

  console.log('Current application status:');
  const app = await db.collection('Application').findOne({ appid: 'o5qb1c' });
  console.log(`App o5qb1c: state=${app.state}, phase=${app.phase}, updatedAt=${app.updatedAt}, lockedAt=${app.lockedAt}`);

  // Force instance task to pick up by setting correct state
  console.log('\nSetting application to Starting phase for instance task...');
  const result = await db.collection('Application').updateOne(
    { appid: 'o5qb1c' },
    {
      $set: {
        state: 'Running',
        phase: 'Starting',
        updatedAt: new Date(),
        lockedAt: new Date(0) // Reset lock to allow immediate processing
      }
    }
  );

  console.log('Update result:', result.modifiedCount > 0 ? 'Success' : 'Failed');

  // Check updated status
  const updatedApp = await db.collection('Application').findOne({ appid: 'o5qb1c' });
  console.log(`Updated app o5qb1c: state=${updatedApp.state}, phase=${updatedApp.phase}, updatedAt=${updatedApp.updatedAt}`);

  console.log('\n🔍 Now watch your server console for:');
  console.log('[InstanceTaskService] handleStartingPhase matched app o5qb1c');
  console.log('[ProcessManagerService] Starting process for o5qb1c on port XXXX');
  console.log('\nWait 10-15 seconds, then test your function again.');

  await client.close();
})().catch(console.error);