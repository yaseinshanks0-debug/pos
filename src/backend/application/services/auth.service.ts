// src/backend/application/services/auth.service.ts

import crypto from "crypto";
import jwt from "jsonwebtoken";
import { IUnitOfWork } from "../ports/unit-of-work.interface.ts";
import { ILogger } from "../ports/logger.interface.ts";
import { IUserRepository } from "../../domain/repository.interface.ts";
import { 
  UnauthorizedException, 
  ForbiddenException, 
  ValidationError, 
  NotFoundException, 
  BusinessRuleException 
} from "../../domain/exceptions.ts";

const JWT_DEFAULT_SECRET = "super_secure_enterprise_jwt_secret_key_2026";
const JWT_DEFAULT_REFRESH_SECRET = "super_secure_enterprise_jwt_refresh_secret_key_2026";

export interface TokenPayload {
  userId: number;
  email: string;
  fullName: string;
  roleId: number;
  roleName: string;
  companyId: number;
  storeId: number | null;
  permissions: string[];
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number; // in seconds
}

export class AuthService {
  private readonly jwtSecret: string;
  private readonly jwtRefreshSecret: string;

  constructor(
    private readonly uow: IUnitOfWork,
    private readonly logger: ILogger
  ) {
    this.jwtSecret = process.env.JWT_SECRET || JWT_DEFAULT_SECRET;
    this.jwtRefreshSecret = process.env.JWT_REFRESH_SECRET || JWT_DEFAULT_REFRESH_SECRET;
  }

  /**
   * Generates salt and password hash using standard secure PBKDF2 cryptography
   */
  public hashPassword(password: string): string {
    const salt = crypto.randomBytes(16).toString("hex");
    const hash = crypto.pbkdf2Sync(password, salt, 10000, 64, "sha512").toString("hex");
    return `${salt}:${hash}`;
  }

  /**
   * Verifies an input password against stored hash pattern
   */
  public verifyPassword(password: string, storedHash: string): boolean {
    const [salt, originalHash] = storedHash.split(":");
    if (!salt || !originalHash) return false;
    const hash = crypto.pbkdf2Sync(password, salt, 10000, 64, "sha512").toString("hex");
    return hash === originalHash;
  }

  /**
   * Authenticate user with secure account lockout protection & audit logging
   */
  public async login(email: string, password: string, device?: string): Promise<AuthTokens & { user: any }> {
    this.logger.info(`Login attempt for email: ${email}`);

    return this.uow.runInTransaction(async (txUow, tx) => {
      const userRepo = txUow.getRepository<any>("users", tx) as unknown as IUserRepository;
      const auditRepo = txUow.getRepository<any>("auditLogs", tx);

      const user = await userRepo.findByEmail(email);
      if (!user) {
        this.logger.warn(`Auth failed: User not found for email ${email}`);
        throw new UnauthorizedException("Invalid email or password.");
      }

      if (!user.isActive) {
        this.logger.warn(`Auth failed: Account suspended for email ${email}`);
        throw new ForbiddenException("Your account is deactivated. Please contact support.");
      }

      // Check Account Lockout
      if (user.lockoutUntil && new Date(user.lockoutUntil) > new Date()) {
        const remainingMs = new Date(user.lockoutUntil).getTime() - Date.now();
        const minutes = Math.ceil(remainingMs / 60000);
        this.logger.warn(`Auth failed: Locked out user attempt for ${email}`);
        throw new ForbiddenException(`Account is temporarily locked due to multiple failed attempts. Try again in ${minutes} minute(s).`);
      }

      // If user does not have a local password set (e.g. they only signed up via legacy means)
      if (!user.passwordHash) {
        this.logger.info(`Password not set for local login for user ${email}. Auto-initializing with 'admin123' hash.`);
        const defaultHash = this.hashPassword("admin123");
        await userRepo.update(user.id, { passwordHash: defaultHash });
        user.passwordHash = defaultHash;
      }

      const isValidPassword = this.verifyPassword(password, user.passwordHash);

      if (!isValidPassword) {
        const attempts = user.failedLoginAttempts + 1;
        const updates: Record<string, any> = { failedLoginAttempts: attempts };
        let lockoutMsg = "";

        if (attempts >= 5) {
          // Lock out for 15 minutes
          const lockoutTime = new Date(Date.now() + 15 * 60 * 1000);
          updates.lockoutUntil = lockoutTime;
          lockoutMsg = " Account has been temporarily locked for 15 minutes.";
        }

        await userRepo.update(user.id, updates);

        // Record Audit Log for login failure
        await auditRepo.create({
          userId: user.id,
          action: "USER_LOGIN_FAILED",
          tableName: "users",
          recordId: user.id,
          device: device || "Web Application",
          beforeValue: null,
          afterValue: JSON.stringify({ attempts, locked: attempts >= 5 }),
          timestamp: new Date()
        });

        this.logger.warn(`Auth failed: Incorrect password for ${email}. Failed attempts: ${attempts}`);
        throw new UnauthorizedException(`Invalid email or password.${lockoutMsg}`);
      }

      // Successful Auth
      await userRepo.update(user.id, {
        failedLoginAttempts: 0,
        lockoutUntil: null
      });

      const fullUser = await userRepo.getUserWithRoleAndPermissions(user.id);
      const tokenPayload: TokenPayload = {
        userId: fullUser.id,
        email: fullUser.email,
        fullName: fullUser.fullName,
        roleId: fullUser.roleId,
        roleName: fullUser.role?.name || "unassigned",
        companyId: fullUser.companyId,
        storeId: fullUser.storeId,
        permissions: fullUser.permissions || []
      };

      const tokens = this.generateTokens(tokenPayload);

      // Record Audit Log for success
      await auditRepo.create({
        userId: user.id,
        action: "USER_LOGIN_SUCCESS",
        tableName: "users",
        recordId: user.id,
        device: device || "Web Application",
        beforeValue: null,
        afterValue: JSON.stringify({ email, role: fullUser.role?.name }),
        timestamp: new Date()
      });

      this.logger.info(`Auth success: User login successful: ${email}`);

      return {
        ...tokens,
        user: {
          id: fullUser.id,
          email: fullUser.email,
          fullName: fullUser.fullName,
          role: fullUser.role?.name,
          permissions: fullUser.permissions,
          companyId: fullUser.companyId,
          storeId: fullUser.storeId
        }
      };
    });
  }

  /**
   * Refreshes JWT tokens pair using standard JWT validation rules
   */
  public async refreshTokens(refreshToken: string, device?: string): Promise<AuthTokens & { user: any }> {
    this.logger.info("Attempting to rotate refresh token");
    try {
      const decoded = jwt.verify(refreshToken, this.jwtRefreshSecret) as any;
      const userId = decoded.userId;

      if (!userId) {
        throw new UnauthorizedException("Malformed refresh token payload");
      }

      return this.uow.runInTransaction(async (txUow, tx) => {
        const userRepo = txUow.getRepository<any>("users", tx) as unknown as IUserRepository;
        const auditRepo = txUow.getRepository<any>("auditLogs", tx);

        const fullUser = await userRepo.getUserWithRoleAndPermissions(userId);
        if (!fullUser || !fullUser.isActive) {
          throw new UnauthorizedException("User is no longer active or exists");
        }

        const tokenPayload: TokenPayload = {
          userId: fullUser.id,
          email: fullUser.email,
          fullName: fullUser.fullName,
          roleId: fullUser.roleId,
          roleName: fullUser.role?.name || "unassigned",
          companyId: fullUser.companyId,
          storeId: fullUser.storeId,
          permissions: fullUser.permissions || []
        };

        const tokens = this.generateTokens(tokenPayload);

        // Optional Audit Logging for Token Rotation
        await auditRepo.create({
          userId: fullUser.id,
          action: "TOKEN_REFRESH",
          tableName: "users",
          recordId: fullUser.id,
          device: device || "Web Application",
          beforeValue: null,
          afterValue: null,
          timestamp: new Date()
        });

        return {
          ...tokens,
          user: {
            id: fullUser.id,
            email: fullUser.email,
            fullName: fullUser.fullName,
            role: fullUser.role?.name,
            permissions: fullUser.permissions,
            companyId: fullUser.companyId,
            storeId: fullUser.storeId
          }
        };
      });
    } catch (err: any) {
      this.logger.error("Refresh token verification failed", err);
      throw new UnauthorizedException("Invalid or expired refresh token. Please log in again.");
    }
  }

  /**
   * Logs out user activity with database auditing records
   */
  public async logout(userId: number, device?: string): Promise<void> {
    this.logger.info(`User logout request for user ID: ${userId}`);
    await this.uow.runInTransaction(async (txUow, tx) => {
      const auditRepo = txUow.getRepository<any>("auditLogs", tx);
      await auditRepo.create({
        userId,
        action: "USER_LOGOUT",
        tableName: "users",
        recordId: userId,
        device: device || "Web Application",
        beforeValue: null,
        afterValue: null,
        timestamp: new Date()
      });
    });
  }

  /**
   * Requests a secure request token for forgotten passwords
   */
  public async requestPasswordReset(email: string, device?: string): Promise<string> {
    this.logger.info(`Password reset request initiated for email: ${email}`);

    return this.uow.runInTransaction(async (txUow, tx) => {
      const userRepo = txUow.getRepository<any>("users", tx) as unknown as IUserRepository;
      const auditRepo = txUow.getRepository<any>("auditLogs", tx);

      const user = await userRepo.findByEmail(email);
      if (!user) {
        // To prevent user enumeration attacks via timing/message profiles,
        // we log but return a fake successful/done string without crashing!
        this.logger.warn(`Password reset request warning: Email not registered: ${email}`);
        return "mock-reset-token-for-unknown-user-to-prevent-enumeration";
      }

      // Generate a secure reset token
      const resetToken = crypto.randomBytes(32).toString("hex");
      // Set to 1 hour from now
      const resetExpires = new Date(Date.now() + 60 * 60 * 1000);

      await userRepo.update(user.id, {
        passwordResetToken: resetToken,
        passwordResetExpires: resetExpires
      });

      await auditRepo.create({
        userId: user.id,
        action: "PASSWORD_RESET_REQUESTED",
        tableName: "users",
        recordId: user.id,
        device: device || "Web Application",
        beforeValue: null,
        afterValue: null,
        timestamp: new Date()
      });

      return resetToken;
    });
  }

  /**
   * Performs the actual secure password reset rewrite using valid tokens
   */
  public async resetPassword(token: string, passwordNew: string, device?: string): Promise<void> {
    this.logger.info("Verifying reset password token action");

    await this.uow.runInTransaction(async (txUow, tx) => {
      const userRepo = txUow.getRepository<any>("users", tx) as unknown as IUserRepository;
      const auditRepo = txUow.getRepository<any>("auditLogs", tx);

      const user = await userRepo.findByResetToken(token);
      if (!user) {
        throw new ValidationError("Invalid or expired password reset token.");
      }

      if (!user.passwordResetExpires || new Date(user.passwordResetExpires) < new Date()) {
        throw new ValidationError("Password reset token has expired.");
      }

      // Hash the new password
      const passwordHash = this.hashPassword(passwordNew);

      // Clean up reset configurations and zero-out failed attempts on reset
      await userRepo.update(user.id, {
        passwordHash,
        passwordResetToken: null,
        passwordResetExpires: null,
        failedLoginAttempts: 0,
        lockoutUntil: null
      });

      await auditRepo.create({
        userId: user.id,
        action: "PASSWORD_RESET_SUCCESS",
        tableName: "users",
        recordId: user.id,
        device: device || "Web Application",
        beforeValue: null,
        afterValue: null,
        timestamp: new Date()
      });

      this.logger.info(`Password successfully reset for user ID: ${user.id}`);
    });
  }

  /**
   * Helper utility to sign the access and refresh token pair
   */
  private generateTokens(payload: TokenPayload): AuthTokens {
    const accessToken = jwt.sign(
      {
        userId: payload.userId,
        email: payload.email,
        fullName: payload.fullName,
        roleId: payload.roleId,
        roleName: payload.roleName,
        companyId: payload.companyId,
        storeId: payload.storeId,
        permissions: payload.permissions
      },
      this.jwtSecret,
      { expiresIn: "15m" }
    );

    const refreshToken = jwt.sign(
      {
        userId: payload.userId
      },
      this.jwtRefreshSecret,
      { expiresIn: "7d" }
    );

    return {
      accessToken,
      refreshToken,
      expiresIn: 15 * 60 // 15 mins in seconds
    };
  }

  /**
   * Validates access token and resolves payload claims
   */
  public verifyAccessToken(token: string): TokenPayload {
    try {
      return jwt.verify(token, this.jwtSecret) as TokenPayload;
    } catch (err: any) {
      throw new UnauthorizedException("Session is invalid or expired. Please reauthenticate.");
    }
  }
}
