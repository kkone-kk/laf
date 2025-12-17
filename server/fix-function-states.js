const { MongoClient, ObjectId } = require('mongodb');

async function fixFunctionStates() {
  console.log('🔧 Fixing Function States');
  console.log('='.repeat(30));

  const mongoUrl = 'mongodb://admin:123456@localhost:27017/laf?authSource=admin';

  try {
    const client = new MongoClient(mongoUrl);
    await client.connect();
    const db = client.db();

    console.log('✅ Connected to database');

    // Find functions without state field
    const functionsWithoutState = await db.collection('CloudFunction').find({
      state: { $exists: false }
    }).toArray();

    console.log(`📋 Found ${functionsWithoutState.length} functions without state field`);

    if (functionsWithoutState.length > 0) {
      // Update all functions without state to STOPPED
      const result = await db.collection('CloudFunction').updateMany(
        { state: { $exists: false } },
        {
          $set: {
            state: 'STOPPED',
            updatedAt: new Date()
          }
        }
      );

      console.log(`✅ Updated ${result.modifiedCount} functions to STOPPED state`);
    }

    // Find functions with null or undefined state
    const functionsWithNullState = await db.collection('CloudFunction').find({
      $or: [
        { state: null },
        { state: undefined }
      ]
    }).toArray();

    console.log(`📋 Found ${functionsWithNullState.length} functions with null/undefined state`);

    if (functionsWithNullState.length > 0) {
      const result = await db.collection('CloudFunction').updateMany(
        {
          $or: [
            { state: null },
            { state: undefined }
          ]
        },
        {
          $set: {
            state: 'STOPPED',
            updatedAt: new Date()
          }
        }
      );

      console.log(`✅ Updated ${result.modifiedCount} functions with null state to STOPPED`);
    }

    // Show current function states
    console.log('\n📊 Current Function States:');
    const pipeline = [
      {
        $group: {
          _id: '$state',
          count: { $sum: 1 },
          functions: { $push: { name: '$name', appid: '$appid' } }
        }
      }
    ];

    const stateDistribution = await db.collection('CloudFunction').aggregate(pipeline).toArray();

    stateDistribution.forEach(item => {
      console.log(`   ${item._id || 'null'}: ${item.count} functions`);
      if (item.count <= 5) {
        item.functions.forEach(func => {
          console.log(`     - ${func.name} (${func.appid})`);
        });
      }
    });

    await client.close();
    console.log('\n🎉 Function states fixed successfully!');

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

fixFunctionStates();