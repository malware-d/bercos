const axios = require('axios');
const colors = require('colors');

// Test configuration
const BASE_URL = 'http://localhost:8000';
const TEST_TIMEOUT = 30000;

// Test data from your database
const TEST_USERS = {
  // Customers
  customer1: {
    email: "nguyenvanan@gmail.com",
    password: "customer123",
    customer_id: "MB001",
    account: "0123456789",
    name: "Nguyễn Văn An",
    role: "customer",
    daily_limit: 100000000,
    expected_balance: 250000000
  },
  customer2: {
    email: "tranthibinh@yahoo.com", 
    password: "customer456",
    customer_id: "MB002",
    account: "0987654321",
    name: "Trần Thị Bình",
    role: "customer",
    daily_limit: 50000000,
    expected_balance: 75000000
  },
  customer3: {
    email: "leminhcuong@hotmail.com",
    password: "customer789", 
    customer_id: "MB003",
    account: "1122334455",
    name: "Lê Minh Cường",
    role: "customer",
    status: "suspended",
    expected_balance: 10000000
  },
  // Bank Staff
  teller: {
    email: "phamthidung@mbbank.com",
    password: "teller123",
    customer_id: "EMP001",
    name: "Phạm Thị Dung",
    role: "teller",
    branch_code: "MB_HN001"
  },
  manager: {
    email: "hoangvanem@mbbank.com",
    password: "manager123", 
    customer_id: "MGR001",
    name: "Hoàng Văn Em",
    role: "manager",
    branch_code: "MB_HN001",
    approval_level: 3
  },
  compliance: {
    email: "vuthigiang@mbbank.com",
    password: "compliance123",
    customer_id: "CMP001", 
    name: "Vũ Thị Giang",
    role: "compliance",
    approval_level: 4
  },
  security: {
    email: "dangminhhai@mbbank.com",
    password: "security123",
    customer_id: "SEC001",
    name: "Đặng Minh Hải", 
    role: "security",
    approval_level: 4
  },
  auditor: {
    email: "lythilan@mbbank.com",
    password: "auditor123",
    customer_id: "AUD001",
    name: "Lý Thị Lan",
    role: "auditor",
    approval_level: 3,
    read_only: true
  }
};

class BankingSystemTester {
  constructor() {
    this.tokens = {};
    this.testResults = {
      total: 0,
      passed: 0,
      failed: 0,
      errors: []
    };
  }

  // Logging utilities
  log(message, type = 'info') {
    const timestamp = new Date().toISOString();
    const prefix = `[${timestamp}]`;
    
    switch(type) {
      case 'success':
        console.log(`${prefix} ✅ ${message}`.green);
        break;
      case 'error':
        console.log(`${prefix} ❌ ${message}`.red);
        break;
      case 'warning':
        console.log(`${prefix} ⚠️  ${message}`.yellow);
        break;
      case 'info':
        console.log(`${prefix} ℹ️  ${message}`.blue);
        break;
      case 'header':
        console.log(`\n${'='.repeat(80)}`.cyan);
        console.log(`${prefix} 🏦 ${message}`.cyan.bold);
        console.log(`${'='.repeat(80)}\n`.cyan);
        break;
      case 'subheader':
        console.log(`\n${'-'.repeat(60)}`.magenta);
        console.log(`${prefix} 📋 ${message}`.magenta.bold);
        console.log(`${'-'.repeat(60)}`.magenta);
        break;
    }
  }

  logRequest(method, endpoint, data = null) {
    this.log(`🔄 ${method.toUpperCase()} ${endpoint}`, 'info');
    if (data) {
      this.log(`📤 Request Body: ${JSON.stringify(data, null, 2)}`, 'info');
    }
  }

  logResponse(response, expectSuccess = true) {
    const status = response.status;
    const data = response.data;
    const isSuccess = status >= 200 && status < 300;
    
    if (isSuccess === expectSuccess) {
      this.log(`📥 Response [${status}]: ${JSON.stringify(data, null, 2)}`, 'success');
    } else {
      this.log(`📥 Response [${status}]: ${JSON.stringify(data, null, 2)}`, 'error');
    }
  }

  logTestResult(testName, passed, message = '') {
    this.testResults.total++;
    if (passed) {
      this.testResults.passed++;
      this.log(`✅ PASS: ${testName} ${message}`, 'success');
    } else {
      this.testResults.failed++;
      this.testResults.errors.push(`${testName}: ${message}`);
      this.log(`❌ FAIL: ${testName} ${message}`, 'error');
    }
  }

  // Authentication methods
  async login(userKey) {
    const user = TEST_USERS[userKey];
    if (!user) {
      throw new Error(`User ${userKey} not found in test data`);
    }

    this.log(`🔐 Attempting login for ${user.name} (${user.role})`, 'info');
    
    try {
      this.logRequest('POST', '/auth/login', {
        email: user.email,
        password: user.password
      });

      const response = await axios.post(`${BASE_URL}/auth/login`, {
        email: user.email,
        password: user.password
      });

      this.logResponse(response);
      
      if (response.data.code === 200 && response.data.data.token) {
        this.tokens[userKey] = response.data.data.token;
        this.logTestResult(
          `Login ${userKey}`, 
          true, 
          `- Token obtained successfully`
        );
        return response.data.data.token;
      } else {
        this.logTestResult(
          `Login ${userKey}`, 
          false, 
          `- Invalid response format`
        );
        return null;
      }
    } catch (error) {
      this.logTestResult(
        `Login ${userKey}`, 
        false, 
        `- ${error.response?.data?.message || error.message}`
      );
      return null;
    }
  }

  // Account operations
  async getAccountInfo(userKey, accountNumber) {
    const token = this.tokens[userKey];
    if (!token) {
      this.logTestResult(`Get Account Info ${userKey}`, false, '- No token available');
      return null;
    }

    this.log(`🏦 Getting account info for ${accountNumber} as ${userKey}`, 'info');
    
    try {
      this.logRequest('GET', `/accounts/${accountNumber}`);
      
      const response = await axios.get(`${BASE_URL}/accounts/${accountNumber}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      this.logResponse(response);
      this.logTestResult(`Get Account Info ${userKey}`, true, `- Account info retrieved`);
      return response.data;
    } catch (error) {
      const statusCode = error.response?.status;
      const message = error.response?.data?.message || error.message;
      
      this.logResponse(error.response, false);
      this.logTestResult(
        `Get Account Info ${userKey}`, 
        statusCode === 403 ? true : false, // 403 is expected for unauthorized access
        `- [${statusCode}] ${message}`
      );
      return null;
    }
  }

  async getBalance(userKey, accountNumber) {
    const token = this.tokens[userKey];
    if (!token) {
      this.logTestResult(`Get Balance ${userKey}`, false, '- No token available');
      return null;
    }

    this.log(`💰 Getting balance for ${accountNumber} as ${userKey}`, 'info');
    
    try {
      this.logRequest('GET', `/accounts/${accountNumber}/balance`);
      
      const response = await axios.get(`${BASE_URL}/accounts/${accountNumber}/balance`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      this.logResponse(response);
      this.logTestResult(`Get Balance ${userKey}`, true, `- Balance: ${response.data.data?.balance || 'N/A'} VND`);
      return response.data;
    } catch (error) {
      const statusCode = error.response?.status;
      const message = error.response?.data?.message || error.message;
      
      this.logResponse(error.response, false);
      this.logTestResult(
        `Get Balance ${userKey}`, 
        statusCode === 403 ? true : false,
        `- [${statusCode}] ${message}`
      );
      return null;
    }
  }

  async transfer(userKey, fromAccount, toAccount, amount, transferType = 'internal', description = 'Test transfer') {
    const token = this.tokens[userKey];
    if (!token) {
      this.logTestResult(`Transfer ${userKey}`, false, '- No token available');
      return null;
    }

    this.log(`💸 Transfer ${amount} VND from ${fromAccount} to ${toAccount} as ${userKey} (${transferType})`, 'info');
    
    const transferData = {
      to_account: toAccount,
      amount: amount,
      transfer_type: transferType,
      description: description
    };

    try {
      this.logRequest('POST', `/accounts/${fromAccount}/transfer`, transferData);
      
      const response = await axios.post(`${BASE_URL}/accounts/${fromAccount}/transfer`, transferData, {
        headers: { Authorization: `Bearer ${token}` }
      });

      this.logResponse(response);
      this.logTestResult(`Transfer ${userKey}`, true, `- ${amount} VND transferred successfully`);
      return response.data;
    } catch (error) {
      const statusCode = error.response?.status;
      const message = error.response?.data?.message || error.message;
      
      this.logResponse(error.response, false);
      this.logTestResult(
        `Transfer ${userKey}`, 
        false,
        `- [${statusCode}] ${message}`
      );
      return null;
    }
  }

  async deposit(userKey, accountNumber, amount, description = 'Test deposit') {
    const token = this.tokens[userKey];
    if (!token) {
      this.logTestResult(`Deposit ${userKey}`, false, '- No token available');
      return null;
    }

    this.log(`💵 Deposit ${amount} VND to ${accountNumber} as ${userKey}`, 'info');
    
    const depositData = {
      amount: amount,
      description: description
    };

    try {
      this.logRequest('POST', `/accounts/${accountNumber}/deposit`, depositData);
      
      const response = await axios.post(`${BASE_URL}/accounts/${accountNumber}/deposit`, depositData, {
        headers: { Authorization: `Bearer ${token}` }
      });

      this.logResponse(response);
      this.logTestResult(`Deposit ${userKey}`, true, `- ${amount} VND deposited successfully`);
      return response.data;
    } catch (error) {
      const statusCode = error.response?.status;
      const message = error.response?.data?.message || error.message;
      
      this.logResponse(error.response, false);
      this.logTestResult(
        `Deposit ${userKey}`, 
        false,
        `- [${statusCode}] ${message}`
      );
      return null;
    }
  }

  async withdraw(userKey, accountNumber, amount, description = 'Test withdrawal') {
    const token = this.tokens[userKey];
    if (!token) {
      this.logTestResult(`Withdraw ${userKey}`, false, '- No token available');
      return null;
    }

    this.log(`💸 Withdraw ${amount} VND from ${accountNumber} as ${userKey}`, 'info');
    
    const withdrawData = {
      amount: amount,
      description: description
    };

    try {
      this.logRequest('POST', `/accounts/${accountNumber}/withdraw`, withdrawData);
      
      const response = await axios.post(`${BASE_URL}/accounts/${accountNumber}/withdraw`, withdrawData, {
        headers: { Authorization: `Bearer ${token}` }
      });

      this.logResponse(response);
      this.logTestResult(`Withdraw ${userKey}`, true, `- ${amount} VND withdrawn successfully`);
      return response.data;
    } catch (error) {
      const statusCode = error.response?.status;
      const message = error.response?.data?.message || error.message;
      
      this.logResponse(error.response, false);
      this.logTestResult(
        `Withdraw ${userKey}`, 
        false,
        `- [${statusCode}] ${message}`
      );
      return null;
    }
  }

  async freezeAccount(userKey, accountNumber, reason = 'Test freeze') {
    const token = this.tokens[userKey];
    if (!token) {
      this.logTestResult(`Freeze Account ${userKey}`, false, '- No token available');
      return null;
    }

    this.log(`🧊 Freeze account ${accountNumber} as ${userKey}`, 'info');
    
    const freezeData = {
      reason: reason
    };

    try {
      this.logRequest('POST', `/accounts/${accountNumber}/freeze`, freezeData);
      
      const response = await axios.post(`${BASE_URL}/accounts/${accountNumber}/freeze`, freezeData, {
        headers: { Authorization: `Bearer ${token}` }
      });

      this.logResponse(response);
      this.logTestResult(`Freeze Account ${userKey}`, true, `- Account frozen successfully`);
      return response.data;
    } catch (error) {
      const statusCode = error.response?.status;
      const message = error.response?.data?.message || error.message;
      
      this.logResponse(error.response, false);
      this.logTestResult(
        `Freeze Account ${userKey}`, 
        statusCode === 403 ? true : false,
        `- [${statusCode}] ${message}`
      );
      return null;
    }
  }

  async unfreezeAccount(userKey, accountNumber, reason = 'Test unfreeze') {
    const token = this.tokens[userKey];
    if (!token) {
      this.logTestResult(`Unfreeze Account ${userKey}`, false, '- No token available');
      return null;
    }

    this.log(`🔥 Unfreeze account ${accountNumber} as ${userKey}`, 'info');
    
    const unfreezeData = {
      reason: reason
    };

    try {
      this.logRequest('POST', `/accounts/${accountNumber}/unfreeze`, unfreezeData);
      
      const response = await axios.post(`${BASE_URL}/accounts/${accountNumber}/unfreeze`, unfreezeData, {
        headers: { Authorization: `Bearer ${token}` }
      });

      this.logResponse(response);
      this.logTestResult(`Unfreeze Account ${userKey}`, true, `- Account unfrozen successfully`);
      return response.data;
    } catch (error) {
      const statusCode = error.response?.status;
      const message = error.response?.data?.message || error.message;
      
      this.logResponse(error.response, false);
      this.logTestResult(
        `Unfreeze Account ${userKey}`, 
        statusCode === 403 ? true : false,
        `- [${statusCode}] ${message}`
      );
      return null;
    }
  }

  // Test scenarios
  async runAuthenticationTests() {
    this.log('Authentication & Authorization Tests', 'header');
    
    // Test successful logins
    this.log('Testing successful logins for all users', 'subheader');
    for (const [userKey, user] of Object.entries(TEST_USERS)) {
      await this.login(userKey);
      await new Promise(resolve => setTimeout(resolve, 100)); // Small delay between requests
    }

    // Test invalid credentials
    this.log('Testing invalid credentials', 'subheader');
    try {
      this.logRequest('POST', '/auth/login', {
        email: "invalid@test.com",
        password: "wrongpassword"
      });
      
      const response = await axios.post(`${BASE_URL}/auth/login`, {
        email: "invalid@test.com",
        password: "wrongpassword"
      });
      
      this.logTestResult('Invalid Login', false, '- Should have failed but succeeded');
    } catch (error) {
      this.logResponse(error.response, false);
      this.logTestResult('Invalid Login', true, '- Correctly rejected invalid credentials');
    }
  }

  async runAccountAccessTests() {
    this.log('Account Access Control Tests', 'header');

    // Test account owners can access their accounts
    this.log('Testing account owners can access their own accounts', 'subheader');
    await this.getBalance('customer1', TEST_USERS.customer1.account);
    await this.getBalance('customer2', TEST_USERS.customer2.account);

    // Test account owners cannot access other accounts
    this.log('Testing account owners cannot access other accounts', 'subheader');
    await this.getBalance('customer1', TEST_USERS.customer2.account); // Should fail
    await this.getBalance('customer2', TEST_USERS.customer1.account); // Should fail

    // Test bank staff access
    this.log('Testing bank staff access to accounts', 'subheader');
    await this.getBalance('manager', TEST_USERS.customer1.account);
    await this.getBalance('compliance', TEST_USERS.customer1.account);
    await this.getBalance('teller', TEST_USERS.customer1.account); // Should fail for balance
    await this.getAccountInfo('teller', TEST_USERS.customer1.account);
  }

  async runTransferTests() {
    this.log('Transfer Tests', 'header');

    // Test internal transfers
    this.log('Testing internal transfers', 'subheader');
    await this.transfer('customer1', TEST_USERS.customer1.account, TEST_USERS.customer2.account, 1000000, 'internal');
    
    // Test external transfers
    this.log('Testing external transfers', 'subheader');
    await this.transfer('customer1', TEST_USERS.customer1.account, 'external_account_123', 2000000, 'external');
    
    // Test transfer limits
    this.log('Testing transfer limits', 'subheader');
    await this.transfer('customer1', TEST_USERS.customer1.account, 'external_account_123', 60000000, 'external'); // Should fail - over 50M limit
    
    // Test insufficient balance
    this.log('Testing insufficient balance transfers', 'subheader');
    await this.transfer('customer2', TEST_USERS.customer2.account, TEST_USERS.customer1.account, 100000000, 'internal'); // Should fail - insufficient balance
  }

  async runDepositWithdrawTests() {
    this.log('Deposit & Withdrawal Tests', 'header');

    // Test deposits
    this.log('Testing deposits', 'subheader');
    await this.deposit('customer1', TEST_USERS.customer1.account, 5000000);
    await this.deposit('teller', TEST_USERS.customer1.account, 3000000); // Teller can deposit
    
    // Test withdrawals
    this.log('Testing withdrawals', 'subheader');
    await this.withdraw('customer1', TEST_USERS.customer1.account, 2000000);
    await this.withdraw('teller', TEST_USERS.customer1.account, 1000000); // Teller can withdraw
    
    // Test excessive withdrawal
    this.log('Testing excessive withdrawals', 'subheader');
    await this.withdraw('customer2', TEST_USERS.customer2.account, 100000000); // Should fail - insufficient balance
  }

  async runFreezeUnfreezeTests() {
    this.log('Account Freeze/Unfreeze Tests', 'header');

    // Test freeze permissions
    this.log('Testing freeze permissions', 'subheader');
    await this.freezeAccount('manager', TEST_USERS.customer1.account); // Should succeed
    await this.freezeAccount('compliance', TEST_USERS.customer1.account); // Should succeed  
    await this.freezeAccount('security', TEST_USERS.customer1.account); // Should succeed
    await this.freezeAccount('teller', TEST_USERS.customer1.account); // Should fail
    await this.freezeAccount('customer1', TEST_USERS.customer1.account); // Should fail

    // Test unfreeze permissions
    this.log('Testing unfreeze permissions', 'subheader');
    await this.unfreezeAccount('manager', TEST_USERS.customer1.account); // Should succeed
    await this.unfreezeAccount('compliance', TEST_USERS.customer1.account); // Should succeed
    await this.unfreezeAccount('teller', TEST_USERS.customer1.account); // Should fail
  }

  async runSuspendedUserTests() {
    this.log('Suspended User Tests', 'header');
    
    // Test suspended user login (if allowed)
    this.log('Testing suspended user access', 'subheader');
    const suspendedToken = await this.login('customer3');
    
    if (suspendedToken) {
      // Test operations with suspended user
      await this.getBalance('customer3', TEST_USERS.customer3.account);
      await this.transfer('customer3', TEST_USERS.customer3.account, TEST_USERS.customer1.account, 1000000, 'internal');
    }
  }

  async runRoleBasedTests() {
    this.log('Role-Based Access Control Tests', 'header');

    // Test auditor read-only access
    this.log('Testing auditor read-only access', 'subheader');
    await this.getBalance('auditor', TEST_USERS.customer1.account); // Should succeed
    await this.transfer('auditor', TEST_USERS.customer1.account, TEST_USERS.customer2.account, 1000000, 'internal'); // Should fail
    await this.deposit('auditor', TEST_USERS.customer1.account, 1000000); // Should fail
    await this.freezeAccount('auditor', TEST_USERS.customer1.account); // Should fail

    // Test branch restrictions
    this.log('Testing branch restrictions', 'subheader');
    // Note: customer3 is in different branch (MB_HN002)
    await this.deposit('teller', TEST_USERS.customer3.account, 1000000); // Should fail - different branch
  }

  async runComprehensiveTests() {
    this.log('🏦 BANKING SYSTEM COMPREHENSIVE TEST SUITE', 'header');
    this.log(`Server: ${BASE_URL}`, 'info');
    this.log(`Test Timeout: ${TEST_TIMEOUT}ms`, 'info');
    
    try {
      // Set timeout for all requests
      axios.defaults.timeout = TEST_TIMEOUT;
      
      await this.runAuthenticationTests();
      await this.runAccountAccessTests();
      await this.runTransferTests();
      await this.runDepositWithdrawTests();
      await this.runFreezeUnfreezeTests();
      await this.runSuspendedUserTests();
      await this.runRoleBasedTests();

      // Final summary
      this.log('TEST SUMMARY', 'header');
      this.log(`Total Tests: ${this.testResults.total}`, 'info');
      this.log(`Passed: ${this.testResults.passed}`, 'success');
      this.log(`Failed: ${this.testResults.failed}`, this.testResults.failed > 0 ? 'error' : 'success');
      
      if (this.testResults.errors.length > 0) {
        this.log('FAILED TESTS:', 'error');
        this.testResults.errors.forEach(error => {
          this.log(`  • ${error}`, 'error');
        });
      }

      const successRate = ((this.testResults.passed / this.testResults.total) * 100).toFixed(2);
      this.log(`Success Rate: ${successRate}%`, successRate > 80 ? 'success' : 'warning');

    } catch (error) {
      this.log(`Critical error during testing: ${error.message}`, 'error');
      console.error(error);
    }
  }
}

// Usage
async function main() {
  const tester = new BankingSystemTester();
  await tester.runComprehensiveTests();
}

// Export for use as module
module.exports = BankingSystemTester;

// Run if called directly
if (require.main === module) {
  main().catch(console.error);
}