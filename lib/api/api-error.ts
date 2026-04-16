/**
 * Standardized frontend error
 */
export class AppError extends Error {
  statusCode: number;
  errorCode: string;
  details?: unknown;

  constructor(params: {
    message: string;
    statusCode: number;
    errorCode: string;
    details?: unknown;
  }) {
    super(params.message);
    this.statusCode = params.statusCode;
    this.errorCode = params.errorCode;
    this.details = params.details;
  }
}
