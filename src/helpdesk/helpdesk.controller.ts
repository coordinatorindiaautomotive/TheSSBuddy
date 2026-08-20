// src/helpdesk/helpdesk.controller.ts
import { Controller, Get, Post, Delete, Body, Param, Query, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { HelpdeskService } from './helpdesk.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../rbac/permissions.guard';
import { RequirePermissions } from '../rbac/permissions.decorator';

@ApiTags('helpdesk')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('helpdesk')
export class HelpdeskController {
  constructor(private readonly helpdeskService: HelpdeskService) {}

  @Get('categories')
  @ApiOperation({ summary: 'List all dynamic helpdesk categories' })
  async getCategories() {
    return this.helpdeskService.getCategories();
  }

  @Post('categories')
  @RequirePermissions('users:manage-roles')
  @ApiOperation({ summary: 'Create or update a helpdesk category' })
  async createOrUpdateCategory(@Body() body: any) {
    return this.helpdeskService.createOrUpdateCategory(body);
  }

  @Delete('categories/:id')
  @RequirePermissions('users:manage-roles')
  @ApiOperation({ summary: 'Delete a helpdesk category' })
  async deleteCategory(@Param('id') id: string) {
    return this.helpdeskService.deleteCategory(id);
  }

  @Get()
  @ApiOperation({ summary: 'List tickets with dynamic category and priority filters' })
  async getTickets(
    @Query('category') category?: string,
    @Query('priority') priority?: string,
    @Query('status') status?: string,
    @Query('search') search?: string,
  ) {
    return this.helpdeskService.getTickets(category, priority, status, search);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get ticket details with full audit comment log' })
  async getTicketById(@Param('id') id: string) {
    return this.helpdeskService.getTicketById(id);
  }

  @Post()
  @ApiOperation({ summary: 'Create support ticket' })
  async createTicket(@Body() body: any, @Req() req: any) {
    return this.helpdeskService.createTicket(body, req.user?.id);
  }

  @Post(':id/status')
  @RequirePermissions('users:manage-roles')
  @ApiOperation({ summary: 'Update ticket status / assignment' })
  async updateTicketStatus(
    @Param('id') id: string,
    @Body() body: { status: string; assignedToUserId?: string },
    @Req() req: any,
  ) {
    return this.helpdeskService.updateTicketStatus(id, body.status, body.assignedToUserId, req.user?.id);
  }

  @Post(':id/comments')
  @ApiOperation({ summary: 'Add message/comment to ticket' })
  async addComment(
    @Param('id') id: string,
    @Body() body: { comment: string },
    @Req() req: any,
  ) {
    return this.helpdeskService.addComment(id, body.comment, req.user?.id);
  }

  @Delete(':id')
  @RequirePermissions('users:manage-roles')
  @ApiOperation({ summary: 'Delete ticket' })
  async deleteTicket(@Param('id') id: string) {
    return this.helpdeskService.deleteTicket(id);
  }
}
