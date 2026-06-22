export type RuleStatus = "active" | "inactive" | "pending";

export interface Rule {
  id: string;
  name: string;
  description: string;
  status: RuleStatus;
  createdAt: string;
  updatedAt: string;
}

export type ApprovalStatus = "pending" | "approved" | "rejected";

export interface Approval {
  id: string;
  ruleId: string;
  ruleName: string;
  requestedBy: string;
  status: ApprovalStatus;
  createdAt: string;
}
