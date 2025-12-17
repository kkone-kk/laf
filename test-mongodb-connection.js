const { MongoClient } = require('mongodb');

async function testConnection() {
  const uri = 'mongodb://admin:123456@localhost:27017/laf?authSource=admin';

  try {
    console.log('🔗 连接MongoDB...');
    const client = new MongoClient(uri);
    await client.connect();

    console.log('✅ MongoDB连接成功');

    // 测试数据库操作
    const db = client.db('laf');
    const result = await db.admin().ping();
    console.log('✅ MongoDB ping成功:', result);

    // 检查集合
    const collections = await db.listCollections().toArray();
    console.log(`📊 数据库中有 ${collections.length} 个集合`);

    await client.close();
    console.log('📡 连接已关闭');

    return true;
  } catch (error) {
    console.error('❌ MongoDB连接失败:', error.message);
    return false;
  }
}

testConnection().then(success => {
  if (success) {
    console.log('🎉 MongoDB测试成功');
  } else {
    console.log('💥 MongoDB测试失败');
  }
});