import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

@Injectable()
export class LoggerMiddleware implements NestMiddleware {
  private readonly logger = new Logger('HTTP');

  use(req: Request, res: Response, next: NextFunction) {
    const { method, originalUrl, headers } = req;
    this.logger.log(`Incoming Request: ${method} ${originalUrl} | Authorization: ${headers.authorization}`);
    
    res.on('finish', () => {
      const { statusCode } = res;
      this.logger.log(`Response Status: ${statusCode} for ${method} ${originalUrl}`);
    });
    next();
  }
}
