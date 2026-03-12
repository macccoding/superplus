export const ROLES = ['owner', 'manager', 'supervisor', 'staff'] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_HIERARCHY: Record<Role, number> = {
  owner: 4,
  manager: 3,
  supervisor: 2,
  staff: 1,
};

export type AppId =
  | 'product-lookup'
  | 'stock-out'
  | 'expiry-spotter'
  | 'daily-specials'
  | 'suggestion-box'
  | 'closing-checklist'
  | 'restock-trigger'
  | 'markdown-tool'
  | 'task-board'
  | 'issue-logger'
  | 'dashboard'
  | 'calculator';

export const APP_ACCESS: Record<AppId, Role[]> = {
  // Staff apps — accessible to everyone
  'product-lookup': ['owner', 'manager', 'supervisor', 'staff'],
  'stock-out': ['owner', 'manager', 'supervisor', 'staff'],
  'expiry-spotter': ['owner', 'manager', 'supervisor', 'staff'],
  'daily-specials': ['owner', 'manager', 'supervisor', 'staff'],
  'suggestion-box': ['owner', 'manager', 'supervisor', 'staff'],
  calculator: ['owner', 'manager', 'supervisor', 'staff'],

  // Supervisor apps — supervisor and above
  'closing-checklist': ['owner', 'manager', 'supervisor'],
  'restock-trigger': ['owner', 'manager', 'supervisor'],
  'markdown-tool': ['owner', 'manager', 'supervisor'],
  'task-board': ['owner', 'manager', 'supervisor', 'staff'], // staff can view/complete tasks
  'issue-logger': ['owner', 'manager', 'supervisor'],

  // Management — manager and above
  dashboard: ['owner', 'manager'],
};

export function hasAccess(role: Role, appId: AppId): boolean {
  return APP_ACCESS[appId].includes(role);
}

export function hasMinRole(userRole: Role, requiredRole: Role): boolean {
  return ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY[requiredRole];
}
