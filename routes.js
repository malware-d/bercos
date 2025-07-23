const express = require("express");
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

module.exports = router;