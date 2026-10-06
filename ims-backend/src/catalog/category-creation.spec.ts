import { ConflictException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CatalogService } from './catalog.service';
import { CreateCategoryDto } from './dto/create-category.dto';

describe('category creation', () => {
  it('trims category names and rejects blank names', async () => {
    const valid = plainToInstance(CreateCategoryDto, { name: '  Desserts  ' });
    expect(valid.name).toBe('Desserts');
    expect(await validate(valid)).toHaveLength(0);
    expect(await validate(plainToInstance(CreateCategoryDto, { name: '   ' }))).not.toHaveLength(0);
  });

  it('creates a category after checking names without case sensitivity', async () => {
    const tx = {
      $queryRaw: jest.fn().mockResolvedValue([]),
      category: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: 'new', name: 'Desserts' }),
      },
    };
    const service = new CatalogService({ $transaction: (callback: (client: unknown) => unknown) => callback(tx) } as never);
    await expect(service.createCategory({ name: '  Desserts  ' })).resolves.toEqual({ id: 'new', name: 'Desserts' });
    expect(tx.category.findFirst).toHaveBeenCalledWith({ where: { name: { equals: 'Desserts', mode: 'insensitive' } }, select: { id: true } });
    expect(tx.category.create).toHaveBeenCalledWith({ data: { name: 'Desserts' } });
  });

  it('rejects a duplicate without inserting another category', async () => {
    const tx = {
      $queryRaw: jest.fn().mockResolvedValue([]),
      category: { findFirst: jest.fn().mockResolvedValue({ id: 'existing' }), create: jest.fn() },
    };
    const service = new CatalogService({ $transaction: (callback: (client: unknown) => unknown) => callback(tx) } as never);
    await expect(service.createCategory({ name: 'coffee' })).rejects.toThrow(ConflictException);
    expect(tx.category.create).not.toHaveBeenCalled();
  });
});
