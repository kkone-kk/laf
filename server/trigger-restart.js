const { MongoClient } = require('mongodb');

(async () => {
  const client = new MongoClient('mongodb://admin:123456@localhost:27017?authSource=admin');
  await client.connect();
  const db = client.db('laf');

  // Trigger restart by changing application phase to Starting
  const result = await db.collection('Application').updateOne(
    { appid: 'o5qb1c' },
    {
      $set: {
        phase: 'Starting',
        updatedAt: new Date(),
        lockedAt: new Date(0) // Reset lock
      }
    }
  );

  console.log('Triggered restart for o5qb1c:', result.modifiedCount > 0 ? 'Success' : 'Failed');

  await client.close();
})().catch(console.error);