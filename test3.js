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





Hãy là techleader của dự án IAM của ngân hàng JPMOrgan CHASE, đồng thời cũng là leader của độiđội phát triển phần mềm để làm tool test. Nhiệm vụ của bạn phải dựa vào những code
của backend cerbos + jwt dưới đây để làm được tooltest.js tự động hóa mọi testcase. Tool không cần lặp lại các tình huống bản chất giống nhau mà cố gắng cover được các tình huống điênr hình
Log của tool phải tập trung kỹ vào phần tương tác với cerbos để tôi thấy được flow hoạt động.



Hãy là leadtech của đội tester phần mềm của goolge. cũng là top 0.1% người trong lĩnh vực test này. Hãy đọc hiểu yêu cầu làm tool của tôi trước. Sau đó:
- Tôi sẽ gửi tool test tôi đã làm 
- Tôi sẽ gửi log chạy 
-> Từ đó cần debug xem tại sao 


Hãy là techleader của dự án IAM của ngân hàng JPMOrgan CHASE, đồng thời cũng là leader của độiđội phát triển phần mềm để làm tool test. Nhiệm vụ của bạn phải dựa vào những code
của backend cerbos + jwt dưới đây để làm được tooltest.js tự động hóa mọi testcase. Tool không cần lặp lại các tình huống bản chất giống nhau mà cố gắng cover được các tình huống điênr hình
Log của tool phải tập trung kỹ vào phần tương tác với cerbos để tôi thấy được flow hoạt động.
1. account.yaml: "---
apiVersion: "api.cerbos.dev/v1"
resourcePolicy:
  version: "default"
  resource: account
  importDerivedRoles:
    - bank_roles
  rules:
    # View account information
    - actions: ['view']
      effect: EFFECT_ALLOW
      derivedRoles:
        - account_owner
        - teller
        - branch_manager
        - compliance_officer
        - auditor
      condition:
        match:
          all:
            of:
              - expr: request.principal.attr.status == "active"

    # Update account information (limited fields for customers)
    - actions: ['update']
      effect: EFFECT_ALLOW
      derivedRoles:
        - account_owner
      condition:
        match:
          all:
            of:
              - expr: request.principal.attr.status == "active"
              - expr: request.principal.attr.email_verified == true
              - expr: request.resource.attr.frozen == false
              # Only allow updating contact info, not financial data
              - expr: |
                  has(request.resource.attr.allowed_updates) && 
                  request.resource.attr.allowed_updates.all(field, 
                    field in ["phone", "address", "email", "preferences"])

    # Update account (full access for staff)
    - actions: ['update']
      effect: EFFECT_ALLOW
      derivedRoles:
        - teller
        - branch_manager
      condition:
        match:
          all:
            of:
              - expr: request.principal.attr.status == "active"
              - expr: request.principal.attr.email_verified == true

    # Internal transfers (same bank)
    - actions: ['transfer:internal']
      effect: EFFECT_ALLOW
      derivedRoles:
        - account_owner
      condition:
        match:
          all:
            of:
              # Principal (user) validations
              - expr: request.principal.attr.status == "active"
              - expr: request.principal.attr.email_verified == true
              # Resource (account) validations
              - expr: request.resource.attr.frozen == false
              - expr: request.resource.attr.status == "active"
              # Amount validations - now correctly referencing resource
              - expr: request.resource.attr.balance >= request.resource.attr.transfer_amount
              - expr: request.principal.attr.daily_limit >= request.resource.attr.transfer_amount
              # Business rules
              - expr: request.resource.attr.transfer_amount > 0
              - expr: request.resource.attr.transfer_amount <= 50000000 # 50M VND limit for online
              # Ensure destination account exists and is valid
              - expr: has(request.resource.attr.destination_account_id)
              - expr: request.resource.attr.destination_account_id != request.resource.attr.account_id

    # External transfers (other banks)
    - actions: ['transfer:external']
      effect: EFFECT_ALLOW
      derivedRoles:
        - account_owner
      condition:
        match:
          all:
            of:
              # Principal validations
              - expr: request.principal.attr.status == "active"
              - expr: request.principal.attr.email_verified == true
              - expr: request.principal.attr.kyc_level >= 2 # Higher KYC for external transfers
              # Resource validations
              - expr: request.resource.attr.frozen == false
              - expr: request.resource.attr.status == "active"
              - expr: request.resource.attr.type == "checking" # Only checking accounts for external transfers
              # Amount validations
              - expr: request.resource.attr.balance >= request.resource.attr.transfer_amount
              - expr: request.principal.attr.daily_limit >= request.resource.attr.transfer_amount
              # Business rules for external transfers
              - expr: request.resource.attr.transfer_amount > 0
              - expr: request.resource.attr.transfer_amount <= 20000000 # 20M VND limit for external
              # Additional security for external transfers
              - expr: has(request.resource.attr.destination_bank_code)
              - expr: has(request.resource.attr.destination_account_number)

    # Staff can perform transfers with higher limits
    - actions: ['transfer:internal', 'transfer:external']
      effect: EFFECT_ALLOW
      derivedRoles:
        - teller
        - branch_manager
      condition:
        match:
          all:
            of:
              - expr: request.principal.attr.status == "active"
              - expr: request.resource.attr.frozen == false
              - expr: request.resource.attr.balance >= request.resource.attr.transfer_amount
              - expr: request.resource.attr.transfer_amount > 0
              - expr: request.resource.attr.transfer_amount <= 500000000 # 500M VND for staff

    # Cash withdrawals
    - actions: ['withdraw']
      effect: EFFECT_ALLOW
      derivedRoles:
        - account_owner
        - teller
      condition:
        match:
          all:
            of:
              # Principal validations
              - expr: request.principal.attr.status == "active"
              # Resource validations
              - expr: request.resource.attr.frozen == false
              - expr: request.resource.attr.status == "active"
              # Amount validations - fixed to reference resource correctly
              - expr: request.resource.attr.balance >= request.resource.attr.withdraw_amount
              - expr: request.principal.attr.daily_limit >= request.resource.attr.withdraw_amount
              # Business rules
              - expr: request.resource.attr.withdraw_amount > 0
              - expr: |
                  (request.principal.attr.role == "customer" && request.resource.attr.withdraw_amount <= 10000000) ||
                  (request.principal.attr.role == "teller" && request.resource.attr.withdraw_amount <= 100000000)

    # Deposit money
    - actions: ['deposit']
      effect: EFFECT_ALLOW
      derivedRoles:
        - account_owner
        - teller
        - branch_manager
      condition:
        match:
          all:
            of:
              - expr: request.principal.attr.status == "active"
              - expr: request.resource.attr.frozen == false
              - expr: request.resource.attr.status == "active"
              - expr: request.resource.attr.deposit_amount > 0
              # Anti-money laundering checks
              - expr: |
                  request.resource.attr.deposit_amount <= 100000000 ||
                  (has(request.resource.attr.aml_verified) && request.resource.attr.aml_verified == true)

    # Freeze/Unfreeze account (staff only)
    - actions: ['freeze', 'unfreeze']
      effect: EFFECT_ALLOW
      derivedRoles:
        - branch_manager
        - compliance_officer
        - security_admin
      condition:
        match:
          all:
            of:
              - expr: request.principal.attr.status == "active"
              - expr: request.principal.attr.approval_level >= 2

    # Close account
    - actions: ['close']
      effect: EFFECT_ALLOW
      derivedRoles:
        - account_owner
        - branch_manager
      condition:
        match:
          all:
            of:
              - expr: request.principal.attr.status == "active"
              - expr: request.resource.attr.balance == 0 # Must have zero balance
              - expr: request.resource.attr.frozen == false
              # Customer can close their own account, or manager can close any account
              - expr: |
                  (request.principal.attr.role == "customer" && request.principal.attr.email_verified == true) ||
                  (request.principal.attr.role == "manager" && request.principal.attr.approval_level >= 2)

    # Administrative actions
    - actions: ['admin:reset_pin', 'admin:unlock', 'admin:view_sensitive']
      effect: EFFECT_ALLOW
      derivedRoles:
        - branch_manager
        - system_admin
      condition:
        match:
          all:
            of:
              - expr: request.principal.attr.status == "active"
              - expr: request.principal.attr.approval_level >= 3

    # Audit access (read-only)
    - actions: ['audit:view', 'audit:export']
      effect: EFFECT_ALLOW
      derivedRoles:
        - auditor
        - compliance_officer
      condition:
        match:
          all:
            of:
              - expr: request.principal.attr.status == "active"
              - expr: request.principal.attr.read_only == true

    # Deny all other actions by default
    - actions: ['*']
      effect: EFFECT_DENY
      roles: ['*']"
2. derived_roles.yaml:"---
apiVersion: "api.cerbos.dev/v1"
derivedRoles:
  name: bank_roles
  definitions:
    # Customer who owns the account
    - name: account_owner
      parentRoles: ["customer"]
      condition:
        match:
          all:
            of:
              # Must be the owner of the account
              - expr: request.resource.attr.customer_id == request.principal.attr.customer_id
              # Basic user status checks
              - expr: request.principal.attr.status == "active"
              # Either external customer OR internal staff with customer role
              - expr: |
                  (request.principal.attr.email.endsWith("@mbbank.com") == false) ||
                  (request.principal.attr.email.endsWith("@mbbank.com") && request.principal.attr.role == "customer")
              # Account must not be dormant
              - expr: |
                  !has(request.resource.attr.last_activity) ||
                  (timestamp(request.resource.attr.last_activity).timeSince() < duration("365d"))

    # Bank teller - can perform customer service operations
    - name: teller
      parentRoles: ["teller"]
      condition:
        match:
          all:
            of:
              - expr: request.principal.attr.status == "active"
              - expr: request.principal.attr.email.endsWith("@mbbank.com")
              - expr: request.principal.attr.role == "teller"
              - expr: request.principal.attr.branch_code != ""
              - expr: request.principal.attr.employee_id != ""
              # Must be in working hours for high-value transactions
              - expr: |
                  now().getHours() >= 8 && now().getHours() <= 17 ||
                  request.resource.attr.transaction_amount <= 1000000

    # Branch manager - higher authority for approvals
    - name: branch_manager
      parentRoles: ["manager"]
      condition:
        match:
          all:
            of:
              - expr: request.principal.attr.status == "active"
              - expr: request.principal.attr.email.endsWith("@mbbank.com")
              - expr: request.principal.attr.role == "manager"
              - expr: request.principal.attr.approval_level >= 2
              - expr: request.principal.attr.branch_code != ""
              - expr: request.principal.attr.employee_id != ""
              # Can only manage accounts in their branch (unless head office)
              - expr: |
                  request.principal.attr.branch_code == "HO" ||
                  request.resource.attr.branch_code == request.principal.attr.branch_code

    # Compliance officer - for regulatory oversight
    - name: compliance_officer
      parentRoles: ["compliance"]
      condition:
        match:
          all:
            of:
              - expr: request.principal.attr.status == "active"
              - expr: request.principal.attr.email.endsWith("@mbbank.com")
              - expr: request.principal.attr.role == "compliance"
              - expr: request.principal.attr.department == "compliance"
              - expr: request.principal.attr.approval_level >= 3
              - expr: request.principal.attr.employee_id != ""
              # Must have valid compliance certification
              - expr: |
                  has(request.principal.attr.certification_expiry) &&
                  timestamp(request.principal.attr.certification_expiry) > now()

    # Security administrator - for security-related operations
    - name: security_admin
      parentRoles: ["security"]
      condition:
        match:
          all:
            of:
              - expr: request.principal.attr.status == "active"
              - expr: request.principal.attr.email.endsWith("@mbbank.com")
              - expr: request.principal.attr.role == "security"
              - expr: request.principal.attr.department == "security"
              - expr: request.principal.attr.approval_level >= 4
              - expr: request.principal.attr.employee_id != ""
              # Security clearance check
              - expr: |
                  has(request.principal.attr.security_clearance) &&
                  request.principal.attr.security_clearance in ["secret", "top_secret"]

    # System administrator - for technical operations
    - name: system_admin
      parentRoles: ["admin"]
      condition:
        match:
          all:
            of:
              - expr: request.principal.attr.status == "active"
              - expr: request.principal.attr.email.endsWith("@mbbank.com")
              - expr: request.principal.attr.role == "admin"
              - expr: request.principal.attr.department == "it"
              - expr: request.principal.attr.approval_level >= 5
              - expr: request.principal.attr.employee_id != ""
              # Must be during business hours or emergency access
              - expr: |
                  (now().getHours() >= 6 && now().getHours() <= 22) ||
                  (has(request.resource.attr.emergency_access) && request.resource.attr.emergency_access == true)

    # Auditor - read-only access for audit purposes
    - name: auditor
      parentRoles: ["auditor"]
      condition:
        match:
          all:
            of:
              - expr: request.principal.attr.status == "active"
              - expr: request.principal.attr.email.endsWith("@mbbank.com")
              - expr: request.principal.attr.role == "auditor"
              - expr: request.principal.attr.department == "audit"
              - expr: request.principal.attr.read_only == true
              - expr: request.principal.attr.employee_id != ""
              # Auditor must have valid audit certification
              - expr: |
                  has(request.principal.attr.audit_license) &&
                  timestamp(request.principal.attr.audit_license_expiry) > now()

    # Special role for high-value customer service
    - name: premium_service_rep
      parentRoles: ["teller"]
      condition:
        match:
          all:
            of:
              - expr: request.principal.attr.status == "active"
              - expr: request.principal.attr.email.endsWith("@mbbank.com")
              - expr: request.principal.attr.role == "teller"
              - expr: request.principal.attr.premium_certified == true
              - expr: request.principal.attr.approval_level >= 2
              # Can handle premium customers (VIP accounts)
              - expr: |
                  has(request.resource.attr.account_tier) &&
                  request.resource.attr.account_tier in ["gold", "platinum", "diamond"]

    # Emergency access role for critical situations
    - name: emergency_responder
      parentRoles: ["manager", "security"]
      condition:
        match:
          all:
            of:
              - expr: request.principal.attr.status == "active"
              - expr: request.principal.attr.email.endsWith("@mbbank.com")
              - expr: request.principal.attr.approval_level >= 3
              # Must be during declared emergency
              - expr: |
                  has(request.resource.attr.emergency_declared) &&
                  request.resource.attr.emergency_declared == true
              # Emergency access must be time-limited
              - expr: |
                  has(request.resource.attr.emergency_expires) &&
                  timestamp(request.resource.attr.emergency_expires) > now()

    # Temporary role for account recovery specialists
    - name: recovery_specialist
      parentRoles: ["teller"]
      condition:
        match:
          all:
            of:
              - expr: request.principal.attr.status == "active"
              - expr: request.principal.attr.email.endsWith("@mbbank.com")
              - expr: request.principal.attr.role == "recovery_specialist"
              - expr: request.principal.attr.department == "customer_service"
              - expr: request.principal.attr.specialized_training == true
              # Can only work on flagged recovery accounts
              - expr: |
                  has(request.resource.attr.recovery_mode) &&
                  request.resource.attr.recovery_mode == true"
3. db.js: "const db = {
  users: [
    // Customers - Khách hàng
    {
      customer_id: "MB001",
      name: "Nguyễn Văn An",
      email: "nguyenvanan@gmail.com",
      password: "customer123",
      role: "customer",
      status: "active",
      email_verified: true,
      sms_verified: true,
      daily_limit: 100000000, // 100 triệu VND
      branch_code: "MB_HN001",
      department: null,
      approval_level: 0,
      read_only: false
    },
    {
      customer_id: "MB002", 
      name: "Trần Thị Bình",
      email: "tranthibinh@yahoo.com",
      password: "customer456",
      role: "customer",
      status: "active",
      email_verified: true,
      sms_verified: false,
      daily_limit: 50000000, // 50 triệu VND
      branch_code: "MB_HN001",
      department: null,
      approval_level: 0,
      read_only: false
    },
    {
      customer_id: "MB003",
      name: "Lê Minh Cường", 
      email: "leminhcuong@hotmail.com",
      password: "customer789",
      role: "customer",
      status: "suspended",
      email_verified: true,
      sms_verified: true,
      daily_limit: 20000000, // 20 triệu VND
      branch_code: "MB_HN002",
      department: null,
      approval_level: 0,
      read_only: false
    },

    // Bank Staff - Nhân viên ngân hàng
    {
      customer_id: "EMP001",
      name: "Phạm Thị Dung",
      email: "phamthidung@mbbank.com",
      password: "teller123",
      role: "teller",
      status: "active", 
      email_verified: true,
      sms_verified: true,
      daily_limit: 0,
      branch_code: "MB_HN001",
      department: "branch_operations",
      approval_level: 1,
      read_only: false
    },
    {
      customer_id: "MGR001",
      name: "Hoàng Văn Em",
      email: "hoangvanem@mbbank.com", 
      password: "manager123",
      role: "manager",
      status: "active",
      email_verified: true,
      sms_verified: true,
      daily_limit: 0,
      branch_code: "MB_HN001",
      department: "branch_management",
      approval_level: 3,
      read_only: false
    },
    {
      customer_id: "CMP001",
      name: "Vũ Thị Giang",
      email: "vuthigiang@mbbank.com",
      password: "compliance123", 
      role: "compliance",
      status: "active",
      email_verified: true,
      sms_verified: true,
      daily_limit: 0,
      branch_code: null,
      department: "compliance",
      approval_level: 4,
      read_only: false
    },
    {
      customer_id: "SEC001",
      name: "Đặng Minh Hải",
      email: "dangminhhai@mbbank.com",
      password: "security123",
      role: "security",
      status: "active",
      email_verified: true,
      sms_verified: true, 
      daily_limit: 0,
      branch_code: null,
      department: "security",
      approval_level: 4,
      read_only: false
    },
    {
      customer_id: "AUD001",
      name: "Lý Thị Lan",
      email: "lythilan@mbbank.com",
      password: "auditor123",
      role: "auditor", 
      status: "active",
      email_verified: true,
      sms_verified: true,
      daily_limit: 0,
      branch_code: null,
      department: "audit",
      approval_level: 3,
      read_only: true
    }
  ],

  accounts: [
    {
      account_number: "0123456789",
      account_type: "savings", 
      customer_id: "MB001",
      balance: 250000000, // 250 triệu VND
      frozen: false,
      branch_code: "MB_HN001",
      opened_date: "2023-01-15",
      currency: "VND"
    },
    {
      account_number: "0987654321",
      account_type: "checking",
      customer_id: "MB002", 
      balance: 75000000, // 75 triệu VND
      frozen: false,
      branch_code: "MB_HN001", 
      opened_date: "2023-03-20",
      currency: "VND"
    },
    {
      account_number: "1122334455",
      account_type: "savings",
      customer_id: "MB003",
      balance: 10000000, // 10 triệu VND
      frozen: true, // Tài khoản bị đóng băng
      branch_code: "MB_HN002",
      opened_date: "2022-12-10", 
      currency: "VND"
    }
  ],

  transactions: [
    {
      transaction_id: "TXN001",
      from_account: "0123456789",
      to_account: "0987654321", 
      amount: 5000000, // 5 triệu VND
      transaction_type: "internal_transfer",
      status: "completed",
      timestamp: "2024-01-20T10:30:00Z",
      description: "Chuyển khoản cho bạn"
    },
    {
      transaction_id: "TXN002",
      from_account: "0987654321",
      to_account: "external_bank_account",
      amount: 2000000, // 2 triệu VND
      transaction_type: "external_transfer", 
      status: "pending",
      timestamp: "2024-01-20T14:15:00Z",
      description: "Thanh toán hóa đơn"
    }
  ]
};

module.exports = db;
4. route.js: "const express = require("express");
const router = express.Router();
const db = require("./db");
const authorization = require("./authorization");
const { verifyToken } = require("./jwt");

// Helper function to check if account exists and get account info
const checkAccountExistAndGet = (accountNumber) => {
  const account = db.accounts.find((item) => item.account_number === accountNumber);
  if (!account) throw new Error("Account doesn't exist");
  return account;
};

// Helper function to generate transaction ID
const generateTransactionId = () => {
  return "TXN" + Math.floor(Math.random() * 999999 + 100000);
};

// Apply JWT verification to all routes
router.use(verifyToken);

// GET /accounts - Xem danh sách tài khoản (chỉ admin có thể xem tất cả)
router.get("/", async (req, res, next) => {
  try {
    await authorization(req.user, "view:admin");
    
    const accounts = db.accounts.map(acc => ({
      ...acc,
      // Ẩn số dư cho auditor
      balance: req.user.read_only ? "***" : acc.balance
    }));

    res.json({
      code: 200,
      data: accounts,
      message: "All accounts fetched successfully"
    });
  } catch (error) {
    next(error);
  }
});

// GET /accounts/:accountNumber - Xem thông tin tài khoản cụ thể
router.get("/:accountNumber", async (req, res, next) => {
  try {
    const accountNumber = req.params.accountNumber;
    const account = checkAccountExistAndGet(accountNumber);

    await authorization(req.user, "view:balance", account);

    res.json({
      code: 200,
      data: account,
      message: "Account details fetched successfully"
    });
  } catch (error) {
    next(error);
  }
});

// GET /accounts/:accountNumber/balance - Xem số dư tài khoản
router.get("/:accountNumber/balance", async (req, res, next) => {
  try {
    const accountNumber = req.params.accountNumber;
    const account = checkAccountExistAndGet(accountNumber);

    await authorization(req.user, "view:balance", account);

    res.json({
      code: 200,
      data: {
        account_number: account.account_number,
        balance: account.balance,
        currency: account.currency,
        frozen: account.frozen
      },
      message: "Account balance fetched successfully"
    });
  } catch (error) {
    next(error);
  }
});

// POST /accounts - Tạo tài khoản mới
router.post("/", async (req, res, next) => {
  try {
    const { customer_id, account_type, initial_deposit = 0 } = req.body;

    const newAccount = {
      account_number: Math.floor(Math.random() * 9999999999 + 1000000000).toString(),
      account_type,
      customer_id,
      balance: initial_deposit,
      frozen: false,
      branch_code: req.user.branch_code,
      opened_date: new Date().toISOString().split('T')[0],
      currency: "VND"
    };

    await authorization(req.user, "create:account", newAccount);

    db.accounts.push(newAccount);

    res.status(201).json({
      code: 201,
      data: newAccount,
      message: "Account created successfully"
    });
  } catch (error) {
    next(error);
  }
});

// POST /accounts/:accountNumber/deposit - Nộp tiền vào tài khoản
router.post("/:accountNumber/deposit", async (req, res, next) => {
  try {
    const accountNumber = req.params.accountNumber;
    const { amount, description = "Deposit" } = req.body;

    if (!amount || amount <= 0) {
      throw new Error("Invalid deposit amount");
    }

    const account = checkAccountExistAndGet(accountNumber);
    
    await authorization(req.user, "deposit", {
      ...account,
      deposit_amount: amount
    });

    // Update account balance
    const updatedAccounts = db.accounts.map((acc) => {
      if (acc.account_number === accountNumber) {
        return {
          ...acc,
          balance: acc.balance + amount
        };
      }
      return acc;
    });

    db.accounts = updatedAccounts;

    // Create transaction record
    const transaction = {
      transaction_id: generateTransactionId(),
      from_account: "cash",
      to_account: accountNumber,
      amount,
      transaction_type: "deposit",
      status: "completed",
      timestamp: new Date().toISOString(),
      description,
      processed_by: req.user.email
    };

    db.transactions.push(transaction);

    res.json({
      code: 200,
      data: {
        transaction,
        new_balance: account.balance + amount
      },
      message: "Deposit completed successfully"
    });
  } catch (error) {
    next(error);
  }
});

// POST /accounts/:accountNumber/withdraw - Rút tiền từ tài khoản
router.post("/:accountNumber/withdraw", async (req, res, next) => {
  try {
    const accountNumber = req.params.accountNumber;
    const { amount, description = "Withdrawal" } = req.body;

    if (!amount || amount <= 0) {
      throw new Error("Invalid withdrawal amount");
    }

    const account = checkAccountExistAndGet(accountNumber);

    await authorization(req.user, "withdraw", {
      ...account,
      withdraw_amount: amount
    });

    // Update account balance
    const updatedAccounts = db.accounts.map((acc) => {
      if (acc.account_number === accountNumber) {
        return {
          ...acc,
          balance: acc.balance - amount
        };
      }
      return acc;
    });

    db.accounts = updatedAccounts;

    // Create transaction record
    const transaction = {
      transaction_id: generateTransactionId(),
      from_account: accountNumber,
      to_account: "cash",
      amount,
      transaction_type: "withdrawal",
      status: "completed",
      timestamp: new Date().toISOString(),
      description,
      processed_by: req.user.email
    };

    db.transactions.push(transaction);

    res.json({
      code: 200,
      data: {
        transaction,
        new_balance: account.balance - amount
      },
      message: "Withdrawal completed successfully"
    });
  } catch (error) {
    next(error);
  }
});

// POST /accounts/:accountNumber/transfer - Chuyển khoản
router.post("/:accountNumber/transfer", async (req, res, next) => {
  try {
    const fromAccount = req.params.accountNumber;
    const { to_account, amount, description = "Transfer", transfer_type = "internal" } = req.body;

    if (!amount || amount <= 0) {
      throw new Error("Invalid transfer amount");
    }

    if (!to_account) {
      throw new Error("Destination account is required");
    }

    const sourceAccount = checkAccountExistAndGet(fromAccount);
    
    // Determine action based on transfer type
    const action = transfer_type === "external" ? "transfer:external" : "transfer:internal";

    await authorization(req.user, action, {
      ...sourceAccount,
      transfer_amount: amount
    });

    // For internal transfers, check if destination account exists
    if (transfer_type === "internal") {
      const destAccount = checkAccountExistAndGet(to_account);

      // Update both accounts
      const updatedAccounts = db.accounts.map((acc) => {
        if (acc.account_number === fromAccount) {
          return {
            ...acc,
            balance: acc.balance - amount
          };
        }
        if (acc.account_number === to_account) {
          return {
            ...acc,
            balance: acc.balance + amount
          };
        }
        return acc;
      });

      db.accounts = updatedAccounts;
    } else {
      // External transfer - only deduct from source account
      const updatedAccounts = db.accounts.map((acc) => {
        if (acc.account_number === fromAccount) {
          return {
            ...acc,
            balance: acc.balance - amount
          };
        }
        return acc;
      });

      db.accounts = updatedAccounts;
    }

    // Create transaction record
    const transaction = {
      transaction_id: generateTransactionId(),
      from_account: fromAccount,
      to_account,
      amount,
      transaction_type: `${transfer_type}_transfer`,
      status: transfer_type === "external" ? "pending" : "completed",
      timestamp: new Date().toISOString(),
      description,
      processed_by: req.user.email
    };

    db.transactions.push(transaction);

    const newBalance = sourceAccount.balance - amount;

    res.json({
      code: 200,
      data: {
        transaction,
        new_balance: newBalance
      },
      message: `${transfer_type === "external" ? "External" : "Internal"} transfer ${transfer_type === "external" ? "initiated" : "completed"} successfully`
    });
  } catch (error) {
    next(error);
  }
});

// POST /accounts/:accountNumber/freeze - Đóng băng tài khoản
router.post("/:accountNumber/freeze", async (req, res, next) => {
  try {
    const accountNumber = req.params.accountNumber;
    const { reason = "Security freeze" } = req.body;

    const account = checkAccountExistAndGet(accountNumber);

    await authorization(req.user, "freeze", account);

    // Update account status
    const updatedAccounts = db.accounts.map((acc) => {
      if (acc.account_number === accountNumber) {
        return {
          ...acc,
          frozen: true,
          freeze_reason: reason,
          frozen_by: req.user.email,
          frozen_at: new Date().toISOString()
        };
      }
      return acc;
    });

    db.accounts = updatedAccounts;

    res.json({
      code: 200,
      data: {
        account_number: accountNumber,
        frozen: true,
        reason,
        frozen_by: req.user.email
      },
      message: "Account frozen successfully"
    });
  } catch (error) {
    next(error);
  }
});

// POST /accounts/:accountNumber/unfreeze - Mở băng tài khoản
router.post("/:accountNumber/unfreeze", async (req, res, next) => {
  try {
    const accountNumber = req.params.accountNumber;
    const { reason = "Unfreeze approved" } = req.body;

    const account = checkAccountExistAndGet(accountNumber);

    await authorization(req.user, "unfreeze", account);

    // Update account status
    const updatedAccounts = db.accounts.map((acc) => {
      if (acc.account_number === accountNumber) {
        return {
          ...acc,
          frozen: false,
          unfreeze_reason: reason,
          unfrozen_by: req.user.email,
          unfrozen_at: new Date().toISOString()
        };
      }
      return acc;
    });

    db.accounts = updatedAccounts;

    res.json({
      code: 200,
      data: {
        account_number: accountNumber,
        frozen: false,
        reason,
        unfrozen_by: req.user.email
      },
      message: "Account unfrozen successfully"
    });
  } catch (error) {
    next(error);
  }
});

// GET /accounts/:accountNumber/transactions - Xem lịch sử giao dịch
router.get("/:accountNumber/transactions", async (req, res, next) => {
  try {
    const accountNumber = req.params.accountNumber;
    const account = checkAccountExistAndGet(accountNumber);

    await authorization(req.user, "view:statement", account);

    const transactions = db.transactions.filter(
      (txn) => txn.from_account === accountNumber || txn.to_account === accountNumber
    );

    res.json({
      code: 200,
      data: transactions,
      message: "Transaction history fetched successfully"
    });
  } catch (error) {
    next(error);
  }
});

// GET /transactions - Xem tất cả giao dịch (chỉ admin)
router.get("/admin/transactions", async (req, res, next) => {
  try {
    await authorization(req.user, "view:admin");

    res.json({
      code: 200,
      data: db.transactions,
      message: "All transactions fetched successfully"
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;"
5. jwt.js: "const jwt = require('jsonwebtoken');
const { users } = require('./db');

const JWT_SECRET = 'd1f8a9b3c5e7f2a4d6c8b0e5f3a7d2c1b5e8f3a6d9c2b7e4f1a8d3c6b9e5f2a1';

// Generate JWT Token
const generateToken = (user) => {
  const payload = {
    customer_id: user.customer_id,
    email: user.email,
    role: user.role,
    branch_code: user.branch_code,
    department: user.department,
    approval_level: user.approval_level,
    status: user.status,
    email_verified: user.email_verified,
    sms_verified: user.sms_verified,
    daily_limit: user.daily_limit,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + (24 * 60 * 60) // 24 hours
  };

  return jwt.sign(payload, JWT_SECRET);
};

// Verify JWT Token Middleware
const verifyToken = (req, res, next) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({
        code: 401,
        message: 'Access token is required'
      });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    
    // Check if token is expired
    if (decoded.exp < Math.floor(Date.now() / 1000)) {
      return res.status(401).json({
        code: 401,
        message: 'Token has expired'
      });
    }

    // Verify user still exists and is active
    const user = users.find(u => u.customer_id === decoded.customer_id);
    if (!user || user.status !== 'active') {
      return res.status(401).json({
        code: 401,
        message: 'Invalid or inactive user'
      });
    }

    // Add user info to request
    req.user = {
      ...decoded,
      ...user
    };

    next();
  } catch (error) {
    return res.status(401).json({
      code: 401,
      message: 'Invalid token',
      error: error.message
    });
  }
};

// Login endpoint
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        code: 400,
        message: 'Email and password are required'
      });
    }

    // Find user by email
    const user = users.find(u => u.email === email);
    
    if (!user || user.password !== password) {
      return res.status(401).json({
        code: 401,
        message: 'Invalid credentials'
      });
    }

    if (user.status !== 'active') {
      return res.status(401).json({
        code: 401,
        message: 'Account is not active'
      });
    }

    // Generate token
    const token = generateToken(user);

    // Return token and user info (excluding password)
    const { password: _, ...userInfo } = user;
    
    res.json({
      code: 200,
      message: 'Login successful',
      data: {
        token,
        user: userInfo
      }
    });

  } catch (error) {
    res.status(500).json({
      code: 500,
      message: 'Internal server error',
      error: error.message
    });
  }
};

module.exports = {
  generateToken,
  verifyToken,
  login,
  JWT_SECRET
};""
6. đây là 1 phần của phần hướng dẫn tương tác với backend: " "Server sẽ chạy trên http://localhost:8000
🔑 API Authentication
Login
 
 
bash

Plain Text

POST /auth/loginContent-Type: application/json {   "email": "nguyenvanan@gmail.com",  "password": "customer123" }
Response:
 
 
json

Plain Text

{   "code": 200,   "message": "Login successful",   "data": {     "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",     "user": { ... }   } }
Sử dụng Token
 
 
bash

Plain Text

Authorization: Bearer <your-jwt-token>
📚 API Documentation
Account Management
Xem thông tin tài khoản
 
 
bash

Plain Text

GET /accounts/:accountNumberAuthorization: Bearer <token>
Xem số dư
 
 
bash

Plain Text

GET /accounts/:accountNumber/balanceAuthorization: Bearer <token>
Nộp tiền
 
 
bash

Plain Text

POST /accounts/:accountNumber/depositAuthorization: Bearer <token> Content-Type: application/json {   "amount": 1000000,  "description": "Nộp tiền mặt" }
Rút tiền
 
 
bash

Plain Text

POST /accounts/:accountNumber/withdrawAuthorization: Bearer <token> Content-Type: application/json {   "amount": 500000,  "description": "Rút tiền ATM" }
Chuyển khoản
 
 
bash

Plain Text

POST /accounts/:accountNumber/transferAuthorization: Bearer <token> Content-Type: application/json {   "to_account": "0987654321",  "amount": 2000000,  "description": "Chuyển tiền cho bạn",  "transfer_type": "internal" }
Đóng băng tài khoản (Manager+)
 
 
bash

Plain Text

POST /accounts/:accountNumber/freezeAuthorization: Bearer <token> Content-Type: application/json {   "reason": "Suspicious activity" }
""
