import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Security Headers
  app.use(helmet());

  // CORS Configuration
  app.enableCors({
    origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true,
  });

  // Enable global validation using class-validator
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    transform: true,
    forbidNonWhitelisted: true, // Fail on unexpected fields
  }));

  // Configure Swagger for API Documentation
  const config = new DocumentBuilder()
    .setTitle('POS Platform API')
    .setDescription('The API documentation for the multi-store cross-platform POS backend.')
    .setVersion('1.0')
    .addTag('Products')
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
