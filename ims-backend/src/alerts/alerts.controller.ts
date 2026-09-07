import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { Role } from '@prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import type { AuthenticatedUser } from '../common/types/authenticated-user.type';
import { AlertsService } from './alerts.service';
import { ListAlertsDto } from './dto/list-alerts.dto';
import { UpdateAlertStateDto } from './dto/update-alert-state.dto';

@Controller('alerts')
@Roles(Role.ADMINISTRATOR)
export class AlertsController {
  constructor(private readonly alertsService: AlertsService) {}

  @Get()
  async listAlerts(@Query() filters: ListAlertsDto) {
    return {
      alerts: await this.alertsService.listAlerts(filters),
    };
  }

  @Get('unread-count')
  async getUnreadCount() {
    return this.alertsService.getUnreadCount();
  }

  @Post(':id/acknowledge')
  async acknowledgeAlert(
    @Param('id') alertId: string,
    @Body() dto: UpdateAlertStateDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return {
      alert: await this.alertsService.acknowledgeAlert(
        alertId,
        user.id,
        dto.note,
      ),
    };
  }

  @Post(':id/dismiss')
  async dismissAlert(
    @Param('id') alertId: string,
    @Body() dto: UpdateAlertStateDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return {
      alert: await this.alertsService.dismissAlert(alertId, user.id, dto.note),
    };
  }
}
