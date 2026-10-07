import { BadRequestException } from '@nestjs/common';
import type { CheckoutDto } from './dto/checkout.dto';

export function validateDiscountDetails(dto: CheckoutDto) {
  const code = dto.discountCode?.trim() ?? '';
  const senior = /^(senior|senior citizen)(\s*\(20%\))?$/i.test(code);
  const pwd = /^pwd(\s*\(20%\))?$/i.test(code);
  const name = dto.discountCustomerName?.trim() ?? '';
  const idNumber = dto.discountIdNumber?.trim() ?? '';

  if (senior || pwd) {
    if (!name || !idNumber) {
      throw new BadRequestException(
        'Name and discount ID number are required for Senior Citizen and PWD discounts.',
      );
    }
    if (dto.discountRate !== 0.2) {
      throw new BadRequestException(
        'Senior Citizen and PWD discounts must use the configured 20% rate.',
      );
    }
    return { discountCustomerName: name, discountIdNumber: idNumber };
  }

  if (name || idNumber) {
    throw new BadRequestException(
      'Discount ID details must belong to a Senior Citizen or PWD discount.',
    );
  }
  return { discountCustomerName: null, discountIdNumber: null };
}
