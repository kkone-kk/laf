const http = require('http');

// Test if local gateway is working
console.log('Testing local gateway...');

// Test 1: Direct access to gateway
const testGateway = () => {
  return new Promise((resolve, reject) => {
    const req = http.request({
      hostname: 'localhost',
      port: 8081,
      path: '/',
      method: 'GET'
    }, (res) => {
      console.log(`Gateway response status: ${res.statusCode}`);
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        console.log(`Gateway response: ${data}`);
        resolve(data);
      });
    });

    req.on('error', (err) => {
      console.log(`Gateway error: ${err.message}`);
      reject(err);
    });

    req.end();
  });
};

// Test 2: Access with app domain
const testAppDomain = () => {
  return new Promise((resolve, reject) => {
    const req = http.request({
      hostname: 'localhost',
      port: 8081,
      path: '/chatgpt',
      method: 'GET',
      headers: {
        'Host': 'n1l49m.127.0.0.1.nip.io'
      }
    }, (res) => {
      console.log(`App domain response status: ${res.statusCode}`);
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        console.log(`App domain response: ${data}`);
        resolve(data);
      });
    });

    req.on('error', (err) => {
      console.log(`App domain error: ${err.message}`);
      reject(err);
    });

    req.end();
  });
};

// Test 3: Check if any process is listening on expected ports
const testPorts = async () => {
  console.log('\nTesting ports 10000-10010...');
  for (let port = 10000; port <= 10010; port++) {
    try {
      await new Promise((resolve, reject) => {
        const req = http.request({
          hostname: 'localhost',
          port: port,
          path: '/',
          method: 'GET',
          timeout: 1000
        }, (res) => {
          console.log(`Port ${port}: HTTP ${res.statusCode}`);
          resolve();
        });

        req.on('error', () => resolve()); // Ignore errors
        req.on('timeout', () => resolve());
        req.end();
      });
    } catch (err) {
      // Ignore
    }
  }
};

(async () => {
  try {
    await testGateway();
    await testAppDomain();
    await testPorts();
  } catch (err) {
    console.error('Test failed:', err);
  }
})();