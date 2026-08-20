import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe, VersioningType } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';

import { json, urlencoded } from 'express';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.use(json({ limit: '300mb' }));
  app.use(urlencoded({ limit: '300mb', extended: true }));

  // Global prefix
  app.setGlobalPrefix('api');

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
      disableErrorMessages: false,
    }),
  );

  // CORS
  app.enableCors({
    origin: true,
    credentials: true,
  });

  // Swagger / OpenAPI
  const config = new DocumentBuilder()
    .setTitle('TheSSBuddy API')
    .setDescription('Maruti Suzuki B2B Dealer Incentive & Financial Operations Management Platform')
    .setVersion('1.0')
    .addBearerAuth()
    .addTag('auth', 'Authentication & token management')
    .addTag('users', 'User management')
    .addTag('branches', 'Branch master data')
    .addTag('parties', 'Party (dealer/customer) master data')
    .addTag('incentive-schemes', 'Incentive scheme definition')
    .addTag('incentive-records', 'Incentive calculation & records')
    .addTag('cash-management', 'Cash-in/cash-out & reconciliation')
    .addTag('bank-imports', 'Bank statement imports')
    .addTag('external-incentive-uploads', 'External incentive data uploads')
    .addTag('rule-engine', 'Generic rule definitions')
    .addTag('workflow', 'Approval workflow engine')
    .addTag('reports', 'Standard reports')
    .addTag('dynamic-reports', 'User-configurable report builder')
    .addTag('dashboard', 'Dashboard & analytics')
    .addTag('ledger', 'Party ledger & snapshots')
    .addTag('notifications', 'Notifications & messaging')
    .addTag('data-imports', 'Generic import framework')
    .addTag('control-tower', 'Cross-module operational views')
    .addTag('ai-query', 'AI-assisted data queries')
    .addTag('profile', 'User profile management')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document, {
    swaggerOptions: { persistAuthorization: true },
  });

  const port = process.env.PORT || 3000;
  await app.listen(port, '0.0.0.0');
  console.log(`TheSSBuddy running on http://0.0.0.0:${port}`);
  console.log(`Swagger docs at http://localhost:${port}/api/docs`);
}
bootstrap();