// src/auth/dto/auth-response.dto.ts
import { ApiProperty } from '@nestjs/swagger';

export class AuthResponseDto {
  @ApiProperty()
  accessToken: string;

  @ApiProperty()
  refreshToken: string;

  @ApiProperty()
  expiresIn: number;

  @ApiProperty()
  user: {
    id: string;
    username: string;
    fullName: string;
    email: string | null;
    role?: string;
    roles: string[];
    branchCode?: string | null;
    branchName?: string | null;
    incharge?: string | null;
    assignedBranches?: string[];
    defaultBranch: string | null;
  };
}
