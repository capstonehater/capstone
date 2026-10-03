import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequirePermission } from '../auth/decorators/require-permission.decorator';
import type { AuthenticatedUser } from '../common/types/authenticated-user.type';
import { AlertsService } from './alerts.service';
import { ListAlertsDto } from './dto/list-alerts.dto';
import { UpdateAlertStateDto } from './dto/update-alert-state.dto';

@Controller('alerts')
export class AlertsController {
  constructor(private readonly alertsService: AlertsService) {}

  @Get()
  @RequirePermission('alerts.view')
  async listAlerts(@Query() filters: ListAlertsDto) {
    return {
      alerts: await this.alertsService.listAlerts(filters),
    };
  }

  @Get('unread-count')
  @RequirePermission('alerts.view')
  async getUnreadCount() {
    return this.alertsService.getUnreadCount();
  }

  @Post(':id/acknowledge')
  @RequirePermission('alerts.acknowledge')
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
  @RequirePermission('alerts.dismiss')
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
