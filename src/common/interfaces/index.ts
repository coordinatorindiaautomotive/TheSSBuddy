// src/common/interfaces/index.ts
export interface JwtPayload {
  sub: string;
  username: string;
  roles: string[];
}

export interface AuthenticatedRequest extends Request {
  user: JwtPayload & { id: string };
  branchContext: {
    userId: string;
    branchCodes: string[];
    defaultBranchCode?: string;
  };
}
