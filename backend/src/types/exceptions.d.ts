export type HttpStatusCode = 207 | 400 | 401 | 403 | 404 | 409 | 500;

export type ExceptionMessageType = string | Record<string, string>;

export interface ApiException {
  message: ExceptionMessageType;
  status: HttpStatusCode;
}
