import { BadRequestException, Injectable, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { PrismaService } from "../prisma/prisma.service";
import * as bcrypt from "bcrypt";
import { ConfigService } from "@nestjs/config";

export interface TokenBundle {
  accessToken: string;
  expiresIn: number;
  refreshToken: string;
  refreshExpiresIn: number;
}

interface RefreshPayload {
  sub: string;
  email: string;
  tokenType: "refresh";
}

@Injectable()
export class AuthService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService
  ) {}

  async login(email: string, password: string) {
    const user = await this.prisma.user.findUnique({
      where: { email },
      include: {
        role: true,
        site: {
          select: {
            id: true,
            code: true,
            name: true
          }
        }
      }
    });

    if (!user) {
      throw new UnauthorizedException("존재하지 않는 사용자입니다.");
    }

    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) {
      throw new UnauthorizedException("비밀번호가 올바르지 않습니다.");
    }

    if (user.status !== "ACTIVE") {
      throw new UnauthorizedException("비활성화된 계정입니다.");
    }

    void this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() }
    });

    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role.name,
      siteId: user.siteId
    };

    const tokens = await this.issueTokens(payload);

    return {
      ...tokens,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role.name,
        site: user.site,
        status: user.status,
        lastLoginAt: user.lastLoginAt
      }
    };
  }

  async refresh(refreshToken: string) {
    let payload: RefreshPayload;
    try {
      payload = await this.jwtService.verifyAsync<RefreshPayload>(refreshToken, {
        secret: this.getRefreshTokenSecret()
      });
    } catch {
      throw new UnauthorizedException("유효하지 않은 토큰입니다.");
    }

    if (payload.tokenType !== "refresh") {
      throw new UnauthorizedException("유효하지 않은 토큰입니다.");
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      include: {
        role: true
      }
    });

    if (!user || user.status !== "ACTIVE") {
      throw new UnauthorizedException("비활성화된 계정입니다.");
    }

    return this.issueTokens({
      sub: user.id,
      email: user.email,
      role: user.role.name,
      siteId: user.siteId
    });
  }

  async logout(refreshToken: string) {
    try {
      await this.jwtService.verifyAsync<RefreshPayload>(refreshToken, {
        secret: this.getRefreshTokenSecret()
      });
    } catch {
      // ignore invalid tokens for logout
    }
  }

  async changePassword(userId: string, currentPassword: string, newPassword: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId }
    });

    if (!user) {
      throw new UnauthorizedException();
    }

    const isCurrentValid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!isCurrentValid) {
      throw new UnauthorizedException("현재 비밀번호가 올바르지 않습니다.");
    }

    const isSamePassword = await bcrypt.compare(newPassword, user.passwordHash);
    if (isSamePassword) {
      throw new BadRequestException("새 비밀번호는 이전 비밀번호와 달라야 합니다.");
    }

    const newHash = await bcrypt.hash(newPassword, 10);
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash: newHash,
        updatedAt: new Date()
      }
    });

    return { success: true };
  }

  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        role: true,
        site: {
          select: {
            id: true,
            code: true,
            name: true
          }
        }
      }
    });

    if (!user) {
      throw new UnauthorizedException();
    }

    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role.name,
      site: user.site,
      status: user.status,
      lastLoginAt: user.lastLoginAt
    };
  }

  private async issueTokens(payload: { sub: string; email: string; role: string; siteId?: string | null }): Promise<TokenBundle> {
    const accessExpiry = this.configService.get<string>("JWT_EXPIRY", "15m");
    const refreshExpiry = this.configService.get<string>("REFRESH_TOKEN_EXPIRY", "7d");

    const accessToken = await this.jwtService.signAsync(payload, {
      expiresIn: accessExpiry
    });

    const refreshToken = await this.jwtService.signAsync(
      {
        sub: payload.sub,
        email: payload.email,
        tokenType: "refresh" as const
      },
      {
        secret: this.getRefreshTokenSecret(),
        expiresIn: refreshExpiry
      }
    );

    return {
      accessToken,
      expiresIn: this.parseDurationToSeconds(accessExpiry, 15 * 60),
      refreshToken,
      refreshExpiresIn: this.parseDurationToSeconds(refreshExpiry, 7 * 24 * 60 * 60)
    };
  }

  private getRefreshTokenSecret() {
    return this.configService.get<string>("REFRESH_TOKEN_SECRET", "dev-refresh-secret");
  }

  private parseDurationToSeconds(value: string | number | undefined, fallback: number) {
    if (!value) return fallback;
    if (typeof value === "number") return value;
    const match = /^(\d+)([smhd])?$/.exec(value.trim());
    if (!match) return fallback;
    const amount = Number(match[1]);
    const unit = match[2] ?? "s";
    switch (unit) {
      case "s":
        return amount;
      case "m":
        return amount * 60;
      case "h":
        return amount * 60 * 60;
      case "d":
        return amount * 60 * 60 * 24;
      default:
        return fallback;
    }
  }
}
