// src/backend/api/controllers/user.controller.ts

import { Request, Response, NextFunction } from "express";
import { UserService } from "../../application/services/user.service.ts";
import { ApiResponse } from "../../application/dtos/dtos.ts";

export class UserController {
  constructor(private readonly userService: UserService) {}

  /**
   * Fetch all registered users
   */
  public getAllUsers = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const filters: Record<string, any> = {};
      if (req.query.roleId) filters.roleId = Number(req.query.roleId);
      if (req.query.companyId) filters.companyId = Number(req.query.companyId);
      if (req.query.storeId) filters.storeId = Number(req.query.storeId);
      if (req.query.isActive !== undefined) filters.isActive = req.query.isActive === "true";

      const users = await this.userService.listUsers(filters);
      const response: ApiResponse = {
        success: true,
        message: "Users retrieved successfully.",
        data: users,
        timestamp: new Date().toISOString()
      };
      res.status(200).json(response);
    } catch (err) {
      next(err);
    }
  };

  /**
   * Fetch details of a single user profile with loaded role/permissions
   */
  public getUserById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = Number(req.params.id);
      const user = await this.userService.getUserDetail(id);

      const response: ApiResponse = {
        success: true,
        message: "User detailed records retrieved.",
        data: user,
        timestamp: new Date().toISOString()
      };
      res.status(200).json(response);
    } catch (err) {
      next(err);
    }
  };

  /**
   * Create a new user with standard password structures
   */
  public createUser = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const newUser = await this.userService.createNewUser(req.body);

      const response: ApiResponse = {
        success: true,
        message: "User created successfully.",
        data: newUser,
        timestamp: new Date().toISOString()
      };
      res.status(201).json(response);
    } catch (err) {
      next(err);
    }
  };

  /**
   * Update selective user details (automatically handles password hashes)
   */
  public updateUser = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = Number(req.params.id);
      const updatedUser = await this.userService.updateUserDetails(id, req.body);

      const response: ApiResponse = {
        success: true,
        message: "User profile updated successfully.",
        data: updatedUser,
        timestamp: new Date().toISOString()
      };
      res.status(200).json(response);
    } catch (err) {
      next(err);
    }
  };

  /**
   * Safely deprecates or deletes user records
   */
  public deleteUser = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = Number(req.params.id);
      await this.userService.deleteUser(id);

      const response: ApiResponse = {
        success: true,
        message: "User deleted successfully.",
        timestamp: new Date().toISOString()
      };
      res.status(200).json(response);
    } catch (err) {
      next(err);
    }
  };
}
