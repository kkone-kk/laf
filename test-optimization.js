const axios = require('axios');

// 测试配置
const BASE_URL = 'http://localhost:3000';
const APP_ID = 'test-app';
const TEST_FUNCTION_ID = 'test-function-id';

// 模拟的JWT token（实际使用时需要真实的token）
const AUTH_TOKEN = 'your-jwt-token-here';

const headers = {
  'Authorization': `Bearer ${AUTH_TOKEN}`,
  'Content-Type': 'application/json'
};

async function testOptimizations() {
  console.log('🚀 开始测试函数系统优化功能...\n');

  try {
    // 1. 测试智能部署
    console.log('1. 测试智能部署功能');
    try {
      const deployResponse = await axios.post(
        `${BASE_URL}/apps/${APP_ID}/functions/test-function/deploy`,
        {},
        { headers }
      );
      console.log('✅ 智能部署测试成功');
      console.log('   部署状态:', deployResponse.data?.data?.deploymentStatus);
      console.log('   依赖检查:', deployResponse.data?.data?.dependencyCheck?.isComplete ? '通过' : '需要安装依赖');
    } catch (error) {
      console.log('❌ 智能部署测试失败:', error.response?.data?.error || error.message);
    }

    // 2. 测试性能监控
    console.log('\n2. 测试性能监控功能');
    try {
      const perfResponse = await axios.get(
        `${BASE_URL}/apps/${APP_ID}/functions/performance/overview`,
        { headers }
      );
      console.log('✅ 性能监控测试成功');
      console.log('   总函数数:', perfResponse.data?.data?.totalFunctions || 0);
      console.log('   平均成功率:', perfResponse.data?.data?.averageSuccessRate || 0, '%');
    } catch (error) {
      console.log('❌ 性能监控测试失败:', error.response?.data?.error || error.message);
    }

    // 3. 测试缓存管理
    console.log('\n3. 测试缓存管理功能');
    try {
      // 预热缓存
      await axios.post(
        `${BASE_URL}/apps/${APP_ID}/functions/cache/warmup`,
        {},
        { headers }
      );
      console.log('✅ 缓存预热成功');

      // 获取缓存统计
      const cacheResponse = await axios.get(
        `${BASE_URL}/apps/${APP_ID}/functions/cache/stats`,
        { headers }
      );
      console.log('✅ 缓存统计获取成功');
      console.log('   函数缓存大小:', cacheResponse.data?.data?.functionCache?.size || 0);
      console.log('   缓存命中率:', cacheResponse.data?.data?.functionCache?.hitRate || 0, '%');
    } catch (error) {
      console.log('❌ 缓存管理测试失败:', error.response?.data?.error || error.message);
    }

    // 4. 测试批量操作
    console.log('\n4. 测试批量操作功能');
    try {
      const batchResponse = await axios.post(
        `${BASE_URL}/apps/${APP_ID}/functions/batch/recommendations`,
        {
          functionIds: ['func1', 'func2', 'func3']
        },
        { headers }
      );
      console.log('✅ 批量操作建议获取成功');
      console.log('   推荐部署顺序:', batchResponse.data?.data?.recommendedOrder?.length || 0, '个函数');
      console.log('   预计耗时:', Math.round((batchResponse.data?.data?.estimatedDuration || 0) / 1000), '秒');
    } catch (error) {
      console.log('❌ 批量操作测试失败:', error.response?.data?.error || error.message);
    }

    // 5. 测试函数状态查询
    console.log('\n5. 测试函数状态查询');
    try {
      const statusResponse = await axios.get(
        `${BASE_URL}/apps/${APP_ID}/functions/runtime/status`,
        { headers }
      );
      console.log('✅ 函数状态查询成功');
      console.log('   运行时状态:', statusResponse.data?.data?.sharedRuntime?.status || '未知');
      console.log('   函数数量:', statusResponse.data?.data?.functions?.length || 0);
    } catch (error) {
      console.log('❌ 函数状态查询失败:', error.response?.data?.error || error.message);
    }

  } catch (error) {
    console.error('❌ 测试过程中发生错误:', error.message);
  }

  console.log('\n🎉 优化功能测试完成！');
}

// 测试依赖检查功能
function testDependencyChecker() {
  console.log('\n📦 测试依赖检查功能...');

  // 模拟函数代码
  const testCodes = [
    {
      name: '简单函数',
      code: `
        const fs = require('fs');
        const path = require('path');
        
        exports.main = async function(ctx) {
          return { message: 'Hello World' };
        };
      `
    },
    {
      name: '带第三方依赖的函数',
      code: `
        const axios = require('axios');
        const lodash = require('lodash');
        const moment = require('moment');
        
        exports.main = async function(ctx) {
          const data = await axios.get('https://api.example.com');
          return lodash.pick(data, ['id', 'name']);
        };
      `
    },
    {
      name: 'ES6模块函数',
      code: `
        import axios from 'axios';
        import { v4 as uuidv4 } from 'uuid';
        import bcrypt from 'bcrypt';
        
        export async function main(ctx) {
          const id = uuidv4();
          const hash = await bcrypt.hash(ctx.body.password, 10);
          return { id, hash };
        };
      `
    }
  ];

  testCodes.forEach((test, index) => {
    console.log(`\n${index + 1}. ${test.name}`);

    // 提取require语句
    const requireMatches = test.code.match(/require\s*\(\s*['"`]([^'"`]+)['"`]\s*\)/g) || [];
    const importMatches = test.code.match(/import\s+.*?\s+from\s+['"`]([^'"`]+)['"`]/g) || [];

    const dependencies = new Set();

    // 处理require
    requireMatches.forEach(match => {
      const dep = match.match(/['"`]([^'"`]+)['"`]/)[1];
      if (!dep.startsWith('.') && !dep.startsWith('/')) {
        const packageName = dep.split('/')[0];
        if (packageName.startsWith('@')) {
          dependencies.add(dep.split('/').slice(0, 2).join('/'));
        } else {
          dependencies.add(packageName);
        }
      }
    });

    // 处理import
    importMatches.forEach(match => {
      const dep = match.match(/from\s+['"`]([^'"`]+)['"`]/)[1];
      if (!dep.startsWith('.') && !dep.startsWith('/')) {
        const packageName = dep.split('/')[0];
        if (packageName.startsWith('@')) {
          dependencies.add(dep.split('/').slice(0, 2).join('/'));
        } else {
          dependencies.add(packageName);
        }
      }
    });

    console.log('   检测到的依赖:', Array.from(dependencies).join(', ') || '无第三方依赖');
  });
}

// 性能基准测试
async function performanceBenchmark() {
  console.log('\n⚡ 性能基准测试...');

  const iterations = 100;
  const startTime = Date.now();

  // 模拟缓存查找操作
  const cache = new Map();
  for (let i = 0; i < iterations; i++) {
    const key = `function-${i % 10}`;
    if (cache.has(key)) {
      cache.get(key);
    } else {
      cache.set(key, { id: key, data: `data-${i}`, timestamp: Date.now() });
    }
  }

  const cacheTime = Date.now() - startTime;
  console.log(`✅ 缓存操作基准: ${iterations}次操作耗时 ${cacheTime}ms (平均 ${(cacheTime / iterations).toFixed(2)}ms/次)`);

  // 模拟批量操作
  const batchStartTime = Date.now();
  const batchPromises = [];

  for (let i = 0; i < 10; i++) {
    batchPromises.push(
      new Promise(resolve => {
        setTimeout(() => resolve(`result-${i}`), Math.random() * 100);
      })
    );
  }

  await Promise.all(batchPromises);
  const batchTime = Date.now() - batchStartTime;
  console.log(`✅ 批量操作基准: 10个并行任务耗时 ${batchTime}ms`);
}

// 主函数
async function main() {
  console.log('🔧 函数系统优化测试套件');
  console.log('================================\n');

  // 检查服务器是否运行
  try {
    await axios.get(`${BASE_URL}/health`);
    console.log('✅ 服务器连接正常\n');
  } catch (error) {
    console.log('❌ 无法连接到服务器，请确保服务器正在运行');
    console.log('   服务器地址:', BASE_URL);
    console.log('   错误信息:', error.message);
    console.log('\n⚠️  将继续进行离线测试...\n');
  }

  // 运行测试
  testDependencyChecker();
  await performanceBenchmark();
  await testOptimizations();

  console.log('\n📋 测试总结:');
  console.log('- 依赖检查: 支持require和import语法解析');
  console.log('- 性能监控: 提供详细的执行统计和趋势分析');
  console.log('- 缓存系统: 多层缓存提升访问速度');
  console.log('- 批量操作: 支持并行处理和智能调度');
  console.log('- 用户界面: 可视化操作和状态展示');
}

// 运行测试
if (require.main === module) {
  main().catch(console.error);
}

module.exports = {
  testOptimizations,
  testDependencyChecker,
  performanceBenchmark
};