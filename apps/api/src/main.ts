import { Logger, ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { PrismaService } from "./prisma/prisma.service";

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { cors: true });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true
    })
  );

  const prisma = app.get(PrismaService);
  await prisma.enableShutdownHooks(app);

  const port = process.env.API_PORT ?? 4000;
  await app.listen(port);
  Logger.log(`IKJIN EMS API listening on port ${port}`, "Bootstrap");
}

void bootstrap();
