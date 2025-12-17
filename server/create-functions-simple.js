console.log('🚀 开始创建测试函数')

const { MongoClient, ObjectId } = require('mongodb')

async function main() {
  console.log('🔧 创建测试函数...')

  const DB_URI =
    process.env.DATABASE_URL ||
    'mongodb://admin:123456@localhost:27017/laf?authSource=admin'
  let client

  try {
    // 连接数据库
    client = new MongoClient(DB_URI)
    await client.connect()
    console.log('✅ 数据库连接成功')

    const db = client.db()

    // 创建测试函数
    const publishedFunctionsCollection = db.collection('__functions__')

    // 删除旧的测试函数
    await publishedFunctionsCollection.deleteMany({ appid: 'test-app' })
    console.log('🗑️ 清理旧的测试函数')

    // 创建新的测试函数
    const testFunction = {
      _id: new ObjectId(),
      appid: 'test-app',
      name: 'hello-world',
      source: {
        code: `exports.main = async function(ctx) {
  console.log('Hello World function called!');
  return {
    message: 'Hello World!',
    method: ctx.method,
    query: ctx.query,
    body: ctx.body,
    timestamp: new Date().toISOString()
  };
};`,
        compiled: `exports.main = async function(ctx) {
  console.log('Hello World function called!');
  return {
    message: 'Hello World!',
    method: ctx.method,
    query: ctx.query,
    body: ctx.body,
    timestamp: new Date().toISOString()
  };
};`,
        version: 0,
      },
      desc: '测试Hello World函数',
      methods: ['GET', 'POST'],
      tags: ['test'],
      state: 'RUNNING',
      websocket: false,
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: new ObjectId(),
    }

    await publishedFunctionsCollection.insertOne(testFunction)
    console.log('✅ hello-world 函数创建成功')

    // 创建更多测试函数
    const echoFunction = {
      _id: new ObjectId(),
      appid: 'test-app',
      name: 'echo-test',
      source: {
        code: `exports.main = async function(ctx) {
  return {
    echo: 'This is echo function',
    received: {
      method: ctx.method,
      query: ctx.query,
      body: ctx.body
    },
    timestamp: new Date().toISOString()
  };
};`,
        compiled: `exports.main = async function(ctx) {
  return {
    echo: 'This is echo function',
    received: {
      method: ctx.method,
      query: ctx.query,
      body: ctx.body
    },
    timestamp: new Date().toISOString()
  };
};`,
        version: 0,
      },
      desc: '回显测试函数',
      methods: ['GET', 'POST'],
      tags: ['test'],
      state: 'RUNNING',
      websocket: false,
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: new ObjectId(),
    }

    await publishedFunctionsCollection.insertOne(echoFunction)
    console.log('✅ echo-test 函数创建成功')

    // 验证创建结果
    const functionCount = await publishedFunctionsCollection.countDocuments({
      appid: 'test-app',
    })
    console.log(`📊 总共创建了 ${functionCount} 个测试函数`)

    console.log('\n🎯 测试URL:')
    console.log('  GET  http://localhost:8000/hello-world')
    console.log('  GET  http://localhost:8000/hello-world?name=World')
    console.log('  POST http://localhost:8000/hello-world')
    console.log('  GET  http://localhost:8000/echo-test?message=Hello')
  } catch (error) {
    console.error('❌ 创建测试函数失败:', error)
  } finally {
    if (client) {
      await client.close()
      console.log('📡 数据库连接已关闭')
    }
  }
}

main().catch(console.error)
