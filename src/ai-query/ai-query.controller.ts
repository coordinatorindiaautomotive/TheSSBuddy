// src/ai-query/ai-query.controller.ts
import {
  Controller,
  Post,
  Body,
  UseGuards,
  Req,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AiQueryService } from './ai-query.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../rbac/permissions.guard';
import { RequirePermissions } from '../rbac/permissions.decorator';

@ApiTags('ai-query')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('ai-query')
export class AiQueryController {
  constructor(private readonly aiQueryService: AiQueryService) {}

  @Post()
  @RequirePermissions('ai-query:ask')
  @ApiOperation({ summary: 'Submit natural language query to get structured schema-aware data' })
  async processQuery(@Body('query') query: string, @Req() req: any) {
    return this.aiQueryService.processNaturalLanguageQuery(query || '', req.user.id);
  }
}
