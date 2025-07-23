const axios = require('axios');
const jwt = require('jsonwebtoken');

// Configuration
const BASE_URL = 'http://localhost:8000';
const JWT_SECRET = 'd1f8a9b3c5e7f2a4d6c8b0e5f3a7d2c1b5e8f3a6d9c2b7e4f1a8d3c6b9e5f2a1';

class CerbosTestTool {
  constructor() {
    this.testResults = {
      passed: 0,
      failed: 0,
      total: 0,
      details: []
    };
    
    // Test users with expected roles and permissions
    this.testUsers = {
      customer1: {
        email: 'nguyenvanan@gmail.com',
        password: 'customer123',
        expectedRole: 'account_owner',
        ownAccount: '0123456789',
        expectedPermissions: ['view:balance', 'view:statement', 'transfer:internal', 'transfer:external', 'deposit', 'withdraw']
      },
      customer2: {
        email: 'tranthibinh@yahoo.com',
        password: 'customer456',
        expectedRole: 'account_owner',
        ownAccount: '0987654321',
        expectedPermissions: ['view:balance', 'view:statement', 'transfer:internal', 'transfer:external', 'deposit', 'withdraw']
      },
      teller: {
        email: 'phamthidung@mbbank.com',
        password: 'teller123',
        expectedRole: 'teller',
        expectedPermissions: ['deposit', 'withdraw', 'create:account']
      },
      manager: {
        email: 'hoangvanem@mbbank.com',
        password: 'manager123',
        expectedRole: 'branch_manager',
        expectedPermissions: ['view:balance', 'view:statement', 'deposit', 'freeze', 'unfreeze', 'view:admin', 'create:account']
      },
      compliance: {
        email: 'vuthigiang@mbbank.com',
        password: 'compliance123',
        expectedRole: 'compliance_officer',
        expectedPermissions: ['view:balance', 'view:statement', 'freeze', 'unfreeze', 'view:admin']
      },
      security: {
        email: 'dangminhhai@mbbank.com',
        password: 'security123',
        expectedRole: 'security_admin',
        expectedPermissions: ['freeze', 'view:admin']
      },
      auditor: {
        email: 'lythilan@mbbank.com',
        password: 'auditor123',
        expectedRole: 'auditor',
        expectedPermissions: ['view:admin'] // read-only
      }
    };
  }

  // Utility functions
  log(message, type = 'INFO') {
    const timestamp = new Date().toISOString();
    const colors = {
      'INFO': '\x1b[36m',
      'SUCCESS': '\x1b[32m',
      'ERROR': '\x1b[31m',
      'WARNING': '\x1b[33m',
      'CERBOS': '\x1b[35m'
    };
    console.log(`${colors[type]}[${timestamp}] [${type}] ${message}\x1b[0m`);
  }

  logCerbosCall(action, resource, user, expected, actual, success) {
    this.log('═══════════════════════════════════════════════', 'CERBOS');
    this.log(`🎯 CERBOS AUTHORIZATION CHECK`, 'CERBOS');
    this.log(`📧 User: ${user.email} (Role: ${user.role || 'N/A'})`, 'CERBOS');
    this.log(`🔐 Action: ${action}`, 'CERBOS');
    this.log(`📦 Resource: ${JSON.stringify(resource, null, 2)}`, 'CERBOS');
    this.log(`✅ Expected: ${expected ? 'ALLOW' : 'DENY'}`, 'CERBOS');
    this.log(`📊 Actual: ${actual ? 'ALLOW' : 'DENY'}`, 'CERBOS');
    this.log(`🎪 Result: ${success ? '✅ PASS' : '❌ FAIL'}`, success ? 'SUCCESS' : 'ERROR');
    
    // Log detailed user attributes for debugging
    this.log(`👤 User Attributes:`, 'CERBOS');
    this.log(`   - customer_id: ${user.customer_id || 'N/A'}`, 'CERBOS');
    this.log(`   - status: ${user.status || 'N/A'}`, 'CERBOS');
    this.log(`   - email_verified: ${user.email_verified || 'N/A'}`, 'CERBOS');
    this.log(`   - sms_verified: ${user.sms_verified || 'N/A'}`, 'CERBOS');
    this.log(`   - branch_code: ${user.branch_code || 'N/A'}`, 'CERBOS');
    this.log(`   - approval_level: ${user.approval_level || 'N/A'}`, 'CERBOS');
    this.log(`   - department: ${user.department || 'N/A'}`, 'CERBOS');
    this.log(`   - daily_limit: ${user.daily_limit || 'N/A'}`, 'CERBOS');
    this.log('═══════════════════════════════════════════════', 'CERBOS');
  }

  async login(email, password) {
    try {
      this.log(`🔐 Attempting login for: ${email}`);
      const response = await axios.post(`${BASE_URL}/auth/login`, {
        email,
        password
      });

      if (response.data.code === 200) {
        const token = response.data.data.token;
        const user = response.data.data.user;
        this.log(`✅ Login successful for: ${email}`, 'SUCCESS');
        
        // Decode JWT to see user attributes
        const decoded = jwt.verify(token, JWT_SECRET);
        this.log(`📋 JWT User Attributes: ${JSON.stringify(decoded, null, 2)}`);
        
        return { token, user: decoded };
      } else {
        throw new Error(`Login failed: ${response.data.message}`);
      }
    } catch (error) {
      this.log(`❌ Login failed for ${email}: ${error.message}`, 'ERROR');
      return null;
    }
  }

  async makeAuthorizedRequest(method, endpoint, token, data = null) {
    try {
      const config = {
        method,
        url: `${BASE_URL}${endpoint}`,
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      };

      if (data) {
        config.data = data;
      }

      const response = await axios(config);
      return { success: true, data: response.data, status: response.status };
    } catch (error) {
      return { 
        success: false, 
        error: error.response?.data || error.message,
        status: error.response?.status
      };
    }
  }

  async testPermission(userKey, action, resource, shouldSucceed = true) {
    const testUser = this.testUsers[userKey];
    this.log(`\n🧪 Testing ${userKey} - ${action} on ${JSON.stringify(resource)}`);
    
    // Login first
    const loginResult = await this.login(testUser.email, testUser.password);
    if (!loginResult) {
      this.recordTest(false, `Login failed for ${userKey}`);
      return;
    }

    const { token, user } = loginResult;

    // Determine the appropriate endpoint based on action
    let endpoint, method, data;
    
    switch (action) {
      case 'view:balance':
        endpoint = `/accounts/${resource.account_number}/balance`;
        method = 'GET';
        break;
      case 'view:statement':
        endpoint = `/accounts/${resource.account_number}/transactions`;
        method = 'GET';
        break;
      case 'transfer:internal':
        endpoint = `/accounts/${resource.account_number}/transfer`;
        method = 'POST';
        data = {
          to_account: '0987654321',
          amount: resource.transfer_amount || 1000000,
          transfer_type: 'internal',
          description: 'Test internal transfer'
        };
        break;
      case 'transfer:external':
        endpoint = `/accounts/${resource.account_number}/transfer`;
        method = 'POST';
        data = {
          to_account: '1234567890',
          amount: resource.transfer_amount || 1000000,
          transfer_type: 'external',
          description: 'Test external transfer'
        };
        break;
      case 'deposit':
        endpoint = `/accounts/${resource.account_number}/deposit`;
        method = 'POST';
        data = {
          amount: resource.deposit_amount || 1000000,
          description: 'Test deposit'
        };
        break;
      case 'withdraw':
        endpoint = `/accounts/${resource.account_number}/withdraw`;
        method = 'POST';
        data = {
          amount: resource.withdraw_amount || 500000,
          description: 'Test withdrawal'
        };
        break;
      case 'freeze':
        endpoint = `/accounts/${resource.account_number}/freeze`;
        method = 'POST';
        data = {
          reason: 'Test freeze'
        };
        break;
      case 'unfreeze':
        endpoint = `/accounts/${resource.account_number}/unfreeze`;
        method = 'POST';
        data = {
          reason: 'Test unfreeze'
        };
        break;
      case 'view:admin':
        endpoint = '/accounts';
        method = 'GET';
        break;
      case 'create:account':
        endpoint = '/accounts';
        method = 'POST';
        data = {
          customer_id: 'test123',
          account_type: 'savings',
          initial_deposit: 1000000
        };
        break;
      default:
        this.log(`❌ Unknown action: ${action}`, 'ERROR');
        return;
    }

    // Make the request
    const result = await this.makeAuthorizedRequest(method, endpoint, token, data);
    
    // Log Cerbos decision details
    this.logCerbosCall(action, resource, user, shouldSucceed, result.success, result.success === shouldSucceed);

    // Record test result
    const testDescription = `${userKey} ${action} on account ${resource.account_number || 'system'} - Expected: ${shouldSucceed ? 'SUCCESS' : 'FAILURE'}`;
    
    if (result.success === shouldSucceed) {
      this.recordTest(true, testDescription);
      this.log(`✅ Test passed: ${testDescription}`, 'SUCCESS');
    } else {
      this.recordTest(false, testDescription);
      this.log(`❌ Test failed: ${testDescription}`, 'ERROR');
      this.log(`   Response: ${JSON.stringify(result.error || result.data, null, 2)}`, 'ERROR');
    }
  }

  recordTest(passed, description) {
    this.testResults.total++;
    if (passed) {
      this.testResults.passed++;
    } else {
      this.testResults.failed++;
    }
    this.testResults.details.push({
      passed,
      description,
      timestamp: new Date().toISOString()
    });
  }

  async runAllTests() {
    this.log('🚀 Starting Cerbos Authorization Test Suite', 'INFO');
    this.log('=' .repeat(80));

    // Test Account Owner permissions
    this.log('\n📋 TESTING ACCOUNT OWNER PERMISSIONS', 'INFO');
    await this.testAccountOwnerPermissions();

    // Test Cross-account access (should fail)
    this.log('\n🚫 TESTING CROSS-ACCOUNT ACCESS RESTRICTIONS', 'WARNING');
    await this.testCrossAccountRestrictions();

    // Test Bank Employee permissions
    this.log('\n🏦 TESTING BANK EMPLOYEE PERMISSIONS', 'INFO');
    await this.testBankEmployeePermissions();

    // Test Transfer limits and conditions
    this.log('\n💰 TESTING TRANSFER LIMITS AND CONDITIONS', 'INFO');
    await this.testTransferLimits();

    // Test Frozen account restrictions
    this.log('\n❄️ TESTING FROZEN ACCOUNT RESTRICTIONS', 'INFO');
    await this.testFrozenAccountRestrictions();

    // Test Admin/Management permissions
    this.log('\n👑 TESTING ADMIN/MANAGEMENT PERMISSIONS', 'INFO');
    await this.testAdminPermissions();

    this.printTestSummary();
  }

  async testAccountOwnerPermissions() {
    // Customer 1 accessing their own account
    const customer1Account = {
      account_number: '0123456789',
      customer_id: 'cust001',
      balance: 250000000,
      frozen: false,
      branch_code: 'HN001'
    };

    await this.testPermission('customer1', 'view:balance', customer1Account, true);
    await this.testPermission('customer1', 'view:statement', customer1Account, true);
    await this.testPermission('customer1', 'transfer:internal', { ...customer1Account, transfer_amount: 1000000 }, true);
    await this.testPermission('customer1', 'transfer:external', { ...customer1Account, transfer_amount: 10000000 }, true);
    await this.testPermission('customer1', 'deposit', { ...customer1Account, deposit_amount: 1000000 }, true);
    await this.testPermission('customer1', 'withdraw', { ...customer1Account, withdraw_amount: 500000 }, true);
  }

  async testCrossAccountRestrictions() {
    // Customer 1 trying to access Customer 2's account (should fail)
    const customer2Account = {
      account_number: '0987654321',
      customer_id: 'cust002',
      balance: 75000000,
      frozen: false,
      branch_code: 'HN001'
    };

    await this.testPermission('customer1', 'view:balance', customer2Account, false);
    await this.testPermission('customer1', 'view:statement', customer2Account, false);
    await this.testPermission('customer1', 'transfer:internal', { ...customer2Account, transfer_amount: 1000000 }, false);
  }

  async testBankEmployeePermissions() {
    const testAccount = {
      account_number: '0123456789',
      customer_id: 'cust001',
      balance: 250000000,
      frozen: false,
      branch_code: 'HN001'
    };

    // Teller permissions
    await this.testPermission('teller', 'deposit', { ...testAccount, deposit_amount: 1000000 }, true);
    await this.testPermission('teller', 'withdraw', { ...testAccount, withdraw_amount: 500000 }, true);
    await this.testPermission('teller', 'view:balance', testAccount, false); // Tellers shouldn't view balance
    await this.testPermission('teller', 'freeze', testAccount, false); // Tellers can't freeze

    // Manager permissions
    await this.testPermission('manager', 'view:balance', testAccount, true);
    await this.testPermission('manager', 'freeze', testAccount, true);
    await this.testPermission('manager', 'unfreeze', testAccount, true);
    await this.testPermission('manager', 'view:admin', {}, true);

    // Compliance Officer permissions
    await this.testPermission('compliance', 'view:balance', testAccount, true);
    await this.testPermission('compliance', 'freeze', testAccount, true);
    await this.testPermission('compliance', 'unfreeze', testAccount, true);

    // Security Admin permissions
    await this.testPermission('security', 'freeze', testAccount, true);
    await this.testPermission('security', 'view:admin', {}, true);
    await this.testPermission('security', 'unfreeze', testAccount, false); // Security can't unfreeze

    // Auditor permissions (read-only)
    await this.testPermission('auditor', 'view:admin', {}, true);
    await this.testPermission('auditor', 'freeze', testAccount, false);
  }

  async testTransferLimits() {
    const testAccount = {
      account_number: '0123456789',
      customer_id: 'cust001',
      balance: 250000000,
      frozen: false,
      branch_code: 'HN001'
    };

    // Test external transfer over 50 million VND limit (should fail)
    await this.testPermission('customer1', 'transfer:external', 
      { ...testAccount, transfer_amount: 60000000 }, false);

    // Test external transfer within limit (should succeed)
    await this.testPermission('customer1', 'transfer:external', 
      { ...testAccount, transfer_amount: 30000000 }, true);

    // Test transfer exceeding balance (should fail)
    await this.testPermission('customer2', 'transfer:internal', 
      { account_number: '0987654321', customer_id: 'cust002', balance: 75000000, frozen: false, transfer_amount: 100000000 }, false);
  }

  async testFrozenAccountRestrictions() {
    const frozenAccount = {
      account_number: '0123456789',
      customer_id: 'cust001',
      balance: 250000000,
      frozen: true,
      branch_code: 'HN001'
    };

    // All transaction operations should fail on frozen account
    await this.testPermission('customer1', 'transfer:internal', 
      { ...frozenAccount, transfer_amount: 1000000 }, false);
    await this.testPermission('customer1', 'withdraw', 
      { ...frozenAccount, withdraw_amount: 500000 }, false);
    await this.testPermission('teller', 'deposit', 
      { ...frozenAccount, deposit_amount: 1000000 }, false);

    // But viewing should still work
    await this.testPermission('customer1', 'view:balance', frozenAccount, true);
  }

  async testAdminPermissions() {
    // Test account creation permissions
    const newAccount = {
      customer_id: 'newcust',
      account_type: 'savings',
      branch_code: 'HN001'
    };

    await this.testPermission('teller', 'create:account', newAccount, true);
    await this.testPermission('manager', 'create:account', newAccount, true);
    await this.testPermission('customer1', 'create:account', newAccount, false);

    // Test admin view permissions
    await this.testPermission('manager', 'view:admin', {}, true);
    await this.testPermission('compliance', 'view:admin', {}, true);
    await this.testPermission('security', 'view:admin', {}, true);
    await this.testPermission('auditor', 'view:admin', {}, true);
    await this.testPermission('customer1', 'view:admin', {}, false);
    await this.testPermission('teller', 'view:admin', {}, false);
  }

  printTestSummary() {
    this.log('\n' + '='.repeat(80));
    this.log('📊 TEST SUMMARY', 'INFO');
    this.log('='.repeat(80));
    this.log(`✅ Passed: ${this.testResults.passed}`, 'SUCCESS');
    this.log(`❌ Failed: ${this.testResults.failed}`, 'ERROR');
    this.log(`📊 Total: ${this.testResults.total}`, 'INFO');
    this.log(`📈 Success Rate: ${((this.testResults.passed / this.testResults.total) * 100).toFixed(2)}%`, 
      this.testResults.failed === 0 ? 'SUCCESS' : 'WARNING');

    if (this.testResults.failed > 0) {
      this.log('\n❌ FAILED TESTS:', 'ERROR');
      this.testResults.details
        .filter(test => !test.passed)
        .forEach(test => {
          this.log(`   • ${test.description}`, 'ERROR');
        });
    }

    this.log('\n🎉 Test suite completed!', 'SUCCESS');
  }
}

// Run the tests
async function main() {
  const testTool = new CerbosTestTool();
  
  console.log(`
██████╗  █████╗ ███╗   ██╗██╗  ██╗██╗███╗   ██╗ ██████╗     ████████╗███████╗███████╗████████╗
██╔══██╗██╔══██╗████╗  ██║██║ ██╔╝██║████╗  ██║██╔════╝     ╚══██╔══╝██╔════╝██╔════╝╚══██╔══╝
██████╔╝███████║██╔██╗ ██║█████╔╝ ██║██╔██╗ ██║██║  ███╗       ██║   █████╗  ███████╗   ██║   
██╔══██╗██╔══██║██║╚██╗██║██╔═██╗ ██║██║╚██╗██║██║   ██║       ██║   ██╔══╝  ╚════██║   ██║   
██████╔╝██║  ██║██║ ╚████║██║  ██╗██║██║ ╚████║╚██████╔╝       ██║   ███████╗███████║   ██║   
╚═════╝ ╚═╝  ╚═╝╚═╝  ╚═══╝╚═╝  ╚═╝╚═╝╚═╝  ╚═══╝ ╚═════╝        ╚═╝   ╚══════╝╚══════╝   ╚═╝   
                                                                                                
🔐 Cerbos Authorization Test Suite for Banking System
  `);

  try {
    await testTool.runAllTests();
  } catch (error) {
    console.error('❌ Test suite failed:', error);
    process.exit(1);
  }
}

// Export for module usage or run directly
if (require.main === module) {
  main();
}

module.exports = CerbosTestTool;