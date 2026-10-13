import { type INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

export const SWAGGER_PATH = 'docs';

export function setupSwagger(app: INestApplication): void {
  const config = new DocumentBuilder()
    .setTitle('Merchant Onboarding API')
    .setDescription(
      'Merchant application lifecycle with asynchronous risk review. ' +
        'All endpoints are served under /api/v1. Authenticate via POST /api/v1/auth/login ' +
        'and use the token with the Authorize button.',
    )
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  SwaggerModule.setup(SWAGGER_PATH, app, SwaggerModule.createDocument(app, config));
}
