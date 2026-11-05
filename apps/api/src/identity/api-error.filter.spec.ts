import { HttpException, Logger, type ArgumentsHost } from '@nestjs/common';
import { ApiErrorFilter } from './api-error.filter.js';

describe('API error classification', () => {
  const sensitive = 'SELECT password_hash; postgresql://user:private@host/db';
  let diagnostic: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    diagnostic = vi
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => {});
  });

  afterEach(() => vi.restoreAllMocks());

  function respond(error: unknown) {
    const response = { status: vi.fn(), json: vi.fn() };
    response.status.mockReturnValue(response);
    const host = {
      switchToHttp: () => ({ getResponse: () => response }),
    } as ArgumentsHost;
    new ApiErrorFilter().catch(error, host);
    return response;
  }

  it.each([
    [400, 'INVALID_INPUT'],
    [401, 'UNAUTHORIZED'],
    [403, 'FORBIDDEN'],
    [404, 'NOT_FOUND'],
    [429, 'TOO_MANY_REQUESTS'],
  ])(
    'preserves HTTP %i without exposing exception contents',
    (status, code) => {
      const response = respond(new HttpException(sensitive, status as number));
      expect(response.status).toHaveBeenCalledWith(status);
      expect(response.json).toHaveBeenCalledWith({
        code,
        message: expect.any(String),
      });
      expect(JSON.stringify(response.json.mock.calls)).not.toContain(sensitive);
      expect(diagnostic).not.toHaveBeenCalled();
    },
  );

  it.each([
    Object.assign(new Error(sensitive), { code: 'ECONNREFUSED' }),
    Object.assign(new Error(sensitive), { code: 'P2024' }),
    new Error('timeout exceeded when trying to connect'),
  ])('returns 503 for a recognized infrastructure failure', (error) => {
    const response = respond(error);
    expect(response.status).toHaveBeenCalledWith(503);
    expect(response.json).toHaveBeenCalledWith({
      code: 'SERVICE_UNAVAILABLE',
      message: 'Servicio temporalmente no disponible.',
    });
    expect(diagnostic).toHaveBeenCalledWith(
      expect.stringContaining('infraestructura_no_disponible'),
    );
    expect(JSON.stringify(diagnostic.mock.calls)).not.toContain(sensitive);
  });

  it.each([
    new TypeError(sensitive),
    Object.assign(new Error(sensitive), { code: 'P2002' }),
  ])(
    'returns 500 for an unexpected error and logs only a safe diagnostic',
    (error) => {
      const response = respond(error);
      expect(response.status).toHaveBeenCalledWith(500);
      expect(response.json).toHaveBeenCalledWith({
        code: 'INTERNAL_ERROR',
        message: 'Error interno del servidor.',
      });
      expect(diagnostic).toHaveBeenCalledWith(
        expect.stringContaining('error_http_500'),
      );
      expect(
        JSON.stringify([response.json.mock.calls, diagnostic.mock.calls]),
      ).not.toContain(sensitive);
    },
  );
});
