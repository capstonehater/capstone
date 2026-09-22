import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { Role } from '@prisma/client';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../common/types/authenticated-user.type';
import { CheckoutDto } from './dto/checkout.dto';
import { ListOrdersDto } from './dto/list-orders.dto';
import { ReverseOrderDto } from './dto/reverse-order.dto';
import { OrdersService } from './orders.service';

@Controller()
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post('pos/checkout')
  async checkout(
    @Body() dto: CheckoutDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.ordersService.checkout(dto, user.id);
  }

  @Get('orders')
  @Roles(Role.ADMINISTRATOR, Role.STAFF)
  async listOrders(@Query() filters: ListOrdersDto) {
    return {
      orders: await this.ordersService.listOrders(filters),
    };
  }

  @Get('orders/:id')
  @Roles(Role.ADMINISTRATOR, Role.STAFF)
  async getOrderById(@Param('id') orderId: string) {
    return {
      order: await this.ordersService.getOrderById(orderId),
    };
  }

  @Post('orders/:id/refund')
  @Roles(Role.ADMINISTRATOR, Role.STAFF)
  async refundOrder(
    @Param('id') orderId: string,
    @Body() dto: ReverseOrderDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return {
      order: await this.ordersService.refundOrder(orderId, dto, user.id),
    };
  }
}
