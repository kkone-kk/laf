const { spawn } = require('child_process');

console.log('🔧 Quick Server Test');
console.log('===================');

const server = spawn('npm', ['run', 'dev'], {
  cwd: './server',
  stdio: 'pipe',
  shell: true
});

let output = '';
let hasError = false;
let serverStarted = false;

const timeout = setTimeout(() => {
  server.kill();
  console.log('\n📊 Results:');
  console.log(`Server started: ${serverStarted ? '✅' : '❌'}`);
  console.log(`No errors: ${!hasError ? '✅' : '❌'}`);

  if (hasError) {
    console.log('\n❌ Errors detected in output:');
    const lines = output.split('\n');
    const errorLines = lines.filter(line =>
      line.includes('ERROR') ||
      line.includes('EADDRINUSE') ||
      line.includes('uncaughtException')
    );
    errorLines.forEach(line => console.log(line));
  }

  process.exit(hasError ? 1 : 0);
}, 15000);

server.stdout.on('data', (data) => {
  const text = data.toString();
  output += text;

  if (text.includes('Nest application successfully started')) {
    serverStarted = true;
    console.log('✅ Server started successfully');
  }

  if (text.includes('Change streams not supported') &&
    text.includes('MongoDB is not running as a replica set')) {
    console.log('✅ Change streams handled gracefully');
  }

  if (text.includes('Storage server') && text.includes('listened on')) {
    console.log('✅ Storage server started');
  }
});

server.stderr.on('data', (data) => {
  const text = data.toString();
  output += text;

  if (text.includes('ERROR') || text.includes('EADDRINUSE') || text.includes('uncaughtException')) {
    hasError = true;
  }
});

server.on('close', () => {
  clearTimeout(timeout);
  console.log('\n📊 Results:');
  console.log(`Server started: ${serverStarted ? '✅' : '❌'}`);
  console.log(`No errors: ${!hasError ? '✅' : '❌'}`);
  process.exit(hasError ? 1 : 0);
});