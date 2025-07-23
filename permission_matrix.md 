# 🔐 MA TRẬN PHÂN QUYỀN HỆ THỐNG BANKING

## 📋 Bảng phân quyền chi tiết

| Role / Action | view:balance | view:statement | transfer:internal | transfer:external | deposit | withdraw | freeze | unfreeze | view:admin | create:account |
|---------------|--------------|----------------|-------------------|-------------------|---------|----------|--------|----------|------------|----------------|
| **account_owner** | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **teller** | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ | ❌ | ❌ | ❌ | ✅ |
| **branch_manager** | ✅ | ✅ | ❌ | ❌ | ✅ | ❌ | ✅ | ✅ | ✅ | ✅ |
| **compliance_officer** | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ | ❌ |
| **security_admin** | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ✅ | ❌ |
| **auditor** | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ |

## 🎯 Derived Roles Conditions

### account_owner
- **Parent Role**: customer
- **Conditions**: 
  - `request.resource.attr.customer_id == request.principal.attr.customer_id`
  - `request.principal.attr.status == "active"`
  - `request.principal.attr.email.endsWith("@mbbank.com") == false || request.principal.attr.role == "customer"`

### teller
- **Parent Role**: teller
- **Conditions**:
  - `request.principal.attr.status == "active"`
  - `request.principal.attr.email.endsWith("@mbbank.com")`
  - `request.principal.attr.branch_code != ""`

### branch_manager
- **Parent Role**: manager
- **Conditions**:
  - `request.principal.attr.status == "active"`
  - `request.principal.attr.email.endsWith("@mbbank.com")`
  - `request.principal.attr.approval_level >= 2`
  - `request.principal.attr.branch_code != ""`

### compliance_officer
- **Parent Role**: compliance
- **Conditions**:
  - `request.principal.attr.status == "active"`
  - `request.principal.attr.email.endsWith("@mbbank.com")`
  - `request.principal.attr.department == "compliance"`
  - `request.principal.attr.approval_level >= 3`

### security_admin
- **Parent Role**: security
- **Conditions**:
  - `request.principal.attr.status == "active"`
  - `request.principal.attr.email.endsWith("@mbbank.com")`
  - `request.principal.attr.department == "security"`
  - `request.principal.attr.approval_level >= 4`

### auditor
- **Parent Role**: auditor
- **Conditions**:
  - `request.principal.attr.status == "active"`
  - `request.principal.attr.email.endsWith("@mbbank.com")`
  - `request.principal.attr.department == "audit"`
  - `request.principal.attr.read_only == true`

## 🔧 Business Rules

### Global Conditions (All Actions)
- `request.principal.attr.status == "active"`
- `request.principal.attr.email_verified == true`

### view:balance & view:statement
- ✅ **Allowed for**: account_owner, branch_manager, compliance_officer, auditor
- 📋 **Additional conditions**: None beyond global

### transfer:internal
- ✅ **Allowed for**: account_owner only
- 📋 **Additional conditions**:
  - `request.resource.attr.balance >= request.principal.attr.transfer_amount`
  - `request.principal.attr.daily_limit >= request.principal.attr.transfer_amount`
  - `request.resource.attr.frozen == false`

### transfer:external
- ✅ **Allowed for**: account_owner only
- 📋 **Additional conditions**:
  - `request.principal.attr.sms_verified == true`
  - `request.resource.attr.balance >= request.principal.attr.transfer_amount`
  - `request.principal.attr.daily_limit >= request.principal.attr.transfer_amount`
  - `request.resource.attr.frozen == false`
  - `request.principal.attr.transfer_amount <= 50000000` (50 triệu VND)

### deposit
- ✅ **Allowed for**: account_owner, teller, branch_manager
- 📋 **Additional conditions**:
  - `request.resource.attr.frozen == false`

### withdraw
- ✅ **Allowed for**: account_owner, teller
- 📋 **Additional conditions**:
  - `request.resource.attr.balance >= request.principal.attr.withdraw_amount`
  - `request.resource.attr.frozen == false`
  - `request.principal.attr.daily_limit >= request.principal.attr.withdraw_amount`

### freeze
- ✅ **Allowed for**: branch_manager, compliance_officer, security_admin
- 📋 **Additional conditions**: None beyond global

### unfreeze
- ✅ **Allowed for**: branch_manager, compliance_officer
- 📋 **Additional conditions**:
  - `request.principal.attr.approval_level >= 2`

### view:admin
- ✅ **Allowed for**: branch_manager, compliance_officer, security_admin, auditor
- 📋 **Additional conditions**: None beyond global

### create:account
- ✅ **Allowed for**: teller, branch_manager
- 📋 **Additional conditions**:
  - `request.principal.attr.branch_code == request.resource.attr.branch_code`

## 👥 Test Users Overview

| User | Email | Role | Status | Branch | Approval Level | Special Notes |
|------|-------|------|--------|--------|----------------|---------------|
| Nguyễn Văn An | nguyenvanan@gmail.com | customer | active | MB_HN001 | 0 | SMS verified |
| Trần Thị Bình | tranthibinh@yahoo.com | customer | active | MB_HN001 | 0 | No SMS |
| Lê Minh Cường | leminhcuong@hotmail.com | customer | suspended | MB_HN002 | 0 | Suspended |
| Phạm Thị Dung | phamthidung@mbbank.com | teller | active | MB_HN001 | 1 | Can deposit/withdraw |
| Hoàng Văn Em | hoangvanem@mbbank.com | manager | active | MB_HN001 | 3 | Branch manager |
| Vũ Thị Giang | vuthigiang@mbbank.com | compliance | active | null | 4 | Compliance officer |
| Đặng Minh Hải | dangminhhai@mbbank.com | security | active | null | 4 | Security admin |
| Lý Thị Lan | lythilan@mbbank.com | auditor | active | null | 3 | Read-only access |

## 💰 Account Data

| Account Number | Owner | Balance | Status | Branch |
|----------------|-------|---------|--------|--------|
| 0123456789 | MB001 (Nguyễn Văn An) | 250,000,000 VND | Active | MB_HN001 |
| 0987654321 | MB002 (Trần Thị Bình) | 75,000,000 VND | Active | MB_HN001 |
| 1122334455 | MB003 (Lê Minh Cường) | 10,000,000 VND | **Frozen** | MB_HN002 |