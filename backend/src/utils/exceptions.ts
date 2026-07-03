import type {
  ApiException,
  ExceptionMessageType,
  HttpStatusCode,
} from "#/exceptions";
import type { APIErrors } from "#/error";

class Exception implements ApiException {
  constructor(
    readonly message: ExceptionMessageType,
    readonly status: HttpStatusCode,
    readonly codeError: APIErrors
  ) {}
}

class MultiStatusException extends Exception {
  constructor(message: ExceptionMessageType, codeError: APIErrors) {
    super(message, 207, codeError);
  }
}

class NotFoundException extends Exception {
  constructor(message: ExceptionMessageType, codeError: APIErrors) {
    super(message, 404, codeError);
  }
}

class BadRequestException extends Exception {
  constructor(message: ExceptionMessageType, codeError: APIErrors) {
    super(message, 400, codeError);
  }
}

class UnauthorizedException extends Exception {
  constructor(message: ExceptionMessageType, codeError: APIErrors) {
    super(message, 401, codeError);
  }
}

class ForbiddenException extends Exception {
  constructor(message: ExceptionMessageType, codeError: APIErrors) {
    super(message, 403, codeError);
  }
}

class ConflictRequestException extends Exception {
  constructor(message: ExceptionMessageType, codeError: APIErrors) {
    super(message, 409, codeError);
  }
}

class ServerErrorException extends Exception {
  constructor(message: ExceptionMessageType, codeError: APIErrors) {
    super(message, 500, codeError);
  }
}

export {
  MultiStatusException,
  NotFoundException,
  BadRequestException,
  UnauthorizedException,
  ForbiddenException,
  ConflictRequestException,
  ServerErrorException,
  Exception,
};
