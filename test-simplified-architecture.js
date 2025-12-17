// 测试简化架构的函数创建和缓存刷新
const { MongoClient, ObjectId } = require('mongodb');
const axios = require('axios');

async function testSimplifiedArchitecture() {
  console.log('🚀 测试简化架构的函数创建和缓存刷新...');

  const DB_URI = process.env.DATABASE_URL || 'mongodb://admin:123456@localhost:27017/laf?authSource=admin';
  let client;

  try {
    client = new MongoClient(DB_URI);
    await client.connect();
    console.log('✅ 数据库连接成功');

    const db = client.db();

    // 创建一个测试函数
    console.log('\\n📝 创建测试函数...');
    const testFunction = {
      _id: new ObjectId(),
      appid: 'test-app',
      name: 'simplified-test',
      source: {
        code: `exports.main = async function(ctx) {
  return {
    message: 'Hello from simplified architecture!',
    method: ctx.method,
    query: ctx.query,
    body: ctx.body,
    architecture: 'simplified-local-single-device',
    timestamp: new Date().toISOString()
  };
};`,
        compiled: `exports.main = async function(ctx) {
  return {
    message: 'Hello from simplified architecture!',
    method: ctx.method,
    query: ctx.query,
    body: ctx.body,
    architecture: 'simplified-local-single-device',
    timestamp: new Date().toISOString()
  };
};`,
        version: 0
      },
      desc: '简化架构测试函数',
      methods: ['GET', 'POST'],
      tags: ['simplified', 'local', 'test'],
      state: 'RUNNING',
      websocket: false,
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: new ObjectId()
    };

    // 直接发布到 __functions__ 集合
    console.log('\\n📤 发布函数到 __functions__ 集合...');
    const publishedFunctionsCollection = db.collection('__functions__');

    // 删除旧版本
    await publishedFunctionsCollection.deleteMany({
      appid: 'test-app',
      name: 'simplified-test'
    });

    // 发布新版本
    await publishedFunctionsCollection.insertOne(testFunction);
    console.log('✅ 函数已发布');

    // 测试运行时缓存刷新API
    console.log('\\n🔄 测试运行时缓存刷新API...');
    const runtimePorts = [8000, 8001, 8002];
    let cacheRefreshed = false;

    for (const port of runtimePorts) {
      try {
        console.log(`🔗 尝试端口 ${port}...`);
        const refreshResponse = await axios.post(`http://localhost:${port}/_/refresh-cache`, {}, {
          timeout: 5000,
          headers: { 'Content-Type': 'application/json' }
        });

        if (refreshResponse.status === 200) {
          console.log(`✅ 端口 ${port} 缓存刷新成功`);
          console.log(`📄 响应: ${JSON.stringify(refreshResponse.data)}`);
          cacheRefreshed = true;
          break;
        }
      } catch (error) {
        console.log(`❌ 端口 ${port} 不可用: ${error.message}`);
        continue;
      }
    }

    if (!cacheRefreshed) {
      console.log('⚠️  所有运行时端口都不可用，但这在开发环境中是正常的');
      console.log('💡 请确保运行时服务已启动');
      return false;
    }

    // 等待缓存生效
    console.log('\\n⏳ 等待缓存生效...');
    await new Promise(resolve => setTimeout(resolve, 2000));

    // 测试函数调用
    console.log('\\n🧪 测试函数调用...');
    const workingPort = runtimePorts.find(async port => {
      try {
        await axios.get(`http://localhost:${port}/_/healthz`, { timeout: 3000 });
        return true;
      } catch {
        return false;
      }
    });

    if (workingPort) {
      try {
        const response = await axios.get(`http://localhost:${workingPort}/simplified-test?test=architecture`, {
          timeout: 5000
        });

        console.log(`✅ 函数调用成功: ${response.status}`);
        console.log(`📄 响应: ${JSON.stringify(response.data, null, 2)}`);

        if (response.data.architecture === 'simplified-local-single-device') {
          console.log('✅ 简化架构验证成功');
          return true;
        }
      } catch (error) {
        if (error.response) {
          console.log(`❌ 函数调用失败: ${error.response.status} ${error.response.statusText}`);
        } else {
          console.log(`❌ 网络错误: ${error.message}`);
        }
      }
    }

    return false;

  } catch (error) {
    console.error('❌ 测试执行失败:', error);
    return false;
  } finally {
    if (client) {
      await client.close();
      console.log('\\n📡 数据库连接已关闭');
    }
  }
}

async function main() {
  console.log('🎯 简化架构测试');
  console.log('================\\n');

  const success = await testSimplifiedArchitecture();

  if (success) {
    console.log('\\n🎉 简化架构测试成功！');
    console.log('\\n✨ 架构优化总结:');
    console.log('1. ✅ 移除了复杂的模块依赖');
    console.log('2. ✅ 直接在 FunctionService 中实现缓存刷新');
    console.log('3. ✅ 适配本地单设备运行模式');
    console.log('4. ✅ 保持了核心功能完整性');
    console.log('5. ✅ 简化了依赖注入逻辑');
  } else {
    console.log('\\n❌ 简化架构测试失败');
    console.log('\\n🔧 可能需要检查:');
    console.log('- 运行时服务是否启动');
    console.log('- 数据库连接是否正常');
    console.log('- 服务器是否正常运行');
  }

  console.log('\\n✨ 测试完成');
}

main().catch(console.error);