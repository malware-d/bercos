const { GRPC } = require("@cerbos/grpc");
const { users } = require("./db");

// The Cerbos PDP instance
const cerbos = new GRPC("localhost:3593", {
  tls: false,
});

const SHOW_PDP_REQUEST_LOG = process.env.NODE_ENV === 'development';

module.exports = async (userInfo, action, resourceAttr = {}) => {
  try {
    // Get user from database for most up-to-date info
    const user = users.find((item) => item.customer_id === userInfo.customer_id);
    
    if (!user) {
      throw new Error("User not found");
    }

    if (user.status !== 'active') {
      throw new Error("User account is not active");
    }

    // Enhanced user attributes for banking context
    const enhancedUserAttr = {
      ...user,
      // Add dynamic attributes for transfer/withdraw amounts from request
      transfer_amount: resourceAttr.transfer_amount || 0,
      withdraw_amount: resourceAttr.withdraw_amount || 0,
    };

    const cerbosObject = {
      resource: {
        kind: "account",
        policyVersion: "default",
        id: resourceAttr.account_number || "new",
        attributes: {
          ...resourceAttr,
          // Ensure these attributes are always present
          balance: resourceAttr.balance || 0,
          frozen: resourceAttr.frozen || false,
          customer_id: resourceAttr.customer_id || null,
          branch_code: resourceAttr.branch_code || null,
        },
      },
      principal: {
        id: user.customer_id,
        policyVersion: "default",
        roles: [user.role],
        attributes: enhancedUserAttr,
      },
      actions: [action],
    };

    if (SHOW_PDP_REQUEST_LOG) {
      console.log("=== MBBank Cerbos Authorization Request ===");
      console.log(JSON.stringify(cerbosObject, null, 2));
      console.log("===========================================");
    }

    const cerbosCheck = await cerbos.checkResource(cerbosObject);
    const isAuthorized = cerbosCheck.isAllowed(action);

    if (!isAuthorized) {
      // Get detailed reason for denial (if available)
      const validationErrors = cerbosCheck.validationErrors || [];
      const errorMessage = validationErrors.length > 0 
        ? `Authorization denied: ${validationErrors[0].message}`
        : `You are not authorized to perform action: ${action}`;
      
      throw new Error(errorMessage);
    }

    // Log successful authorization for audit trail
    console.log(`[AUDIT] User ${user.email} (${user.role}) successfully authorized for action: ${action} on resource: ${resourceAttr.account_number || 'new'}`);

    return true;

  } catch (error) {
    // Log failed authorization attempts for security monitoring
    console.error(`[SECURITY] Authorization failed for user ${userInfo?.email || 'unknown'} - Action: ${action} - Error: ${error.message}`);
    throw error;
  }
};