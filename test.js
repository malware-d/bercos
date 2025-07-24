const axios = require('axios');
const colors = require('colors');

class IAMTestTool {
  constructor(baseURL = 'http://localhost:8000') {
    this.baseURL = baseURL;
    this.tokens = {};
    this.testResults = {
      passed: 0,
      failed: 0,
      total: 0,
      details: []
    };
  }

  // ========== LOGGING & UTILITIES ==========
  log(message, type = 'info') {
    const timestamp = new Date().toISOString();
    const prefix = `[${timestamp}]`;
    
    switch (type) {
      case 'success':
        console.log(`${prefix} ✅ ${message}`.green);
        break;
      case 'error':
        console.log(`${prefix} ❌ ${message}`.red);
        break;
      case 'warning':
        console.log(`${prefix} ⚠️  ${message}`.yellow);
        break;
      case 'cerbos':
        console.log(`${prefix} 🔐 [CERBOS] ${message}`.cyan);
        break;
      case 'header':
        console.log(`\n${'='.repeat(80)}`.blue);
        console.log(`${message}`.blue.bold);
        console.log(`${'='.repeat(80)}`.blue);
        break;
      default:
        console.log(`${prefix} ℹ️  ${message}`.white);
    }
  }

  logCerbosFlow(user, action, resource, expected, actual) {
    this.log(`Testing authorization flow:`, 'cerbos');
    this.log(`  👤 Principal: ${user.email} (${user.role})`, 'cerbos');
    this.log(`  🎯 Action: ${action}`, 'cerbos');
    this.log(`  📦 Resource: ${resource.account_number || 'N/A'}`, 'cerbos');
    this.log(`  📋 Principal Attrs: status=${user.status}, email_verified=${user.email_verified}, approval_level=${user.approval_level}`, 'cerbos');
    this.log(`  📋 Resource Attrs: balance=${resource.balance}, frozen=${resource.frozen}, customer_id=${resource.customer_id}`, 'cerbos');
    this.log(`  🎯 Expected: ${expected ? 'ALLOW' : 'DENY'}`, 'cerbos');
    this.log(`  📊 Result: ${actual ? 'ALLOW' : 'DENY'}`, actual ? 'success' : 'error');
  }

  async recordTest(testName, expected, actual, details = {}) {
    const passed = expected === actual;
    this.testResults.total++;
    
    if (passed) {
      this.testResults.passed++;
      this.log(`PASS: ${testName}`, 'success');
    } else {
      this.testResults.failed++;
      this.log(`FAIL: ${testName} - Expected: ${expected}, Got: ${actual}`, 'error');
    }

    this.testResults.details.push({
      testName,
      expected,
      actual,
      passed,
      details
    });
  }

  // ========== AUTHENTICATION ==========
  async login(email, password) {
    try {
      this.log(`Attempting login for ${email}`);
      const response = await axios.post(`${this.baseURL}/auth/login`, {
        email,
        password
      });

      if (response.data.code === 200) {
        const token = response.data.data.token;
        const user = response.data.data.user;
        this.tokens[email] = token;
        this.log(`Login successful for ${email} (${user.role})`, 'success');
        return { token, user };
      }
    } catch (error) {
      this.log(`Login failed for ${email}: ${error.response?.data?.message || error.message}`, 'error');
      throw error;
    }
  }

  async loginAllUsers() {
    const credentials = [
      // Customers
      { email: 'nguyenvanan@gmail.com', password: 'customer123' },
      { email: 'tranthibinh@yahoo.com', password: 'customer456' },
      { email: 'leminhcuong@hotmail.com', password: 'customer789' },
      // Bank Staff
      { email: 'phamthidung@mbbank.com', password: 'teller123' },
      { email: 'hoangvanem@mbbank.com', password: 'manager123' },
      { email: 'vuthigiang@mbbank.com', password: 'compliance123' },
      { email: 'dangminhhai@mbbank.com', password: 'security123' },
      { email: 'lythilan@mbbank.com', password: 'auditor123' }
    ];

    const users = {};
    for (const cred of credentials) {
      try {
        const result = await this.login(cred.email, cred.password);
        users[cred.email] = result;
      } catch (error) {
        // Some users might be suspended, that's expected
        if (error.response?.data?.message?.includes('not active')) {
          this.log(`User ${cred.email} is inactive (expected for suspended users)`, 'warning');
        }
      }
    }
    return users;
  }

  // ========== API TEST HELPERS ==========
  async makeRequest(method, endpoint, data = null, token = null) {
    const config = {
      method,
      url: `${this.baseURL}${endpoint}`,
      headers: token ? { 'Authorization': `Bearer ${token}` } : {}
    };

    if (data) {
      config.data = data;
    }

    try {
      const response = await axios(config);
      return { success: true, data: response.data, status: response.status };
    } catch (error) {
      return { 
        success: false, 
        data: error.response?.data || null, 
        status: error.response?.status || 0,
        error: error.message 
      };
    }
  }

  // ========== COMPREHENSIVE TEST SCENARIOS ==========
  
  async testViewBalancePermissions(users) {
    this.log('Testing View Balance Permissions', 'header');
    
    const testCases = [
      // Account Owner Access
      {
        user: users['nguyenvanan@gmail.com'],
        account: '0123456789',
        expected: true,
        description: 'Account owner accessing own account'
      },
      {
        user: users['tranthibinh@yahoo.com'],
        account: '0987654321', 
        expected: true,
        description: 'Account owner accessing own account'
      },
      {
        user: users['nguyenvanan@gmail.com'],
        account: '0987654321',
        expected: false,
        description: 'Customer accessing another customer account'
      },
      // Staff Access
      {
        user: users['hoangvanem@mbbank.com'],
        account: '0123456789',
        expected: true,
        description: 'Branch manager accessing customer account'
      },
      {
        user: users['vuthigiang@mbbank.com'],
        account: '0123456789',
        expected: true,
        description: 'Compliance officer accessing customer account'
      },
      {
        user: users['phamthidung@mbbank.com'],
        account: '0123456789',
        expected: false,
        description: 'Teller should not have view:balance permission'
      }
    ];

    for (const testCase of testCases) {
      if (!testCase.user) continue;
      
      const result = await this.makeRequest(
        'GET', 
        `/accounts/${testCase.account}/balance`,
        null,
        testCase.user.token
      );

      this.logCerbosFlow(
        testCase.user.user,
        'view:balance',
        { account_number: testCase.account, customer_id: testCase.account === '0123456789' ? 'MB001' : 'MB002' },
        testCase.expected,
        result.success
      );

      await this.recordTest(
        `View Balance: ${testCase.description}`,
        testCase.expected,
        result.success,
        { endpoint: `/accounts/${testCase.account}/balance`, response: result }
      );
    }
  }

  async testTransferPermissions(users) {
    this.log('Testing Transfer Permissions', 'header');
    
    const testCases = [
      // Internal Transfer Tests
      {
        user: users['nguyenvanan@gmail.com'],
        account: '0123456789',
        transferData: {
          to_account: '0987654321',
          amount: 5000000,
          transfer_type: 'internal'
        },
        expected: true,
        description: 'Account owner internal transfer - sufficient balance'
      },
      {
        user: users['nguyenvanan@gmail.com'],
        account: '0123456789',
        transferData: {
          to_account: '0987654321',
          amount: 500000000, // Exceed balance
          transfer_type: 'internal'
        },
        expected: false,
        description: 'Account owner internal transfer - insufficient balance'
      },
      // External Transfer Tests
      {
        user: users['nguyenvanan@gmail.com'],
        account: '0123456789',
        transferData: {
          to_account: 'external_bank_123',
          amount: 10000000,
          transfer_type: 'external'
        },
        expected: true,
        description: 'Account owner external transfer - valid amount'
      },
      {
        user: users['tranthibinh@yahoo.com'],
        account: '0987654321',
        transferData: {
          to_account: 'external_bank_123',
          amount: 10000000,
          transfer_type: 'external'
        },
        expected: false,
        description: 'Account owner external transfer - SMS not verified'
      },
      {
        user: users['nguyenvanan@gmail.com'],
        account: '0123456789',
        transferData: {
          to_account: 'external_bank_123',
          amount: 60000000, // Exceed limit
          transfer_type: 'external'
        },
        expected: false,
        description: 'Account owner external transfer - exceed 50M limit'
      },
      // Staff Transfer Tests
      {
        user: users['phamthidung@mbbank.com'],
        account: '0123456789',
        transferData: {
          to_account: '0987654321',
          amount: 1000000,
          transfer_type: 'internal'
        },
        expected: false,
        description: 'Teller attempting transfer - should be denied'
      }
    ];

    for (const testCase of testCases) {
      if (!testCase.user) continue;
      
      const result = await this.makeRequest(
        'POST',
        `/accounts/${testCase.account}/transfer`,
        testCase.transferData,
        testCase.user.token
      );

      const action = testCase.transferData.transfer_type === 'external' ? 'transfer:external' : 'transfer:internal';
      
      this.logCerbosFlow(
        testCase.user.user,
        action,
        {
          account_number: testCase.account,
          customer_id: testCase.account === '0123456789' ? 'MB001' : 'MB002',
          balance: testCase.account === '0123456789' ? 250000000 : 75000000,
          frozen: false
        },
        testCase.expected,
        result.success
      );

      await this.recordTest(
        `Transfer: ${testCase.description}`,
        testCase.expected,
        result.success,
        { endpoint: `/accounts/${testCase.account}/transfer`, response: result }
      );
    }
  }

  async testDepositWithdrawPermissions(users) {
    this.log('Testing Deposit/Withdraw Permissions', 'header');
    
    const depositTests = [
      {
        user: users['nguyenvanan@gmail.com'],
        account: '0123456789',
        amount: 1000000,
        expected: true,
        description: 'Account owner deposit'
      },
      {
        user: users['phamthidung@mbbank.com'],
        account: '0123456789',
        amount: 1000000,
        expected: true,
        description: 'Teller deposit'
      },
      {
        user: users['hoangvanem@mbbank.com'],
        account: '0123456789',
        amount: 1000000,
        expected: true,
        description: 'Branch manager deposit'
      },
      {
        user: users['vuthigiang@mbbank.com'],
        account: '0123456789',
        amount: 1000000,
        expected: false,
        description: 'Compliance officer deposit - should be denied'
      }
    ];

    for (const testCase of depositTests) {
      if (!testCase.user) continue;
      
      const result = await this.makeRequest(
        'POST',
        `/accounts/${testCase.account}/deposit`,
        { amount: testCase.amount },
        testCase.user.token
      );

      this.logCerbosFlow(
        testCase.user.user,
        'deposit',
        {
          account_number: testCase.account,
          customer_id: 'MB001',
          frozen: false
        },
        testCase.expected,
        result.success
      );

      await this.recordTest(
        `Deposit: ${testCase.description}`,
        testCase.expected,
        result.success
      );
    }

    const withdrawTests = [
      {
        user: users['nguyenvanan@gmail.com'],
        account: '0123456789',
        amount: 1000000,
        expected: true,
        description: 'Account owner withdraw'
      },
      {
        user: users['phamthidung@mbbank.com'],
        account: '0123456789',
        amount: 1000000,
        expected: true,
        description: 'Teller withdraw'
      },
      {
        user: users['hoangvanem@mbbank.com'],
        account: '0123456789',
        amount: 1000000,
        expected: false,
        description: 'Branch manager withdraw - should be denied'
      }
    ];

    for (const testCase of withdrawTests) {
      if (!testCase.user) continue;
      
      const result = await this.makeRequest(
        'POST',
        `/accounts/${testCase.account}/withdraw`,
        { amount: testCase.amount },
        testCase.user.token
      );

      this.logCerbosFlow(
        testCase.user.user,
        'withdraw',
        {
          account_number: testCase.account,
          customer_id: 'MB001',
          balance: 250000000,
          frozen: false
        },
        testCase.expected,
        result.success
      );

      await this.recordTest(
        `Withdraw: ${testCase.description}`,
        testCase.expected,
        result.success
      );
    }
  }

  async testFreezeUnfreezePermissions(users) {
    this.log('Testing Freeze/Unfreeze Permissions', 'header');
    
    const freezeTests = [
      {
        user: users['hoangvanem@mbbank.com'],
        account: '0987654321',
        expected: true,
        description: 'Branch manager freeze account'
      },
      {
        user: users['vuthigiang@mbbank.com'],
        account: '0987654321',
        expected: true,
        description: 'Compliance officer freeze account'
      },
      {
        user: users['dangminhhai@mbbank.com'],
        account: '0987654321',
        expected: true,
        description: 'Security admin freeze account'
      },
      {
        user: users['phamthidung@mbbank.com'],
        account: '0987654321',
        expected: false,
        description: 'Teller freeze account - should be denied'
      },
      {
        user: users['nguyenvanan@gmail.com'],
        account: '0123456789',
        expected: false,
        description: 'Customer freeze own account - should be denied'
      }
    ];

    for (const testCase of freezeTests) {
      if (!testCase.user) continue;
      
      const result = await this.makeRequest(
        'POST',
        `/accounts/${testCase.account}/freeze`,
        { reason: 'Test freeze' },
        testCase.user.token
      );

      this.logCerbosFlow(
        testCase.user.user,
        'freeze',
        {
          account_number: testCase.account,
          customer_id: testCase.account === '0123456789' ? 'MB001' : 'MB002'
        },
        testCase.expected,
        result.success
      );

      await this.recordTest(
        `Freeze: ${testCase.description}`,
        testCase.expected,
        result.success
      );
    }

    // Test unfreeze (requires approval_level >= 2)
    const unfreezeTests = [
      {
        user: users['hoangvanem@mbbank.com'], // approval_level: 3
        account: '1122334455', // Already frozen
        expected: true,
        description: 'Branch manager unfreeze account'
      },
      {
        user: users['vuthigiang@mbbank.com'], // approval_level: 4
        account: '1122334455',
        expected: true,
        description: 'Compliance officer unfreeze account'
      },
      {
        user: users['phamthidung@mbbank.com'], // approval_level: 1
        account: '1122334455',
        expected: false,
        description: 'Teller unfreeze account - insufficient approval level'
      }
    ];

    for (const testCase of unfreezeTests) {
      if (!testCase.user) continue;
      
      const result = await this.makeRequest(
        'POST',
        `/accounts/${testCase.account}/unfreeze`,
        { reason: 'Test unfreeze' },
        testCase.user.token
      );

      this.logCerbosFlow(
        testCase.user.user,
        'unfreeze',
        {
          account_number: testCase.account,
          customer_id: 'MB003',
          frozen: true
        },
        testCase.expected,
        result.success
      );

      await this.recordTest(
        `Unfreeze: ${testCase.description}`,
        testCase.expected,
        result.success
      );
    }
  }

  async testAdminPermissions(users) {
    this.log('Testing Admin View Permissions', 'header');
    
    const adminTests = [
      {
        user: users['hoangvanem@mbbank.com'],
        endpoint: '/accounts',
        expected: true,
        description: 'Branch manager view all accounts'
      },
      {
        user: users['vuthigiang@mbbank.com'],
        endpoint: '/accounts',
        expected: true,
        description: 'Compliance officer view all accounts'
      },
      {
        user: users['dangminhhai@mbbank.com'],
        endpoint: '/accounts',
        expected: true,
        description: 'Security admin view all accounts'
      },
      {
        user: users['lythilan@mbbank.com'],
        endpoint: '/accounts',
        expected: true,
        description: 'Auditor view all accounts (read-only)'
      },
      {
        user: users['phamthidung@mbbank.com'],
        endpoint: '/accounts',
        expected: false,
        description: 'Teller view all accounts - should be denied'
      },
      {
        user: users['nguyenvanan@gmail.com'],
        endpoint: '/accounts',
        expected: false,
        description: 'Customer view all accounts - should be denied'
      }
    ];

    for (const testCase of adminTests) {
      if (!testCase.user) continue;
      
      const result = await this.makeRequest(
        'GET',
        testCase.endpoint,
        null,
        testCase.user.token
      );

      this.logCerbosFlow(
        testCase.user.user,
        'view:admin',
        { resource_type: 'admin_view' },
        testCase.expected,
        result.success
      );

      await this.recordTest(
        `Admin View: ${testCase.description}`,
        testCase.expected,
        result.success
      );
    }
  }

  async testAccountCreation(users) {
    this.log('Testing Account Creation Permissions', 'header');
    
    const createTests = [
      {
        user: users['phamthidung@mbbank.com'],
        accountData: {
          customer_id: 'MB004',
          account_type: 'savings',
          initial_deposit: 1000000
        },
        expected: true,
        description: 'Teller create account'
      },
      {
        user: users['hoangvanem@mbbank.com'],
        accountData: {
          customer_id: 'MB005',
          account_type: 'checking',
          initial_deposit: 5000000
        },
        expected: true,
        description: 'Branch manager create account'
      },
      {
        user: users['vuthigiang@mbbank.com'],
        accountData: {
          customer_id: 'MB006',
          account_type: 'savings'
        },
        expected: false,
        description: 'Compliance officer create account - should be denied'
      },
      {
        user: users['nguyenvanan@gmail.com'],
        accountData: {
          customer_id: 'MB007',
          account_type: 'savings'
        },
        expected: false,
        description: 'Customer create account - should be denied'
      }
    ];

    for (const testCase of createTests) {
      if (!testCase.user) continue;
      
      const result = await this.makeRequest(
        'POST',
        '/accounts',
        testCase.accountData,
        testCase.user.token
      );

      this.logCerbosFlow(
        testCase.user.user,
        'create:account',
        {
          customer_id: testCase.accountData.customer_id,
          branch_code: testCase.user.user.branch_code
        },
        testCase.expected,
        result.success
      );

      await this.recordTest(
        `Create Account: ${testCase.description}`,
        testCase.expected,
        result.success
      );
    }
  }

  async testFrozenAccountScenarios(users) {
    this.log('Testing Frozen Account Scenarios', 'header');
    
    // Account 1122334455 is frozen in the database
    const frozenAccountTests = [
      {
        user: users['leminhcuong@hotmail.com'], // This user is suspended, won't work
        account: '1122334455',
        action: 'withdraw',
        data: { amount: 1000000 },
        expected: false,
        description: 'Suspended user access frozen account'
      },
      {
        user: users['nguyenvanan@gmail.com'],
        account: '1122334455',
        action: 'transfer',
        data: { to_account: '0987654321', amount: 1000000, transfer_type: 'internal' },
        expected: false,
        description: 'Transfer from frozen account - should be denied'
      }
    ];

    for (const testCase of frozenAccountTests) {
      if (!testCase.user) {
        this.log(`Skipping test for suspended user: ${testCase.description}`, 'warning');
        continue;
      }
      
      const result = await this.makeRequest(
        'POST',
        `/accounts/${testCase.account}/${testCase.action}`,
        testCase.data,
        testCase.user.token
      );

      await this.recordTest(
        `Frozen Account: ${testCase.description}`,
        testCase.expected,
        result.success
      );
    }
  }

  // ========== MAIN TEST RUNNER ==========
  async runAllTests() {
    console.log('🚀 Starting JPMorgan Chase IAM System Comprehensive Testing'.rainbow.bold);
    console.log('=' .repeat(80));
    
    try {
      // 1. Login all users
      this.log('Phase 1: User Authentication', 'header');
      const users = await this.loginAllUsers();
      
      // 2. Run all test scenarios
      await this.testViewBalancePermissions(users);
      await this.testTransferPermissions(users);
      await this.testDepositWithdrawPermissions(users);
      await this.testFreezeUnfreezePermissions(users);
      await this.testAdminPermissions(users);
      await this.testAccountCreation(users);
      await this.testFrozenAccountScenarios(users);
      
      // 3. Generate final report
      this.generateFinalReport();
      
    } catch (error) {
      this.log(`Critical error during testing: ${error.message}`, 'error');
      console.error(error);
    }
  }

  generateFinalReport() {
    this.log('Final Test Report', 'header');
    
    console.log(`📊 Test Summary:`.bold);
    console.log(`   Total Tests: ${this.testResults.total}`);
    console.log(`   ✅ Passed: ${this.testResults.passed}`.green);
    console.log(`   ❌ Failed: ${this.testResults.failed}`.red);
    console.log(`   📈 Success Rate: ${((this.testResults.passed / this.testResults.total) * 100).toFixed(2)}%`);
    
    if (this.testResults.failed > 0) {
      console.log(`\n🔍 Failed Tests:`.red.bold);
      this.testResults.details
        .filter(test => !test.passed)
        .forEach(test => {
          console.log(`   ❌ ${test.testName}`.red);
          console.log(`      Expected: ${test.expected}, Got: ${test.actual}`);
        });
    }
    
    console.log(`\n🎯 Cerbos Policy Coverage Validated:`.green.bold);
    console.log(`   ✓ Derived Roles (account_owner, teller, branch_manager, etc.)`);
    console.log(`   ✓ Resource Policies (view:balance, transfer:internal/external, freeze/unfreeze)`);
    console.log(`   ✓ Conditional Logic (balance checks, verification status, approval levels)`);
    console.log(`   ✓ Role-based Access Control (RBAC) with attribute-based conditions`);
    console.log(`   ✓ Security Constraints (frozen accounts, daily limits, verification requirements)`);
    
    console.log(`\n🏦 Banking Operations Tested:`.cyan.bold);
    console.log(`   ✓ Account Balance Viewing`);
    console.log(`   ✓ Internal & External Transfers`);
    console.log(`   ✓ Deposit & Withdrawal Operations`);
    console.log(`   ✓ Account Freeze/Unfreeze`);
    console.log(`   ✓ Administrative Functions`);
    console.log(`   ✓ Account Creation`);
    console.log(`   ✓ Frozen Account Scenarios`);
  }
}

// Export for use
module.exports = IAMTestTool;

// Auto-run if executed directly
if (require.main === module) {
  const testTool = new IAMTestTool();
  testTool.runAllTests();
}