const axios = require('axios');

// 测试函数调用
async function testFunctionCall() {
  console.log('🧪 测试函数调用功能...\n');

  const runtimePorts = [8000, 8001, 8002];
  let workingPort = null;

  // 1. 找到工作的运行时端口
  console.log('🔍 查找可用的运行时端口...');
  for (const port of runtimePorts) {
    try {
      const response = await axios.get(`http://localhost:${port}/_/healthz`, {
        timeout: 3000
      });

      if (response.status === 200) {
        console.log(`✅ 运行时端口 ${port} 可用`);
        workingPort = port;
        break;
      }
    } catch (error) {
      console.log(`❌ 端口 ${port} 不可用: ${error.message}`);
    }
  }

  if (!workingPort) {
    console.log('❌ 没有找到可用的运行时端口');
    return;
  }

  // 2. 测试默认函数调用
  console.log('\n🎯 测试默认函数调用...');
  try {
    const response = await axios.get(`http://localhost:${workingPort}/__default__`, {
      timeout: 5000
    });

    console.log(`✅ 默认函数调用成功: ${response.status}`);
    console.log(`📄 响应内容: ${JSON.stringify(response.data)}`);
  } catch (error) {
    if (error.response) {
      console.log(`⚠️  默认函数调用失败: ${error.response.status} ${error.response.statusText}`);
      console.log(`📄 错误内容: ${error.response.data}`);
    } else {
      console.log(`❌ 默认函数调用错误: ${error.message}`);
    }
  }

  // 3. 测试不存在的函数
  console.log('\n🎯 测试不存在的函数...');
  try {
    const response = await axios.get(`http://localhost:${workingPort}/nonexistent-function`, {
      timeout: 5000
    });

    console.log(`⚠️  意外成功: ${response.status}`);
  } catch (error) {
    if (error.response && error.response.status === 404) {
      console.log(`✅ 正确返回404: Function Not Found`);
    } else if (error.response) {
      console.log(`⚠️  意外状态码: ${error.response.status} ${error.response.statusText}`);
    } else {
      console.log(`❌ 请求错误: ${error.message}`);
    }
  }

  // 4. 测试POST请求
  console.log('\n🎯 测试POST请求...');
  try {
    const response = await axios.post(`http://localhost:${workingPort}/test-function`, {
      message: 'Hello from test'
    }, {
      timeout: 5000,
      headers: {
        'Content-Type': 'application/json'
      }
    });

    console.log(`✅ POST请求成功: ${response.status}`);
    console.log(`📄 响应内容: ${JSON.stringify(response.data)}`);
  } catch (error) {
    if (error.response) {
      console.log(`⚠️  POST请求失败: ${error.response.status} ${error.response.statusText}`);
      if (error.response.status === 404) {
        console.log(`📝 这是正常的，因为test-function不存在`);
      }
    } else {
      console.log(`❌ POST请求错误: ${error.message}`);
    }
  }

  return workingPort;
}

// 测试函数创建和调用的完整流程
async function testCompleteFlow() {
  console.log('\n🔄 测试完整的函数创建和调用流程...');

  const serverPort = 3000;
  const appId = 'test-app';

  // 模拟JWT token（实际使用时需要真实的token）
  const mockToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiJ0ZXN0LXVzZXIiLCJ0eXBlIjoiYWNjZXNzIiwiaWF0IjoxNjAwMDAwMDAwfQ.test';

  try {
    // 1. 创建一个简单的测试函数
    console.log('📝 创建测试函数...');
    const createResponse = await axios.post(`http://localhost:${serverPort}/v1/apps/${appId}/functions`, {
      name: 'hello-test',
      description: '测试函数',
      code: 'exports.main = async function(ctx) { return { message: "Hello from test function!", method: ctx.method, query: ctx.query }; }',
      methods: ['GET', 'POST']
    }, {
      headers: {
        'Authorization': `Bearer ${mockToken}`,
        'Content-Type': 'application/json'
      },
      timeout: 10000
    });

    if (createResponse.status === 200 || createResponse.status === 201) {
      console.log('✅ 函数创建成功');

      // 等待一段时间让函数发布到运行时
      console.log('⏳ 等待函数发布到运行时...');
      await new Promise(resolve => setTimeout(resolve, 3000));

      // 2. 调用创建的函数
      const workingPort = await testFunctionCall();
      if (workingPort) {
        console.log('\n🎯 测试新创建的函数...');
        try {
          const callResponse = await axios.get(`http://localhost:${workingPort}/hello-test?name=World`, {
            timeout: 5000
          });

          console.log(`✅ 函数调用成功: ${callResponse.status}`);
          console.log(`📄 响应内容: ${JSON.stringify(callResponse.data)}`);
        } catch (error) {
          if (error.response) {
            console.log(`⚠️  函数调用失败: ${error.response.status} ${error.response.statusText}`);
            console.log(`📄 错误内容: ${error.response.data}`);
          } else {
            console.log(`❌ 函数调用错误: ${error.message}`);
          }
        }
      }
    } else {
      console.log(`⚠️  函数创建失败: ${createResponse.status}`);
    }

  } catch (error) {
    if (error.response) {
      console.log(`❌ 服务器请求失败: ${error.response.status} ${error.response.statusText}`);
      if (error.response.status === 401) {
        console.log('📝 这可能是因为认证token无效，这是正常的');
      }
    } else {
      console.log(`❌ 请求错误: ${error.message}`);
      console.log('📝 请确保服务器正在运行在端口3000');
    }
  }
}

// 主测试函数
async function main() {
  console.log('🚀 函数调用测试套件');
  console.log('===================\n');

  // 基本函数调用测试
  await testFunctionCall();

  // 完整流程测试
  await testCompleteFlow();

  console.log('\n📋 测试总结:');
  console.log('1. 检查运行时健康状态');
  console.log('2. 测试函数调用机制');
  console.log('3. 验证错误处理');
  console.log('4. 测试完整的创建-调用流程');
  console.log('\n✨ 测试完成！');
}

// 运行测试
if (require.main === module) {
  main().catch(console.error);
}

module.exports = {
  testFunctionCall,
  testCompleteFlow
};