import {
  Catch,
  HttpException,
  Logger,
  type ArgumentsHost,
  type ExceptionFilter,
} from '@nestjs/common';
import type { Response } from 'express';

// Connectivity, pool exhaustion and PostgreSQL shutdown errors only.
// Constraints, invalid queries and programming errors must not become 503.
const infrastructureCodes = new Set([
  'P1000',
  'P1001',
  'P1002',
  'P1003',
  'P1008',
  'P1010',
  'P1011',
  'P1017',
  'P2024',
  'P2037',
  'ECONNREFUSED',
  'ECONNRESET',
  'ETIMEDOUT',
  'ENOTFOUND',
  'EHOSTUNREACH',
  'ENETUNREACH',
  'EPIPE',
  '08000',
  '08001',
  '08003',
  '08004',
  '08006',
  '08007',
  '08P01',
  '53300',
  '57P01',
  '57P02',
  '57P03',
]);

// These pg/pg-pool errors have no code in the installed versions.
const pgConnectionMessages = new Map([
  ['timeout exceeded when trying to connect', 'PG_POOL_TIMEOUT'],
  ['Connection terminated due to connection timeout', 'PG_CONNECTION_TIMEOUT'],
  ['Connection terminated unexpectedly', 'PG_CONNECTION_CLOSED'],
]);

function infrastructureCode(error: unknown): string | undefined {
  if (!(error instanceof Error)) return undefined;
  const code =
    'code' in error
      ? error.code
      : 'errorCode' in error
        ? error.errorCode
        : undefined;
  if (typeof code === 'string' && infrastructureCodes.has(code)) return code;
  return pgConnectionMessages.get(error.message);
}

@Catch()
export class ApiErrorFilter implements ExceptionFilter {
  private readonly logger = new Logger(ApiErrorFilter.name);

  catch(error: unknown, host: ArgumentsHost) {
    const infraCode = infrastructureCode(error);
    const status =
      error instanceof HttpException
        ? error.getStatus()
        : infraCode
          ? 503
          : 500;
    const codes: Record<number, string> = {
      400: 'INVALID_INPUT',
      401: 'UNAUTHORIZED',
      403: 'FORBIDDEN',
      404: 'NOT_FOUND',
      429: 'TOO_MANY_REQUESTS',
      500: 'INTERNAL_ERROR',
      503: 'SERVICE_UNAVAILABLE',
    };
    const messages: Record<number, string> = {
      400: 'Datos de entrada inválidos.',
      401: 'Credenciales inválidas o sesión no válida.',
      403: 'Solicitud no permitida.',
      404: 'Recurso no encontrado.',
      429: 'Demasiados intentos. Reintentá más tarde.',
      500: 'Error interno del servidor.',
      503: 'Servicio temporalmente no disponible.',
    };
    if (status >= 500) {
      // Whitelisted codes/types only: raw messages, metadata and stacks can contain secrets/SQL.
      const kind =
        error instanceof TypeError
          ? 'TypeError'
          : error instanceof ReferenceError
            ? 'ReferenceError'
            : 'Error';
      this.logger.error(
        infraCode
          ? `infraestructura_no_disponible (${infraCode})`
          : `error_http_${status} (${kind})`,
      );
    }
    host
      .switchToHttp()
      .getResponse<Response>()
      .status(status)
      .json({
        code: codes[status] ?? 'HTTP_ERROR',
        message: messages[status] ?? 'No se pudo completar la solicitud.',
      });
  }
}
