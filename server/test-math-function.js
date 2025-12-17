console.log('🚀 测试数学函数创建')

const { MongoClient, ObjectId } = require('mongodb')

async function main() {
  console.log('🔧 创建数学函数...')

  const DB_URI =
    process.env.DATABASE_URL ||
    'mongodb://admin:123456@localhost:27017/laf?authSource=admin'
  let client

  try {
    client = new MongoClient(DB_URI)
    await client.connect()
    console.log('✅ 数据库连接成功')

    const db = client.db()
    const publishedFunctionsCollection = db.collection('__functions__')

    // 创建数学函数
    const mathFunction = {
      _id: new ObjectId(),
      appid: 'test-app',
      name: 'math-calc',
      source: {
        code: `exports.main = async function(ctx) {
  const { a = 0, b = 0, op = 'add' } = ctx.query;
  const numA = parseFloat(a);
  const numB = parseFloat(b);
  
  let result;
  switch(op) {
    case 'add': result = numA + numB; break;
    case 'sub': result = numA - numB; break;
    case 'mul': result = numA * numB; break;
    case 'div': result = numB !== 0 ? numA / numB : 'Error: Division by zero'; break;
    default: result = 'Error: Invalid operation';
  }
  
  return {
    operation: op,
    operands: { a: numA, b: numB },
    result: result,
    timestamp: new Date().toISOString()
  };
};`,
        compiled: `exports.main = async function(ctx) {
  const { a = 0, b = 0, op = 'add' } = ctx.query;
  const numA = parseFloat(a);
  const numB = parseFloat(b);
  
  let result;
  switch(op) {
    case 'add': result = numA + numB; break;
    case 'sub': result = numA - numB; break;
    case 'mul': result = numA * numB; break;
    case 'div': result = numB !== 0 ? numA / numB : 'Error: Division by zero'; break;
    default: result = 'Error: Invalid operation';
  }
  
  return {
    operation: op,
    operands: { a: numA, b: numB },
    result: result,
    timestamp: new Date().toISOString()
  };
};`,
        version: 0,
      },
      desc: '数学计算函数',
      methods: ['GET', 'POST'],
      tags: ['test'],
      state: 'RUNNING',
      websocket: false,
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: new ObjectId(),
    }

    // 删除旧版本
    await publishedFunctionsCollection.deleteMany({
      appid: 'test-app',
      name: 'math-calc',
    })

    // 插入新函数
    await publishedFunctionsCollection.insertOne(mathFunction)
    console.log('✅ math-calc 函数创建成功')

    // 验证创建
    const count = await publishedFunctionsCollection.countDocuments({
      appid: 'test-app',
    })
    console.log(`📊 总共有 ${count} 个测试函数`)
  } catch (error) {
    console.error('❌ 错误:', error)
  } finally {
    if (client) {
      await client.close()
      console.log('📡 数据库连接已关闭')
    }
  }
}

main().catch(console.error)
