import { ExecutionContext, Injectable } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";

@Injectable()
export class JwtAuthGuard extends AuthGuard("jwt") {
  override handleRequest(err: unknown, user: any, info: unknown, context: ExecutionContext) {
    if (err || !user) {
      throw err || info;
    }
    return user;
  }
}
