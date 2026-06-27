// src/backend/api/middlewares/auth.middleware.ts

import { Request, Response, NextFunction } from "express";
import { UnauthorizedException, ForbiddenException } from "../../domain/exceptions.ts";
import { AuthService, TokenPayload } from "../../application/services/auth.service.ts";
import { uow, logger } from "../context.ts";

const authService = new AuthService(uow, logger);

/**
 * Custom request interface representing authenticated HTTP traffic
 */
export interface AuthenticatedRequest extends Request {
  user?: TokenPayload;
}

/**
 * Authentication Middleware: decrypts access token, verifies expiry, and attaches claims payload to request state.
 */
export const authenticateUser = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    throw new UnauthorizedException("Access token is missing. Please provide a Bearer token.");
  }

  const parts = authHeader.split(" ");
  if (parts.length !== 2 || parts[0].toLowerCase() !== "bearer") {
    throw new UnauthorizedException("Invalid authorization header format. Use 'Bearer <token>'.");
  }

  const token = parts[1];

  try {
    const userPayload = authService.verifyAccessToken(token);
    (req as AuthenticatedRequest).user = userPayload;
    next();
  } catch (err: any) {
    next(err);
  }
};

/**
 * RBAC Role authorization check
 */
export const requireRole = (allowedRoles: string | string[]) => {
  const roles = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];

  return (req: Request, res: Response, next: NextFunction): void => {
    const authReq = req as AuthenticatedRequest;
    if (!authReq.user) {
      throw new UnauthorizedException("Session invalid. Authentication is required before authorization.");
    }

    const hasRole = roles.includes(authReq.user.roleName);
    if (!hasRole) {
      logger.warn(`Authorization violation: User ${authReq.user.email} (Role: ${authReq.user.roleName}) lacks one of the allowed roles [${roles.join(", ")}]`);
      throw new ForbiddenException(`Access forbidden. This action requires one of the following roles: [${roles.join(", ")}].`);
    }

    next();
  };
};

/**
 * fine-grained Permission-based authorization check
 */
export const requirePermission = (requiredPermissions: string | string[]) => {
  const permissions = Array.isArray(requiredPermissions) ? requiredPermissions : [requiredPermissions];

  return (req: Request, res: Response, next: NextFunction): void => {
    const authReq = req as AuthenticatedRequest;
    if (!authReq.user) {
      throw new UnauthorizedException("Session invalid. Authentication is required before authorization.");
    }

    // Admins have automatic global permission bypass override
    if (authReq.user.roleName === "super_admin") {
      return next();
    }

    // Check if user has all requested permissions
    const userPermissions = authReq.user.permissions || [];
    const hasAllPermissions = permissions.every(p => userPermissions.includes(p));

    if (!hasAllPermissions) {
      const missingPermissions = permissions.filter(p => !userPermissions.includes(p));
      logger.warn(`Authorization violation: User ${authReq.user.email} lacks permissions: [${missingPermissions.join(", ")}]`);
      throw new ForbiddenException(`Access forbidden. Lacking the following permissions: [${missingPermissions.join(", ")}].`);
    }

    next();
  };
};
