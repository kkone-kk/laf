const axios = require('axios')

async function triggerFunctionCacheRefresh() {
  console.log('🔄 尝试触发函数缓存刷新...\n')

  // 方法1: 尝试重启运行时进程
  console.log('📋 方法1: 检查运行时进程状态')

  try {
    // 检查运行时健康状态
    const healthResponse = await axios.get('http://localhost:8000/_/healthz', {
      timeout: 3000,
    })
    console.log(`✅ 运行时健康状态: ${healthResponse.status}`)

    // 尝试访问一个不存在的函数来触发缓存检查
    console.log('🔍 尝试访问函数来触发缓存检查...')
    try {
      await axios.get('http://localhost:8000/hello-world', { timeout: 3000 })
    } catch (error) {
      if (error.response && error.response.status === 404) {
        console.log('📄 函数未找到 - 这表明缓存可能为空')
      }
    }
  } catch (error) {
    console.log(`❌ 运行时不可用: ${error.message}`)
    return
  }

  // 方法2: 检查数据库中的函数
  console.log('\n📋 方法2: 检查数据库中的函数')

  const { MongoClient } = require('mongodb')
  const DB_URI =
    process.env.DATABASE_URL ||
    'mongodb://admin:123456@localhost:27017/laf?authSource=admin'

  let client
  try {
    client = new MongoClient(DB_URI)
    await client.connect()
    console.log('✅ 数据库连接成功')

    const db = client.db()
    const functionsCollection = db.collection('__functions__')

    const functions = await functionsCollection
      .find({ appid: 'test-app' })
      .toArray()
    console.log(`📊 数据库中找到 ${functions.length} 个测试函数:`)

    functions.forEach((func, index) => {
      console.log(`  ${index + 1}. ${func.name} (${func.state})`)
    })

    if (functions.length === 0) {
      console.log('⚠️  数据库中没有找到测试函数，需要重新创建')
      return false
    }
  } catch (error) {
    console.error('❌ 数据库操作失败:', error.message)
    return false
  } finally {
    if (client) {
      await client.close()
    }
  }

  return true
}

// 等待并重试函数调用
async function waitAndRetryFunctionCall() {
  console.log('\n⏳ 等待5秒后重试函数调用...')
  await new Promise((resolve) => setTimeout(resolve, 5000))

  const testUrls = [
    'http://localhost:8000/hello-world',
    'http://localhost:8000/echo-test',
  ]

  for (const url of testUrls) {
    try {
      console.log(`🔗 重试: ${url}`)
      const response = await axios.get(url, { timeout: 5000 })
      console.log(`✅ 成功: ${response.status}`)
      console.log(`📄 响应: ${JSON.stringify(response.data, null, 2)}\n`)
      return true // 如果有一个成功就返回
    } catch (error) {
      if (error.response) {
        console.log(
          `❌ 失败: ${error.response.status} ${error.response.statusText}`,
        )
      } else {
        console.log(`❌ 网络错误: ${error.message}`)
      }
    }
  }

  return false
}

async function main() {
  console.log('🚀 函数缓存诊断和修复工具')
  console.log('================================\n')

  const cacheStatus = await triggerFunctionCacheRefresh()

  if (cacheStatus) {
    const callSuccess = await waitAndRetryFunctionCall()

    if (callSuccess) {
      console.log('🎉 函数调用成功！缓存已正常工作')
    } else {
      console.log('⚠️  函数调用仍然失败，可能需要重启运行时')
      console.log('\n💡 建议操作:')
      console.log('1. 重启运行时进程')
      console.log('2. 检查运行时日志')
      console.log('3. 确认MongoDB连接正常')
      console.log('4. 检查函数缓存初始化')
    }
  }

  console.log('\n✨ 诊断完成')
}

main().catch(console.error)
