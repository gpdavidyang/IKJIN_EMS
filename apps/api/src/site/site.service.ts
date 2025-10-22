import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { CreateSiteDto } from "./dto/create-site.dto";
import { UpdateSiteDto } from "./dto/update-site.dto";

@Injectable()
export class SiteService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    return this.prisma.site.findMany({
      orderBy: { name: "asc" },
      include: {
        manager: {
          select: { id: true, fullName: true, email: true }
        }
      }
    });
  }

  async findOne(id: string) {
    const site = await this.prisma.site.findUnique({
      where: { id },
      include: {
        manager: {
          select: { id: true, fullName: true, email: true }
        }
      }
    });
    if (!site) {
      throw new NotFoundException("현장을 찾을 수 없습니다.");
    }
    return site;
  }

  async create(dto: CreateSiteDto) {
    const managerCandidate =
      typeof dto.managerId === "string" ? dto.managerId.trim() : undefined;
    const managerId = managerCandidate ? await this.ensureManager(managerCandidate) : null;

    return this.prisma.site.create({
      data: {
        code: dto.code.trim(),
        name: dto.name.trim(),
        region: dto.region?.trim() || null,
        address: dto.address?.trim() || null,
        managerId,
        isActive: dto.isActive ?? true
      },
      include: {
        manager: {
          select: { id: true, fullName: true, email: true }
        }
      }
    });
  }

  async update(id: string, dto: UpdateSiteDto) {
    await this.findOne(id);
    let resolvedManagerId: string | null | undefined;
    if (dto.managerId !== undefined) {
      const updateCandidate =
        typeof dto.managerId === "string" ? dto.managerId.trim() : undefined;
      resolvedManagerId = updateCandidate ? await this.ensureManager(updateCandidate) : null;
    }

    return this.prisma.site.update({
      where: { id },
      data: {
        ...(dto.code !== undefined ? { code: dto.code.trim() } : {}),
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.region !== undefined ? { region: dto.region?.trim() || null } : {}),
        ...(dto.address !== undefined ? { address: dto.address?.trim() || null } : {}),
        ...(resolvedManagerId !== undefined ? { managerId: resolvedManagerId } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {})
      },
      include: {
        manager: {
          select: { id: true, fullName: true, email: true }
        }
      }
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    try {
      await this.prisma.site.delete({ where: { id } });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2003") {
        throw new BadRequestException("연결된 데이터가 있어 현장을 삭제할 수 없습니다.");
      }
      throw error;
    }
  }

  private async ensureManager(managerId: string) {
    const manager = await this.prisma.user.findFirst({
      where: { id: managerId, role: { name: "site_manager" } }
    });
    if (!manager) {
      throw new NotFoundException("현장 소장을 찾을 수 없습니다.");
    }
    return manager.id;
  }
}
