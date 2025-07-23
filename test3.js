const axios = require('axios');

// Configuration
const BASE_URL = 'http://localhost:8000/api/bank';
const COLORS = {
  GREEN: '\x1b[32m',
  RED: '\x1b[31m',
  YELLOW: '\x1b[33m',
  BLUE: '\x1b[34m',
  RESET: '\x1b[0m',
  BOLD: '\x1b[1m'
};

// Test users credentials
const TEST_USERS = {
  john: { email: 'john.smith@email.com', password: 'password123', name: 'John Smith (Customer)' },
  sarah: { email: 'sarah.johnson@email.com', password: 'password123', name: 'Sarah Johnson (Customer)' },
  // michael: { email: 'michael.brown@email.com', password: 'password123', name: 'Michael Brown (Suspended)' },
  alice: { email: 'alice.wilson@jpmorgan.com', password: 'password123', name: 'Alice Wilson (Teller)' },
  robert: { email: 'robert.davis@jpmorgan.com', password: 'password123', name: 'Robert Davis (RM)' },
  jennifer: { email: 'jennifer.lee@jpmorgan.com', password: 'password123', name: 'Jennifer Lee (Branch Manager)' },
  david: { email: 'david.thompson@jpmorgan.com', password: 'password123', name: 'David Thompson (Compliance)' },
  maria: { email: 'maria.rodriguez@jpmorgan.com', password: 'password123', name: 'Maria Rodriguez (Auditor)' }
};

class CerbosTestTool {
  constructor() {
    this.tokens = {};
    this.passedTests = 0;
    this.failedTests = 0;
  }

  // Helper methods
  log(message, color = COLORS.RESET) {
    console.log(`${color}${message}${COLORS.RESET}`);
  }

  async login(userKey) {
    try {
      const user = TEST_USERS[userKey];
      const response = await axios.post(`${BASE_URL}/login`, {
        email: user.email,
        password: user.password
      });
      
      if (response.data.code === 200) {
        this.tokens[userKey] = response.data.data.token;
        this.log(`✓ Logged in as ${user.name}`, COLORS.GREEN);
        return true;
      }
    } catch (error) {
      this.log(`✗ Failed to login as ${userKey}: ${error.message}`, COLORS.RED);
      return false;
    }
  }

  async makeRequest(userKey, method, endpoint, data = null) {
    try {
      const config = {
        method,
        url: `${BASE_URL}${endpoint}`,
        headers: {
          'Authorization': `Bearer ${this.tokens[userKey]}`
        }
      };

      if (data) {
        config.data = data;
        config.headers['Content-Type'] = 'application/json';
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

  async testCase(description, userKey, method, endpoint, expectedResult, data = null) {
    this.log(`\n${COLORS.BLUE}Testing: ${description}${COLORS.RESET}`);
    this.log(`User: ${TEST_USERS[userKey].name} | ${method} ${endpoint}`);
    
    const result = await this.makeRequest(userKey, method, endpoint, data);
    
    const isExpectedSuccess = expectedResult === 'ALLOW';
    const actualSuccess = result.success && result.data.code === 200;
    
    if (isExpectedSuccess === actualSuccess) {
      this.log(`✓ PASSED - Expected: ${expectedResult}, Got: ${actualSuccess ? 'ALLOW' : 'DENY'}`, COLORS.GREEN);
      this.passedTests++;
    } else {
      this.log(`✗ FAILED - Expected: ${expectedResult}, Got: ${actualSuccess ? 'ALLOW' : 'DENY'}`, COLORS.RED);
      if (result.error) {
        this.log(`  Error: ${JSON.stringify(result.error)}`, COLORS.YELLOW);
      }
      this.failedTests++;
    }
  }

  async runAllTests() {
    this.log(`${COLORS.BOLD}${COLORS.BLUE}=== CERBOS AUTHORIZATION TEST SUITE ===${COLORS.RESET}\n`);
    
    // Login all users
    this.log(`${COLORS.BOLD}Phase 1: User Authentication${COLORS.RESET}`);
    for (const userKey of Object.keys(TEST_USERS)) {
      await this.login(userKey);
    }

    // Test Cases
    this.log(`\n${COLORS.BOLD}Phase 2: Authorization Tests${COLORS.RESET}`);

    // === VIEW BALANCE TESTS ===
    this.log(`\n${COLORS.BOLD}🔍 VIEW BALANCE TESTS${COLORS.RESET}`);
    
    // Account Owner Tests
    await this.testCase(
      'Account owner can view own account balance (ACC001)',
      'john', 'GET', '/accounts/ACC001/balance', 'ALLOW'
    );
    
    await this.testCase(
      'Account owner can view own account balance (ACC002)', 
      'john', 'GET', '/accounts/ACC002/balance', 'ALLOW'
    );

    // Cross-customer access (should be denied)
    await this.testCase(
      'Customer cannot view other customer\'s account (John -> Sarah\'s ACC003)',
      'john', 'GET', '/accounts/ACC003/balance', 'DENY'
    );

    await this.testCase(
      'Customer cannot view other customer\'s account (Sarah -> John\'s ACC001)',
      'sarah', 'GET', '/accounts/ACC001/balance', 'DENY'
    );

    // Staff access
    await this.testCase(
      'Teller can view customer account balance (same branch)',
      'alice', 'GET', '/accounts/ACC001/balance', 'ALLOW'
    );

    await this.testCase(
      'Relationship Manager can view customer account balance',
      'robert', 'GET', '/accounts/ACC001/balance', 'ALLOW'
    );

    // Suspended user

    // === VIEW TRANSACTIONS TESTS ===
    this.log(`\n${COLORS.BOLD}📊 VIEW TRANSACTIONS TESTS${COLORS.RESET}`);
    
    await this.testCase(
      'Account owner can view transaction history',
      'john', 'GET', '/accounts/ACC001/transactions', 'ALLOW'
    );

    await this.testCase(
      'Teller cannot view transaction history (requires senior staff)',
      'alice', 'GET', '/accounts/ACC001/transactions', 'DENY'
    );

    await this.testCase(
      'Branch Manager can view transaction history',
      'jennifer', 'GET', '/accounts/ACC001/transactions', 'ALLOW'
    );

    // === TRANSFER TESTS ===
    this.log(`\n${COLORS.BOLD}💸 TRANSFER FUNDS TESTS${COLORS.RESET}`);
    
    await this.testCase(
      'Account owner cannot transfer (2FA not verified)',
      'john', 'POST', '/accounts/ACC001/transfer', 'DENY',
      { to_account: 'ACC002', amount: 1000, description: 'Test transfer' }
    );

    await this.testCase(
      'Staff cannot transfer funds (customer-only action)',
      'alice', 'POST', '/accounts/ACC001/transfer', 'DENY',
      { to_account: 'ACC002', amount: 1000, description: 'Test transfer' }
    );

    // === DEPOSIT TESTS ===
    this.log(`\n${COLORS.BOLD}💰 DEPOSIT FUNDS TESTS${COLORS.RESET}`);
    
    await this.testCase(
      'Account owner can deposit to own account',
      'john', 'POST', '/accounts/ACC001/deposit', 'ALLOW',
      { amount: 5000, description: 'Cash deposit' }
    );

    await this.testCase(
      'Teller can deposit to customer account',
      'alice', 'POST', '/accounts/ACC001/deposit', 'ALLOW',
      { amount: 2000, description: 'Branch deposit' }
    );

    await this.testCase(
      'Customer cannot deposit to other\'s account',
      'sarah', 'POST', '/accounts/ACC001/deposit', 'DENY',
      { amount: 1000, description: 'Unauthorized deposit' }
    );

    // === FREEZE/UNFREEZE TESTS ===
    this.log(`\n${COLORS.BOLD}🧊 FREEZE/UNFREEZE ACCOUNT TESTS${COLORS.RESET}`);
    
    await this.testCase(
      'Customer cannot freeze account (admin action)',
      'john', 'POST', '/accounts/ACC001/freeze', 'DENY'
    );

    await this.testCase(
      'Teller cannot freeze account (insufficient clearance)',
      'alice', 'POST', '/accounts/ACC001/freeze', 'DENY'
    );

    await this.testCase(
      'Branch Manager can freeze account',
      'jennifer', 'POST', '/accounts/ACC001/freeze', 'ALLOW'
    );

    await this.testCase(
      'Compliance Officer can freeze account',
      'david', 'POST', '/accounts/ACC001/freeze', 'ALLOW'
    );

    // === AUDIT TESTS ===
    this.log(`\n${COLORS.BOLD}🔍 AUDIT ACCESS TESTS${COLORS.RESET}`);
    
    await this.testCase(
      'Customer cannot access audit logs',
      'john', 'GET', '/accounts/ACC001/audit', 'DENY'
    );

    await this.testCase(
      'Branch Manager cannot access audit logs',
      'jennifer', 'GET', '/accounts/ACC001/audit', 'DENY'
    );

    await this.testCase(
      'Compliance Officer can access audit logs',
      'david', 'GET', '/accounts/ACC001/audit', 'ALLOW'
    );

    await this.testCase(
      'Auditor can access audit logs',
      'maria', 'GET', '/accounts/ACC001/audit', 'ALLOW'
    );

    // Print summary
    this.printSummary();
  }

  printSummary() {
    const total = this.passedTests + this.failedTests;
    const successRate = ((this.passedTests / total) * 100).toFixed(1);
    
    this.log(`\n${COLORS.BOLD}=== TEST SUMMARY ===${COLORS.RESET}`);
    this.log(`${COLORS.GREEN}✓ Passed: ${this.passedTests}${COLORS.RESET}`);
    this.log(`${COLORS.RED}✗ Failed: ${this.failedTests}${COLORS.RESET}`);
    this.log(`${COLORS.BLUE}Total: ${total}${COLORS.RESET}`);
    this.log(`${COLORS.YELLOW}Success Rate: ${successRate}%${COLORS.RESET}`);
    
    if (this.failedTests === 0) {
      this.log(`\n${COLORS.GREEN}${COLORS.BOLD}🎉 ALL TESTS PASSED! Cerbos authorization is working correctly.${COLORS.RESET}`);
    } else {
      this.log(`\n${COLORS.RED}${COLORS.BOLD}⚠️  Some tests failed. Please check your Cerbos policies.${COLORS.RESET}`);
    }
  }

  // Quick test method for specific scenarios
  async quickTest() {
    this.log(`${COLORS.BOLD}${COLORS.BLUE}=== QUICK CERBOS TEST ===${COLORS.RESET}\n`);
    
    // Login key users
    await this.login('john');
    await this.login('sarah');
    await this.login('alice');
    await this.login('jennifer');
    
    // Key test cases
    await this.testCase('Owner views own balance', 'john', 'GET', '/accounts/ACC001/balance', 'ALLOW');
    await this.testCase('Cross-customer access denied', 'sarah', 'GET', '/accounts/ACC001/balance', 'DENY');
    await this.testCase('Teller can view balance', 'alice', 'GET', '/accounts/ACC001/balance', 'ALLOW');
    await this.testCase('Manager can freeze account', 'jennifer', 'POST', '/accounts/ACC001/freeze', 'ALLOW');
    
    this.printSummary();
  }
}

// CLI Interface
async function main() {
  const testTool = new CerbosTestTool();
  const args = process.argv.slice(2);
  
  if (args.includes('--quick')) {
    await testTool.quickTest();
  } else {
    await testTool.runAllTests();
  }
}

// Export for module usage
module.exports = CerbosTestTool;

// Run if called directly
if (require.main === module) {
  main().catch(console.error);
}

