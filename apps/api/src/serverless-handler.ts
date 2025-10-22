import { Handler, Callback, Context } from "aws-lambda";
import serverlessExpress from "@vendia/serverless-express";
import { createApplication } from "./bootstrap";

let cachedHandler: Handler | null = null;

export const handler: Handler = async (event: any, context: Context, callback: Callback) => {
  if (!cachedHandler) {
    const app = await createApplication();
    await app.init();
    const expressApp = app.getHttpAdapter().getInstance();
    cachedHandler = serverlessExpress({ app: expressApp });
  }

  return (cachedHandler as Handler)(event, context, callback);
};
