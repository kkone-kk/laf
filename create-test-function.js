// 直接在数据库中创建测试函数
const { MongoClient, ObjectId } = require('mongodb');
const axios = require('axios');

async function createTestFunction() {
  console.log('🔧 创建测试函数...');

  const DB_URI = process.env.DB_URI || 'mongodb://localhost:27017/laf-cloud';
  let client;

  try {
    // 连接数据库
    client = new MongoClient(DB_URI);
    await client.connect();
    console.log('✅ 数据库连接成功');

    const db = client.db();

    // 1. 创建测试应用（如果不存在）
    const appsCollection = db.collection('Application');
    const testApp = {
      _id: new ObjectId(),
      appid: 'test-app',
      name: '测试应用',
      state: 'Running',
      phase: 'Started',
      tags: ['test'],
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: new ObjectId(),
      regionId: new ObjectId(),
      runtimeId: new ObjectId(),
      bundleId: new ObjectId()
    };

    const existingApp = await appsCollection.findOne({ appid: 'test-app' });
    if (!existingApp) {
      await appsCollection.insertOne(testApp);
      console.log('✅ 测试应用创建成功');
    } else {
      console.log('📋 测试应用已存在');
    }

    // 2. 创建测试函数
    const functionsCollection = db.collection('CloudFunction');
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
        version: 0
      },
      desc: '测试Hello World函数',
      methods: ['GET', 'POST'],
      tags: ['test'],
      state: 'RUNNING',
      websocket: false,
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: new ObjectId()
    };

    // 检查函数是否已存在
    const existingFunction = await functionsCollection.findOne({
      appid: 'test-app',
      name: 'hello-world'
    });

    if (existingFunction) {
      // 更新现有函数
      await functionsCollection.updateOne(
        { _id: existingFunction._id },
        {
          $set: {
            source: testFunction.source,
            state: 'RUNNING',
            updatedAt: new Date()
          }
        }
      );
      console.log('✅ 测试函数已更新');
      testFunction._id = existingFunction._id;
    } else {
      await functionsCollection.insertOne(testFunction);
      console.log('✅ 测试函数创建成功');
    }

    // 3. 发布函数到运行时集合
    const publishedFunctionsCollection = db.collection('__functions__');

    // 删除旧的发布版本
    await publishedFunctionsCollection.deleteMany({
      appid: 'test-app',
      name: 'hello-world'
    });

    // 插入新的发布版本
    const publishedFunction = {
      ...testFunction,
      _id: testFunction._id // 保持相同的ID
    };

    await publishedFunctionsCollection.insertOne(publishedFunction);
    console.log('✅ 函数发布到运行时成功');

    // 4. 验证发布
    const publishedCount = await publishedFunctionsCollection.countDocuments({
      appid: 'test-app',
      name: 'hello-world'
    });

    console.log(`📊 发布验证: 找到 ${publishedCount} 个发布的函数`);

    // 5. 创建更多测试函数
    const additionalFunctions = [
      {
        name: 'echo-test',
        desc: '回显测试函数',
        code: `exports.main = async function(ctx) {
  return {
    echo: 'This is echo function',
    received: {
      method: ctx.method,
      query: ctx.query,
      body: ctx.body,
      headers: ctx.headers
    },
    timestamp: new Date().toISOString()
  };
};`
      },
      {
        name: 'math-calc',
        desc: '数学计算函数',
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
};`
      }
    ];

    for (const funcDef of additionalFunctions) {
      const func = {
        _id: new ObjectId(),
        appid: 'test-app',
        name: funcDef.name,
        source: {
          code: funcDef.code,
          compiled: funcDef.code,
          version: 0
        },
        desc: funcDef.desc,
        methods: ['GET', 'POST'],
        tags: ['test'],
        state: 'RUNNING',
        websocket: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: new ObjectId()
      };

      // 检查是否已存在
      const existing = await functionsCollection.findOne({
        appid: 'test-app',
        name: funcDef.name
      });

      if (!existing) {
        await functionsCollection.insertOne(func);
        await publishedFunctionsCollection.insertOne(func);
        console.log(`✅ 函数 ${funcDef.name} 创建并发布成功`);
      } else {
        console.log(`📋 函数 ${funcDef.name} 已存在`);
      }
    }

    // 6. 显示所有测试函数
    console.log('\n📋 所有测试函数:');
    const allTestFunctions = await publishedFunctionsCollection.find({
      appid: 'test-app'
    }).toArray();

    allTestFunctions.forEach((func, index) => {
      console.log(`  ${index + 1}. ${func.name} (${func.state})`);
      console.log(`     描述: ${func.desc}`);
      console.log(`     方法: ${func.methods.join(', ')}`);
    });

    console.log('\n🎯 测试URL:');
    console.log('  GET  http://localhost:8000/hello-world');
    console.log('  GET  http://localhost:8000/hello-world?name=World');
    console.log('  POST http://localhost:8000/hello-world');
    console.log('  GET  http://localhost:8000/echo-test?message=Hello');
    console.log('  GET  http://localhost:8000/math-calc?a=10&b=5&op=add');

  } catch (error) {
    console.error('❌ 创建测试函数失败:', error);
  } finally {
    if (client) {
      await client.close();
      console.log('\n📡 数据库连接已关闭');
    }
  }
}

// 测试函数调用
async function testFunctionCalls() {
  console.log('\n🧪 测试函数调用...');

  const testUrls = [
    'http://localhost:8000/hello-world',
    'http://localhost:8000/hello-world?name=World&greeting=Hi',
    'http://localhost:8000/echo-test?message=Hello%20World',
    'http://localhost:8000/math-calc?a=15&b=3&op=add',
    'http://localhost:8000/math-calc?a=20&b=4&op=div'
  ];

  for (const url of testUrls) {
    try {
      console.log(`\n🔗 测试: ${url}`);
      const response = await axios.get(url, { timeout: 5000 });
      console.log(`✅ 状态: ${response.status}`);
      console.log(`📄 响应: ${JSON.stringify(response.data, null, 2)}`);
    } catch (error) {
      if (error.response) {
        console.log(`❌ 失败: ${error.response.status} ${error.response.statusText}`);
        console.log(`📄 错误: ${error.response.data}`);
      } else {
        console.log(`❌ 网络错误: ${error.message}`);
      }
    }
  }

  // 测试POST请求
  console.log('\n🔗 测试POST请求: http://localhost:8000/echo-test');
  try {
    const postResponse = await axios.post('http://localhost:8000/echo-test', {
      message: 'Hello from POST',
      data: { test: true, number: 42 }
    }, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 5000
    });
    console.log(`✅ POST状态: ${postResponse.status}`);
    console.log(`📄 POST响应: ${JSON.stringify(postResponse.data, null, 2)}`);
  } catch (error) {
    if (error.response) {
      console.log(`❌ POST失败: ${error.response.status} ${error.response.statusText}`);
    } else {
      console.log(`❌ POST网络错误: ${error.message}`);
    }
  }
}

// 主函数
async function main() {
  console.log('🚀 创建和测试函数');
  console.log('==================\n');

  // 创建测试函数
  await createTestFunction();

  // 等待运行时加载函数
  console.log('\n⏳ 等待运行时加载函数...');
  await new Promise(resolve => setTimeout(resolve, 3000));

  // 测试函数调用
  await testFunctionCalls();

  console.log('\n✨ 测试完成！');
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = { createTestFunction, testFunctionCalls };