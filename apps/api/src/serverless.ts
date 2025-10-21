import { Logger } from "@nestjs/common";
import { createApplication } from "./bootstrap";

let cachedServer: any;

export default async function handler(req: any, res: any) {
  if (!cachedServer) {
    const app = await createApplication();
    await app.init();
    cachedServer = app.getHttpAdapter().getInstance();
    Logger.log("NestJS application bootstrapped in Vercel serverless handler", "VercelHandler");
  }

  return cachedServer(req, res);
}
