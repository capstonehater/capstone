import { NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { InventoryService } from './inventory.service';
import { InventoryController } from './inventory.controller';
import { REQUIRED_PERMISSIONS_KEY } from '../auth/decorators/require-permission.decorator';

describe('supplier deletion', () => {
  const deleteRecord = jest.fn();
  const service = new InventoryService({
    supplier: { delete: deleteRecord },
  } as unknown as PrismaService);

  beforeEach(() => jest.resetAllMocks());

  it('deletes only the requested supplier record', async () => {
    const supplier = { id: 'supplier-1', name: 'Test supplier' };
    deleteRecord.mockResolvedValue(supplier);
    await expect(service.deleteSupplier(supplier.id)).resolves.toEqual(
      supplier,
    );
    expect(deleteRecord).toHaveBeenCalledWith({ where: { id: supplier.id } });
    expect(deleteRecord).toHaveBeenCalledTimes(1);
  });

  it('returns not found when the supplier was already deleted', async () => {
    deleteRecord.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('Record not found', {
        code: 'P2025',
        clientVersion: '6.19.2',
      }),
    );
    await expect(service.deleteSupplier('missing')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('propagates database failures instead of reporting success', async () => {
    const error = new Error('Database unavailable');
    deleteRecord.mockRejectedValue(error);
    await expect(service.deleteSupplier('supplier-1')).rejects.toBe(error);
  });

  it('requires supplier deletion permission', () => {
    const handler = Object.getOwnPropertyDescriptor(
      InventoryController.prototype,
      'deleteSupplier',
    )?.value as object;
    const permissions: unknown = Reflect.getMetadata(
      REQUIRED_PERMISSIONS_KEY,
      handler,
    );
    expect(permissions).toEqual(['suppliers.delete']);
  });
});
