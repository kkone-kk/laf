const axios = require('axios');

async function testCreatedFunctions() {
  console.log('🧪 测试已创建的函数...\n');

  const testUrls = [
    'http://localhost:8000/hello-world',
    'http://localhost:8000/hello-world?name=World&greeting=Hi',
    'http://localhost:8000/echo-test?message=Hello%20World'
  ];

  for (const url of testUrls) {
    try {
      console.log(`🔗 测试: ${url}`);
      const response = await axios.get(url, { timeout: 5000 });
      console.log(`✅ 状态: ${response.status}`);
      console.log(`📄 响应: ${JSON.stringify(response.data, null, 2)}\n`);
    } catch (error) {
      if (error.response) {
        console.log(`❌ 失败: ${error.response.status} ${error.response.statusText}`);
        console.log(`📄 错误: ${error.response.data}\n`);
      } else {
        console.log(`❌ 网络错误: ${error.message}\n`);
      }
    }
  }

  // 测试POST请求
  console.log('🔗 测试POST请求: http://localhost:8000/echo-test');
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
      console.log(`📄 POST错误: ${error.response.data}`);
    } else {
      console.log(`❌ POST网络错误: ${error.message}`);
    }
  }
}

testCreatedFunctions().catch(console.error);