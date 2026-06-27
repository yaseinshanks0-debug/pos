// src/backend/domain/exceptions.ts

export abstract class BaseException extends Error {
  public abstract readonly statusCode: number;

  constructor(message: string) {
    super(message);
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class NotFoundException extends BaseException {
  public readonly statusCode = 404;
  constructor(entity: string, id: string | number) {
    super(`${entity} with identifier "${id}" was not found.`);
  }
}

export class ValidationError extends BaseException {
  public readonly statusCode = 400;
  public readonly errors: Record<string, string[]>;

  constructor(errors: Record<string, string[]> | string) {
    super(typeof errors === "string" ? errors : "Validation failed.");
    if (typeof errors === "string") {
      this.errors = { general: [errors] };
    } else {
      this.errors = errors;
    }
  }
}

export class BusinessRuleException extends BaseException {
  public readonly statusCode = 422;
  constructor(ruleName: string, message: string) {
    super(`Business Rule Violation [${ruleName}]: ${message}`);
  }
}

export class UnauthorizedException extends BaseException {
  public readonly statusCode = 401;
  constructor(message = "Unauthorized access.") {
    super(message);
  }
}

export class ForbiddenException extends BaseException {
  public readonly statusCode = 403;
  constructor(message = "Forbidden access. You do not have the required permissions.") {
    super(message);
  }
}

export class ConflictException extends BaseException {
  public readonly statusCode = 409;
  constructor(message: string) {
    super(message);
  }
}
