import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { CreateUserDto } from "./dto/create-user.dto";
import { UpdateUserDto } from "./dto/update-user.dto";
import * as bcrypt from "bcrypt";

@Injectable()
export class UserService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    return this.prisma.user.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        role: true,
        site: {
          select: { id: true, code: true, name: true }
        }
      }
    });
  }

  async findOne(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: {
        role: true,
        site: {
          select: { id: true, code: true, name: true }
        }
      }
    });
    if (!user) {
      throw new NotFoundException("사용자를 찾을 수 없습니다.");
    }
    return user;
  }

  async create(dto: CreateUserDto) {
    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existing) {
      throw new BadRequestException("이미 등록된 이메일입니다.");
    }

    const role = await this.prisma.role.findUnique({ where: { name: dto.role } });
    if (!role) {
      throw new BadRequestException("유효하지 않은 역할입니다.");
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);

    return this.prisma.user.create({
      data: {
        email: dto.email,
        fullName: dto.fullName,
        phone: dto.phone?.trim() || null,
        passwordHash,
        roleId: role.id,
        siteId: dto.siteId,
        status: dto.status ?? "ACTIVE"
      },
      include: {
        role: true,
        site: {
          select: { id: true, code: true, name: true }
        }
      }
    });
  }

  async update(id: string, dto: UpdateUserDto) {
    const user = await this.findOne(id);

    let roleId = user.roleId;
    if (dto.role !== undefined) {
      const role = await this.prisma.role.findUnique({ where: { name: dto.role } });
      if (!role) {
        throw new BadRequestException("유효하지 않은 역할입니다.");
      }
      roleId = role.id;
    }

    return this.prisma.user.update({
      where: { id },
      data: {
        ...(dto.fullName !== undefined ? { fullName: dto.fullName } : {}),
        ...(dto.phone !== undefined ? { phone: dto.phone?.trim() || null } : {}),
        roleId,
        ...(dto.siteId !== undefined ? { siteId: dto.siteId } : {}),
        ...(dto.status !== undefined ? { status: dto.status } : {}),
        ...(dto.password ? { passwordHash: await bcrypt.hash(dto.password, 10) } : {})
      },
      include: {
        role: true,
        site: {
          select: { id: true, code: true, name: true }
        }
      }
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    try {
      await this.prisma.user.delete({ where: { id } });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2003") {
        throw new BadRequestException("연결된 데이터가 있어 사용자를 삭제할 수 없습니다.");
      }
      throw error;
    }
  }
}
