const axios = require('axios');

async function debugRuntime() {
  console.log('🔍 调试运行时状态...\n');

  // 1. 检查运行时健康状态
  try {
    console.log('🏥 检查运行时健康状态...');
    const healthResponse = await axios.get('http://localhost:8000/_/healthz', { timeout: 3000 });
    console.log(`✅ 运行时健康状态: ${healthResponse.status}`);
    console.log(`📄 健康检查响应: ${JSON.stringify(healthResponse.data)}\n`);
  } catch (error) {
    console.log(`❌ 运行时健康检查失败: ${error.message}\n`);
    return;
  }

  // 2. 尝试访问运行时的调试端点（如果有的话）
  const debugEndpoints = [
    'http://localhost:8000/_/functions',
    'http://localhost:8000/_/status',
    'http://localhost:8000/_/info',
    'http://localhost:8000/_/debug'
  ];

  for (const endpoint of debugEndpoints) {
    try {
      console.log(`🔗 尝试访问: ${endpoint}`);
      const response = await axios.get(endpoint, { timeout: 3000 });
      console.log(`✅ 状态: ${response.status}`);
      console.log(`📄 响应: ${JSON.stringify(response.data, null, 2)}\n`);
    } catch (error) {
      if (error.response) {
        console.log(`⚠️  ${endpoint} 返回: ${error.response.status} ${error.response.statusText}\n`);
      } else {
        console.log(`❌ ${endpoint} 错误: ${error.message}\n`);
      }
    }
  }

  // 3. 尝试访问根路径
  try {
    console.log('🔗 尝试访问根路径: http://localhost:8000/');
    const rootResponse = await axios.get('http://localhost:8000/', { timeout: 3000 });
    console.log(`✅ 根路径状态: ${rootResponse.status}`);
    console.log(`📄 根路径响应: ${JSON.stringify(rootResponse.data, null, 2)}\n`);
  } catch (error) {
    if (error.response) {
      console.log(`⚠️  根路径返回: ${error.response.status} ${error.response.statusText}`);
      console.log(`📄 根路径错误: ${error.response.data}\n`);
    } else {
      console.log(`❌ 根路径错误: ${error.message}\n`);
    }
  }

  // 4. 检查是否有默认的测试路由
  const testRoutes = [
    'http://localhost:8000/test',
    'http://localhost:8000/ping',
    'http://localhost:8000/version'
  ];

  for (const route of testRoutes) {
    try {
      console.log(`🔗 测试路由: ${route}`);
      const response = await axios.get(route, { timeout: 3000 });
      console.log(`✅ ${route} 状态: ${response.status}`);
      console.log(`📄 ${route} 响应: ${JSON.stringify(response.data, null, 2)}\n`);
    } catch (error) {
      if (error.response) {
        console.log(`⚠️  ${route} 返回: ${error.response.status}\n`);
      } else {
        console.log(`❌ ${route} 错误: ${error.message}\n`);
      }
    }
  }
}

debugRuntime().catch(console.error);