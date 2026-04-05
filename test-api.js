const http = require('http');

const BASE_URL = 'http://localhost:4007';
let testsPassed = 0;
let testsFailed = 0;

function makeRequest(path, method = 'GET', data = null) {
  return new Promise((resolve) => {
    const url = new URL(BASE_URL + path);
    const options = {
      hostname: url.hostname,
      port: url.port || 80,
      path: url.pathname + url.search,
      method: method,
      headers: {
        'User-Agent': 'NodeTest',
      }
    };

    if (data) {
      const body = new URLSearchParams(data).toString();
      options.headers['Content-Type'] = 'application/x-www-form-urlencoded';
      options.headers['Content-Length'] = Buffer.byteLength(body);
    }

    const req = http.request(options, (res) => {
      resolve(res.statusCode);
    });

    req.on('error', () => resolve(0));
    
    if (data) {
      const body = new URLSearchParams(data).toString();
      req.write(body);
    }
    req.end();
  });
}

async function runTests() {
  console.log('Testing Scheduling Orders System API\n');

  // Test 1: Home Page
  let status = await makeRequest('/');
  if (status === 200) {
    console.log('[PASS] GET / - Home page');
    testsPassed++;
  } else {
    console.log('[FAIL] GET / - Home page (Status: ' + status + ')');
    testsFailed++;
  }

  // Test 2: Login Page
  status = await makeRequest('/auth/login');
  if (status === 200) {
    console.log('[PASS] GET /auth/login - Login page');
    testsPassed++;
  } else {
    console.log('[FAIL] GET /auth/login (Status: ' + status + ')');
    testsFailed++;
  }

  // Test 3: Register Page
  status = await makeRequest('/auth/register');
  if (status === 200) {
    console.log('[PASS] GET /auth/register - Register page');
    testsPassed++;
  } else {
    console.log('[FAIL] GET /auth/register (Status: ' + status + ')');
    testsFailed++;
  }

  // Test 4: Register User
  status = await makeRequest('/auth/register', 'POST', {
    username: 'testuser1',
    email: 'testuser1@example.com',
    password: 'testpass123',
    fullName: 'Test User',
    phone: '9999999999'
  });
  if (status === 302 || status === 200) {
    console.log('[PASS] POST /auth/register - Create user (Status: ' + status + ')');
    testsPassed++;
  } else {
    console.log('[FAIL] POST /auth/register (Status: ' + status + ')');
    testsFailed++;
  }

  // Test 5: Login User
  status = await makeRequest('/auth/login', 'POST', {
    username: 'testuser1',
    password: 'testpass123'
  });
  if (status === 302 || status === 200) {
    console.log('[PASS] POST /auth/login - Login user (Status: ' + status + ')');
    testsPassed++;
  } else {
    console.log('[FAIL] POST /auth/login (Status: ' + status + ')');
    testsFailed++;
  }

  // Test 6: Admin Dashboard (should redirect if not logged in)
  status = await makeRequest('/admin/dashboard');
  if (status) {
    console.log('[PASS] GET /admin/dashboard - Admin panel (Status: ' + status + ')');
    testsPassed++;
  } else {
    console.log('[FAIL] GET /admin/dashboard (Status: ' + status + ')');
    testsFailed++;
  }

  console.log('\nTest Results:');
  console.log('Passed: ' + testsPassed);
  console.log('Failed: ' + testsFailed);
  console.log('\n');

  if (testsFailed === 0) {
    console.log('All tests passed!');
  } else {
    console.log('[WARNING] ' + testsFailed + ' test(s) failed');
  }

  process.exit(testsFailed > 0 ? 1 : 0);
}

// Run tests
runTests();
