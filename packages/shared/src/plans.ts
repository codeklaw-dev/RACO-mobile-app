export const PLANS = ['free', 'pro', 'team'] as const;
export type Plan = (typeof PLANS)[number];

export const WORKSPACE_KINDS = ['personal', 'team'] as const;
export type WorkspaceKind = (typeof WORKSPACE_KINDS)[number];

export const WORKSPACE_ROLES = ['owner', 'admin', 'member'] as const;
export type WorkspaceRole = (typeof WORKSPACE_ROLES)[number];

/** Messages a user may send per rolling 24 hours, per plan. */
export const DAILY_MESSAGE_LIMITS: Record<Plan, number> = {
  free: 40,
  pro: 1_000,
  team: 1_500,
};
