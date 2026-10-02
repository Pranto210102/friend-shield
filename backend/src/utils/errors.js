export class AppError extends Error {
  constructor(message, statusCode = 500, code = "INTERNAL_ERROR") {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.code = code;
  }
}

export class ValidationError extends AppError {
  constructor(message = "Invalid input.") {
    super(message, 400, "VALIDATION_ERROR");
  }
}

export class SsrfBlockedError extends AppError {
  constructor(message = "Access to private or restricted network addresses is forbidden.") {
    super(message, 403, "SSRF_BLOCKED");
  }
}

export class RedirectLoopError extends AppError {
  constructor(message = "Redirect loop detected.") {
    super(message, 422, "REDIRECT_LOOP");
  }
}

export class TooManyRedirectsError extends AppError {
  constructor(maxRedirects = 5) {
    super(`Too many redirects. Maximum allowed: ${maxRedirects}.`, 422, "TOO_MANY_REDIRECTS");
  }
}

export class UnreachableHostError extends AppError {
  constructor(message = "The remote host is unreachable or failed to respond.") {
    super(message, 502, "HOST_UNREACHABLE");
  }
}

export class RequestTimeoutError extends AppError {
  constructor(message = "The request timed out while resolving destination.") {
    super(message, 504, "REQUEST_TIMEOUT");
  }
}
