export const ROLES = ['OWNER', 'MANAGER', 'SUPERVISOR', 'STAFF'] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_HIERARCHY: Record<Role, number> = {
  OWNER: 4,
  MANAGER: 3,
  SUPERVISOR: 2,
  STAFF: 1,
};

export function hasMinRole(userRole: Role, requiredRole: Role): boolean {
  return ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY[requiredRole];
}

export type SubdomainApp = 'hub' | 'admin' | 'tools';

export const SUBDOMAIN_ACCESS: Record<SubdomainApp, Role[]> = {
  hub: ['OWNER', 'MANAGER', 'SUPERVISOR', 'STAFF'],
  admin: ['OWNER', 'MANAGER'],
  tools: ['OWNER', 'MANAGER', 'SUPERVISOR', 'STAFF'],
};
