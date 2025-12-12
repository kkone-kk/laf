const { MongoClient } = require('mongodb');

(async () => {
  const client = new MongoClient('mongodb://admin:123456@localhost:27017?authSource=admin');
  await client.connect();
  const db = client.db('laf');

  console.log('=== Applications ===');
  const apps = await db.collection('Application').find({}).toArray();
  apps.forEach(app => {
    console.log(`App: ${app.appid}, State: ${app.state}, Phase: ${app.phase}`);
  });

  console.log('\n=== Functions ===');
  const functions = await db.collection('CloudFunction').find({}).toArray();
  functions.forEach(func => {
    console.log(`Function: ${func.name}, App: ${func.appid}`);
  });

  await client.close();
})().catch(console.error);