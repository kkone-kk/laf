const { MongoClient } = require('mongodb');

(async () => {
  const client = new MongoClient('mongodb://admin:123456@localhost:27017?authSource=admin');
  await client.connect();
  const db = client.db('laf');

  console.log('=== Runtime Domains ===');
  const domains = await db.collection('RuntimeDomain').find({}).toArray();
  domains.forEach(domain => {
    console.log(`Domain: ${domain.domain}, App: ${domain.appid}, State: ${domain.state}, Phase: ${domain.phase}`);
  });

  await client.close();
})().catch(console.error);