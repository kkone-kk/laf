console.log('🚀 测试脚本开始')

const { MongoClient } = require('mongodb')

async function testConnection() {
  console.log('🔧 测试数据库连接...')

  const DB_URI =
    process.env.DATABASE_URL ||
    'mongodb://admin:123456@localhost:27017/laf?authSource=admin'
  console.log('📡 数据库URI:', DB_URI)

  let client
  try {
    client = new MongoClient(DB_URI)
    await client.connect()
    console.log('✅ 数据库连接成功')

    const db = client.db()
    const collections = await db.listCollections().toArray()
    console.log('📋 数据库集合数量:', collections.length)

    // 查看是否有函数集合
    const functionsCollection = db.collection('__functions__')
    const functionCount = await functionsCollection.countDocuments()
    console.log('📊 现有函数数量:', functionCount)
  } catch (error) {
    console.error('❌ 数据库连接失败:', error.message)
  } finally {
    if (client) {
      await client.close()
      console.log('📡 数据库连接已关闭')
    }
  }
}

testConnection().catch(console.error)
