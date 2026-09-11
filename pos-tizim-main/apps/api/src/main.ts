import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { securityHeaders } from './common/middleware/security-headers.middleware';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.setGlobalPrefix('api');
  app.useGlobalFilters(new HttpExceptionFilter());
  app.use(securityHeaders());

  const allowedOrigins = [
    process.env.WEB_URL,
    ...(process.env.ALLOWED_ORIGINS?.split(',').map((o) => o.trim()).filter(Boolean) ?? []),
  ];
  app.enableCors({
    origin: (origin, callback) => {
      // No Origin header (server-to-server, curl, mobile clients) — allow
      if (!origin) return callback(null, true);
      // Dev: allow any origin so ngrok tunnels / LAN IPs keep working
      if (process.env.NODE_ENV !== 'production') return callback(null, true);
      if (allowedOrigins.includes(origin)) return callback(null, true);
      callback(new Error(`CORS: ${origin} ruxsat etilmagan`), false);
    },
    credentials: true,
  });

  const config = new DocumentBuilder()
    .setTitle('Marva POS API')
    .setDescription('Magazin uchun Marva POS tizimi')
    .setVersion('1.0')
    .addBearerAuth(
      { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      'access-token',
    )
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, document);

  const port = process.env.PORT || 3001;
  await app.listen(port);
  console.log(`🚀 API ishga tushdi: http://localhost:${port}/api`);
  console.log(`📚 Swagger:          http://localhost:${port}/docs`);
}

bootstrap();
