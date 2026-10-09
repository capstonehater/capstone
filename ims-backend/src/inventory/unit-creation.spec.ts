import { ConflictException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateUnitDto } from './dto/create-unit.dto';
import { InventoryService } from './inventory.service';

describe('custom unit creation', () => {
  const tx = { $queryRaw: jest.fn(), unit: { findFirst: jest.fn(), create: jest.fn() } };
  const prisma = { $transaction: (callback: (client: typeof tx) => Promise<unknown>) => callback(tx) };
  const service = new InventoryService(prisma as never);
  beforeEach(() => { jest.clearAllMocks(); tx.unit.findFirst.mockResolvedValue(null); });

  it('trims labels and normalizes the abbreviation', async () => {
    const dto = plainToInstance(CreateUnitDto, { name: ' Sachet ', code: ' sachet ', dimension: 'PACKAGE' });
    expect(await validate(dto)).toEqual([]);
    expect(dto).toMatchObject({ name: 'Sachet', code: 'SACHET' });
    await service.createUnit(dto);
    expect(tx.unit.create).toHaveBeenCalledWith({ data: expect.objectContaining({ name: 'Sachet', code: 'SACHET', dimension: 'PACKAGE' }) });
  });
  it.each([
    { name: ' ', code: 'SACHET', dimension: 'COUNT' },
    { name: 'Sachet', code: '1 invalid', dimension: 'COUNT' },
    { name: 'Sachet', code: 'SACHET', dimension: 'UNKNOWN' },
  ])('rejects invalid unit input %j', async input => {
    expect((await validate(plainToInstance(CreateUnitDto, input))).length).toBeGreaterThan(0);
  });
  it('rejects duplicate names or abbreviations without adding another unit', async () => {
    tx.unit.findFirst.mockResolvedValue({ id: 'existing' });
    await expect(service.createUnit({ name: 'Sachet', code: 'SACHET', dimension: 'PACKAGE' })).rejects.toBeInstanceOf(ConflictException);
    expect(tx.unit.create).not.toHaveBeenCalled();
    expect(tx.unit.findFirst).toHaveBeenCalledWith({ where: { OR: [
      { name: { equals: 'Sachet', mode: 'insensitive' } }, { code: { equals: 'SACHET', mode: 'insensitive' } },
    ] } });
  });
});
