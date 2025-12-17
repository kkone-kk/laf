const { MongoClient } = require('mongodb');

// 测试函数运行时的基本功能
async function testFunctionRuntime() {
  console.log('🔍 测试函数运行时基本功能...\n');

  // 数据库连接配置
  const DB_URI = process.env.DB_URI || 'mongodb://localhost:27017/laf-cloud';

  let client;
  try {
    // 连接数据库
    console.log('📡 连接数据库...');
    client = new MongoClient(DB_URI);
    await client.connect();
    console.log('✅ 数据库连接成功');

    const db = client.db();

    // 检查函数集合
    console.log('\n📋 检查函数集合...');
    const functionsCollection = db.collection('__functions__');
    const functionCount = await functionsCollection.countDocuments();
    console.log(`📊 函数总数: ${functionCount}`);

    if (functionCount > 0) {
      const functions = await functionsCollection.find({}).limit(5).toArray();
      console.log('\n📝 前5个函数:');
      functions.forEach((func, index) => {
        console.log(`  ${index + 1}. ${func.name} (状态: ${func.state || 'UNKNOWN'})`);
        console.log(`     方法: ${func.methods ? func.methods.join(', ') : 'NONE'}`);
        console.log(`     应用ID: ${func.appid}`);
      });
    } else {
      console.log('⚠️  没有找到任何函数');
    }

    // 检查应用配置
    console.log('\n🔧 检查应用配置...');
    const confCollection = db.collection('__conf__');
    const confCount = await confCollection.countDocuments();
    console.log(`📊 配置项数量: ${confCount}`);

    // 检查CloudFunction集合（系统数据库）
    console.log('\n🗄️  检查系统函数集合...');
    const systemFunctionsCollection = db.collection('CloudFunction');
    const systemFunctionCount = await systemFunctionsCollection.countDocuments();
    console.log(`📊 系统函数总数: ${systemFunctionCount}`);

    if (systemFunctionCount > 0) {
      const systemFunctions = await systemFunctionsCollection.find({}).limit(3).toArray();
      console.log('\n📝 系统函数示例:');
      systemFunctions.forEach((func, index) => {
        console.log(`  ${index + 1}. ${func.name} (状态: ${func.state || 'UNKNOWN'})`);
        console.log(`     创建时间: ${func.createdAt}`);
        console.log(`     更新时间: ${func.updatedAt}`);
      });
    }

    // 测试创建一个简单的测试函数
    console.log('\n🧪 创建测试函数...');
    const testFunction = {
      appid: 'test-app',
      name: 'hello-world',
      source: {
        code: 'exports.main = async function(ctx) { return { message: "Hello World!" }; }',
        compiled: 'exports.main = async function(ctx) { return { message: "Hello World!" }; }',
        version: 0
      },
      desc: '测试函数',
      methods: ['GET', 'POST'],
      tags: ['test'],
      state: 'STOPPED',
      createdAt: new Date(),
      updatedAt: new Date()
    };

    // 检查是否已存在
    const existingFunction = await systemFunctionsCollection.findOne({
      appid: testFunction.appid,
      name: testFunction.name
    });

    if (existingFunction) {
      console.log('📋 测试函数已存在，跳过创建');
    } else {
      await systemFunctionsCollection.insertOne(testFunction);
      console.log('✅ 测试函数创建成功');

      // 发布到运行时集合
      await functionsCollection.deleteMany({ name: testFunction.name });
      await functionsCollection.insertOne(testFunction);
      console.log('✅ 测试函数发布成功');
    }

    // 验证函数是否正确发布
    const publishedFunction = await functionsCollection.findOne({
      name: 'hello-world'
    });

    if (publishedFunction) {
      console.log('✅ 函数发布验证成功');
      console.log(`   函数名: ${publishedFunction.name}`);
      console.log(`   状态: ${publishedFunction.state}`);
      console.log(`   方法: ${publishedFunction.methods.join(', ')}`);
    } else {
      console.log('❌ 函数发布验证失败');
    }

  } catch (error) {
    console.error('❌ 测试过程中发生错误:', error.message);
  } finally {
    if (client) {
      await client.close();
      console.log('\n📡 数据库连接已关闭');
    }
  }
}

// 测试运行时端口连接
async function testRuntimeConnection() {
  console.log('\n🌐 测试运行时连接...');

  const runtimePorts = [8000, 8001, 8002]; // 可能的运行时端口

  for (const port of runtimePorts) {
    try {
      const response = await fetch(`http://localhost:${port}/_/healthz`);
      if (response.ok) {
        console.log(`✅ 运行时端口 ${port} 连接成功`);

        // 测试函数调用
        try {
          const funcResponse = await fetch(`http://localhost:${port}/hello-world`, {
            method: 'GET'
          });

          if (funcResponse.ok) {
            const result = await funcResponse.text();
            console.log(`✅ 函数调用成功: ${result}`);
          } else {
            console.log(`⚠️  函数调用失败: ${funcResponse.status} ${funcResponse.statusText}`);
          }
        } catch (error) {
          console.log(`⚠️  函数调用错误: ${error.message}`);
        }

        return port;
      }
    } catch (error) {
      console.log(`❌ 运行时端口 ${port} 连接失败: ${error.message}`);
    }
  }

  console.log('❌ 所有运行时端口都无法连接');
  return null;
}

// 主测试函数
async function main() {
  console.log('🚀 函数运行时测试套件');
  console.log('========================\n');

  await testFunctionRuntime();
  await testRuntimeConnection();

  console.log('\n📋 测试总结:');
  console.log('1. 检查数据库连接和函数存储');
  console.log('2. 验证函数发布流程');
  console.log('3. 测试运行时连接和函数调用');
  console.log('\n✨ 测试完成！');
}

// 运行测试
if (require.main === module) {
  main().catch(console.error);
}

module.exports = {
  testFunctionRuntime,
  testRuntimeConnection
};