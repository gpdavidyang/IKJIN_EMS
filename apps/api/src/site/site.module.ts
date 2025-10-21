import { Module } from "@nestjs/common";
import { PrismaModule } from "../prisma/prisma.module";
import { SiteController } from "./site.controller";
import { SiteService } from "./site.service";

@Module({
  imports: [PrismaModule],
  controllers: [SiteController],
  providers: [SiteService],
  exports: [SiteService]
})
export class SiteModule {}
