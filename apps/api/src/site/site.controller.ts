import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { Roles } from "../auth/roles.decorator";
import { RolesGuard } from "../auth/roles.guard";
import { SiteService } from "./site.service";
import { CreateSiteDto } from "./dto/create-site.dto";
import { UpdateSiteDto } from "./dto/update-site.dto";

@Controller("sites")
@UseGuards(JwtAuthGuard, RolesGuard)
export class SiteController {
  constructor(private readonly siteService: SiteService) {}

  @Get()
  @Roles("hq_admin")
  list() {
    return this.siteService.findAll();
  }

  @Get(":id")
  @Roles("hq_admin")
  detail(@Param("id") id: string) {
    return this.siteService.findOne(id);
  }

  @Post()
  @Roles("hq_admin")
  create(@Body() dto: CreateSiteDto) {
    return this.siteService.create(dto);
  }

  @Patch(":id")
  @Roles("hq_admin")
  update(@Param("id") id: string, @Body() dto: UpdateSiteDto) {
    return this.siteService.update(id, dto);
  }

  @Delete(":id")
  @Roles("hq_admin")
  remove(@Param("id") id: string) {
    return this.siteService.remove(id);
  }
}
