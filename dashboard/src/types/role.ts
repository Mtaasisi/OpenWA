// Role types for RBAC
export type UserRole = 'admin' | 'operator' | 'viewer';

export interface RoleContextType {
  role: UserRole | null;
  /** True only after /api/auth/validate succeeded in this session. */
  roleValidated: boolean;
  setRole: (role: UserRole | null) => void;
  setRoleValidated: (validated: boolean) => void;
  isAdmin: boolean;
  isOperator: boolean;
  isViewer: boolean;
  canWrite: boolean;
}
