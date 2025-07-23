const db = {
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