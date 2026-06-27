// src/backend/api/controllers/auth.controller.ts

import { Request, Response, NextFunction } from "express";
import { AuthService } from "../../application/services/auth.service.ts";
import { AuthenticatedRequest } from "../middlewares/auth.middleware.ts";
import { ApiResponse } from "../../application/dtos/dtos.ts";
import { ValidationError } from "../../domain/exceptions.ts";

export class AuthController {
  constructor(private readonly authService: AuthService) {}

  /**
   * Authenticate user, issue access + refresh tokens, log IP/browser device.
   */
  public login = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { email, password } = req.body;
      const device = req.headers["user-agent"] || "Web Browser";

      if (!email || !password) {
        throw new ValidationError("Both 'email' and 'password' are required fields.");
      }

      const data = await this.authService.login(email.trim(), password, device);

      // We set a httpOnly secure cookie for refresh tokens as a production best-practice
      res.cookie("refresh_token", data.refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
      });

      const response: ApiResponse = {
        success: true,
        message: "Login successful.",
        data: {
          accessToken: data.accessToken,
          refreshToken: data.refreshToken,
          expiresIn: data.expiresIn,
          user: data.user
        },
        timestamp: new Date().toISOString(),
      };
      res.status(200).json(response);
    } catch (err) {
      next(err);
    }
  };

  /**
   * Rotates and issues fresh access and refresh token pairs.
   */
  public refresh = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      // Look up in request body, custom header, or cookie
      const refreshToken = 
        req.body.refreshToken || 
        req.headers["x-refresh-token"] || 
        req.cookies?.refresh_token;

      const device = req.headers["user-agent"] || "Web Browser";

      if (!refreshToken) {
        throw new ValidationError("Refresh token is required via 'refreshToken' body, cookie or 'x-refresh-token' header.");
      }

      const data = await this.authService.refreshTokens(refreshToken, device);

      // Re-set cookie
      res.cookie("refresh_token", data.refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        maxAge: 7 * 24 * 60 * 60 * 1000
      });

      const response: ApiResponse = {
        success: true,
        message: "Session token rotated successfully.",
        data: {
          accessToken: data.accessToken,
          refreshToken: data.refreshToken,
          expiresIn: data.expiresIn,
          user: data.user
        },
        timestamp: new Date().toISOString(),
      };
      res.status(200).json(response);
    } catch (err) {
      next(err);
    }
  };

  /**
   * User logout, audit record registries logging, and session cookie removals.
   */
  public logout = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const authReq = req as AuthenticatedRequest;
      const device = req.headers["user-agent"] || "Web Browser";

      if (!authReq.user) {
        throw new ValidationError("Cannot log out: No active authenticated session.");
      }

      await this.authService.logout(authReq.user.userId, device);

      res.clearCookie("refresh_token");

      const response: ApiResponse = {
        success: true,
        message: "Log out successful. Session invalidated.",
        timestamp: new Date().toISOString(),
      };
      res.status(200).json(response);
    } catch (err) {
      next(err);
    }
  };

  /**
   * Submits email for password reset processing, yielding a secure token.
   */
  public requestPasswordReset = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { email } = req.body;
      const device = req.headers["user-agent"] || "Web Browser";

      if (!email) {
        throw new ValidationError("'email' is a required field.");
      }

      const resetToken = await this.authService.requestPasswordReset(email.trim(), device);

      const response: ApiResponse = {
        success: true,
        message: "If the email is registered, a password reset token has been generated successfully.",
        data: {
          // Returning token to allow seamless frontend or client integration and offline QA debugging
          resetToken
        },
        timestamp: new Date().toISOString(),
      };
      res.status(200).json(response);
    } catch (err) {
      next(err);
    }
  };

  /**
   * Completes the password reset rewrite using valid tokens.
   */
  public resetPassword = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { token, newPassword } = req.body;
      const device = req.headers["user-agent"] || "Web Browser";

      if (!token || !newPassword) {
        throw new ValidationError("'token' and 'newPassword' are required fields.");
      }

      if (newPassword.length < 8) {
        throw new ValidationError("Password must be at least 8 characters long.");
      }

      await this.authService.resetPassword(token, newPassword, device);

      const response: ApiResponse = {
        success: true,
        message: "Password has been successfully reset. You may now log in with your new password.",
        timestamp: new Date().toISOString(),
      };
      res.status(200).json(response);
    } catch (err) {
      next(err);
    }
  };
}
