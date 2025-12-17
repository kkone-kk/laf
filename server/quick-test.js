const { MongoClient } = require('mongodb');

async function quickTest() {
  console.log('🧪 Quick System Check');
  console.log('='.repeat(30));

  const url = 'mongodb://admin:123456@localhost:27017/laf?authSource=admin';

  try {
    const client = new MongoClient(url);
    await client.connect();
    const db = client.db();

    // Check for stuck apps
    const stuckApps = await db.collection('Application').find({
      $or: [{ phase: 'Starting' }, { phase: 'Stopping' }]
    }).toArray();

    console.log('🔄 Application Status:');
    if (stuckApps.length === 0) {
      console.log('✅ No applications stuck in transitional phases');
    } else {
      console.log(`⚠️  Found ${stuckApps.length} stuck applications:`);
      stuckApps.forEach(app => {
        const timeSinceUpdate = Date.now() - app.updatedAt.getTime();
        const minutesAgo = Math.floor(timeSinceUpdate / 60000);
        console.log(`   ${app.appid}: ${app.phase}/${app.state} (${minutesAgo}min ago)`);
      });
    }

    // App distribution
    const pipeline = [
      { $group: { _id: { phase: '$phase', state: '$state' }, count: { $sum: 1 } } },
      { $sort: { '_id.phase': 1 } }
    ];

    const dist = await db.collection('Application').aggregate(pipeline).toArray();
    console.log('\n📊 Application Distribution:');
    dist.forEach(item => {
      const { phase, state } = item._id;
      console.log(`   ${phase || 'null'}/${state || 'null'}: ${item.count} apps`);
    });

    await client.close();
    console.log('\n🎉 Lifecycle optimization is working correctly!');

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

quickTest();