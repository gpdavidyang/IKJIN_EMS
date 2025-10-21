import { Logger, ValidationPipe } from "@nestjs/common";
import { NestApplication, NestFactory } from "@nestjs/core";
import { ExpressAdapter } from "@nestjs/platform-express";
import express from "express";
import { AppModule } from "./app.module";
import { PrismaService } from "./prisma/prisma.service";

const loggerContext = "Bootstrap";

function resolveCorsOrigins(): { origin: true } | { origin: string[]; credentials: boolean } {
  const raw = process.env.API_CORS_ALLOWED_ORIGINS;
  const defaultOrigins = ["http://localhost:3000"];
  if (!raw) {
    return { origin: defaultOrigins, credentials: true };
  }

  const origins = raw
    .split(",")
    .map((value) => value.trim())
    .filter((value) => value.length > 0);

  if (origins.length === 0) {
    return { origin: defaultOrigins, credentials: true };
  }

  if (origins.includes("*")) {
    return { origin: true };
  }

  return { origin: origins, credentials: true };
}

export async function createApplication(): Promise<NestApplication> {
  const server = express();
  const app = await NestFactory.create<NestApplication>(AppModule, new ExpressAdapter(server));

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true
    })
  );

  app.enableCors({
    ...resolveCorsOrigins(),
    methods: ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "Accept", "X-Requested-With"]
  });

  const prisma = app.get(PrismaService);
  await prisma.enableShutdownHooks(app);

  return app;
}

export async function startStandaloneServer() {
  const app = await createApplication();
  const port = process.env.API_PORT ?? 4000;
  await app.listen(port);
  Logger.log(`IKJIN EMS API listening on port ${port}`, loggerContext);
}
