const { MongoClient } = require('mongodb');

(async () => {
  const client = new MongoClient('mongodb://admin:123456@localhost:27017?authSource=admin');
  await client.connect();
  const db = client.db('laf');

  console.log('=== Applications with Running state ===');
  const apps = await db.collection('Application').find({
    state: 'Running',
    phase: 'Started'
  }).toArray();

  apps.forEach(app => {
    console.log(`App: ${app.appid}, State: ${app.state}, Phase: ${app.phase}, Created: ${app.createdAt}`);
  });

  console.log('\n=== Runtime Domains ===');
  const domains = await db.collection('RuntimeDomain').find({}).toArray();
  domains.forEach(domain => {
    console.log(`Domain: ${domain.domain}, App: ${domain.appid}, State: ${domain.state}, Phase: ${domain.phase}`);
  });

  await client.close();
})().catch(console.error);