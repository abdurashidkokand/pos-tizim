import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
  BadRequestException,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { ZodError } from 'zod';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    // ZodError — validatsiya xatosi, 400 qaytarish kerak
    if (exception instanceof ZodError) {
      return response.status(HttpStatus.BAD_REQUEST).json({
        statusCode: HttpStatus.BAD_REQUEST,
        message: exception.errors[0]?.message ?? 'Validation xatosi',
        errors: exception.flatten(),
        path: request.url,
        timestamp: new Date().toISOString(),
      });
    }

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    let message: unknown;
    if (exception instanceof HttpException) {
      const res = exception.getResponse();
      message =
        typeof res === 'object' ? (res as any).message ?? res : res;
    } else {
      message = 'Ichki server xatosi';
    }

    const requestId = (request as any).requestId as string | undefined;

    if (status >= 500) {
      this.logger.error(
        `[${requestId ?? '-'}] ${request.method} ${request.url} → ${status}`,
        exception instanceof Error ? exception.stack : exception,
      );
    }

    response.status(status).json({
      statusCode: status,
      message,
      path: request.url,
      requestId,
      timestamp: new Date().toISOString(),
    });
  }
}
