// src/backend/application/services/user.service.ts

import crypto from "crypto";
import { IUnitOfWork } from "../ports/unit-of-work.interface.ts";
import { ILogger } from "../ports/logger.interface.ts";
import { IUserRepository } from "../../domain/repository.interface.ts";
import { 
  ConflictException, 
  NotFoundException, 
  ValidationError 
} from "../../domain/exceptions.ts";

export class UserService {
  constructor(
    private readonly uow: IUnitOfWork,
    private readonly logger: ILogger
  ) {}

  /**
   * Helper utility to secure hash password
   */
  private generateHash(password: string): string {
    const salt = crypto.randomBytes(16).toString("hex");
    const hash = crypto.pbkdf2Sync(password, salt, 10000, 64, "sha512").toString("hex");
    return `${salt}:${hash}`;
  }

  /**
   * Lists all users, stripping away credentials for safe system transport
   */
  public async listUsers(filters?: Record<string, any>): Promise<any[]> {
    this.logger.info("Fetching list of all system users");
    const userRepo = this.uow.getRepository<any>("users");
    const users = await userRepo.findAll(filters);
    
    // Safely strip sensitive fields from arrays
    return users.map(u => {
      const { passwordHash, passwordResetToken, passwordResetExpires, ...safeUser } = u;
      return safeUser;
    });
  }

  /**
   * Fetch a single user detail with resolved role and permission claims
   */
  public async getUserDetail(id: number): Promise<any> {
    this.logger.info(`Fetching detailed record for user ID: ${id}`);
    const userRepo = this.uow.getRepository<any>("users") as unknown as IUserRepository;
    
    const userDetail = await userRepo.getUserWithRoleAndPermissions(id);
    if (!userDetail) {
      throw new NotFoundException("users", id);
    }

    const { passwordHash, passwordResetToken, passwordResetExpires, ...safeUser } = userDetail;
    return safeUser;
  }

  /**
   * Creates a new user with secure password hashes & mandatory validation checks
   */
  public async createNewUser(data: Record<string, any>): Promise<any> {
    this.logger.info(`Initiating user creation processor for email: ${data.email}`);

    if (!data.email || !data.fullName || !data.roleId || !data.companyId) {
      throw new ValidationError("Required fields are missing. Make sure email, fullName, roleId, and companyId are provided.");
    }

    return this.uow.runInTransaction(async (txUow, tx) => {
      const userRepo = txUow.getRepository<any>("users", tx) as unknown as IUserRepository;

      // Duplicate email conflict checks
      const existing = await userRepo.findByEmail(data.email);
      if (existing) {
        throw new ConflictException(`User with email "${data.email}" already exists with standard logins.`);
      }

      const uid = data.uid || `local_${crypto.randomUUID()}`;
      let passwordHashStr: string | null = null;

      if (data.password) {
        if (data.password.length < 8) {
          throw new ValidationError("Password must be at least 8 characters long.");
        }
        passwordHashStr = this.generateHash(data.password);
      }

      const newUserPayload = {
        uid,
        email: data.email.toLowerCase().trim(),
        fullName: data.fullName,
        roleId: Number(data.roleId),
        companyId: Number(data.companyId),
        storeId: data.storeId ? Number(data.storeId) : null,
        isActive: data.isActive !== undefined ? Boolean(data.isActive) : true,
        passwordHash: passwordHashStr,
        failedLoginAttempts: 0,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const createdUser = await userRepo.create(newUserPayload);
      const { passwordHash, passwordResetToken, passwordResetExpires, ...safeUser } = createdUser;
      return safeUser;
    });
  }

  /**
   * Performs user updates, automatically re-hashing changes to passcodes
   */
  public async updateUserDetails(id: number, data: Record<string, any>): Promise<any> {
    this.logger.info(`Updating user record ID: ${id}`);

    return this.uow.runInTransaction(async (txUow, tx) => {
      const userRepo = txUow.getRepository<any>("users", tx) as unknown as IUserRepository;

      // Confirm user exists first
      const existing = await userRepo.findById(id);
      if (!existing) {
        throw new NotFoundException("users", id);
      }

      const updatePayload: Record<string, any> = {
        updatedAt: new Date()
      };

      if (data.fullName !== undefined) updatePayload.fullName = data.fullName;
      if (data.roleId !== undefined) updatePayload.roleId = Number(data.roleId);
      if (data.companyId !== undefined) updatePayload.companyId = Number(data.companyId);
      if (data.storeId !== undefined) updatePayload.storeId = data.storeId ? Number(data.storeId) : null;
      if (data.isActive !== undefined) updatePayload.isActive = Boolean(data.isActive);
      
      if (data.email !== undefined) {
        const checkEmail = data.email.toLowerCase().trim();
        if (checkEmail !== existing.email) {
          const duplicate = await userRepo.findByEmail(checkEmail);
          if (duplicate) {
            throw new ConflictException(`Email address "${checkEmail}" is already taken by another profile.`);
          }
          updatePayload.email = checkEmail;
        }
      }

      if (data.password) {
        if (data.password.length < 8) {
          throw new ValidationError("Password update matches fail: Minimum 8 characters required.");
        }
        updatePayload.passwordHash = this.generateHash(data.password);
      }

      const updated = await userRepo.update(id, updatePayload);
      const { passwordHash, passwordResetToken, passwordResetExpires, ...safeUser } = updated;
      return safeUser;
    });
  }

  /**
   * Deletes a user profile safely from system registry
   */
  public async deleteUser(id: number): Promise<boolean> {
    this.logger.warn(`Removing user profile ID: ${id}`);
    const userRepo = this.uow.getRepository<any>("users");
    
    // Check exists
    const existing = await userRepo.findById(id);
    if (!existing) {
      throw new NotFoundException("users", id);
    }

    return userRepo.delete(id);
  }
}
