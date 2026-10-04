import { ProductManagementService } from './product-management.service';
import { removeProductImage } from './product-image';

jest.mock('./product-image', () => ({ removeProductImage: jest.fn() }));

describe('product photo replacement', () => {
  const oldUrl = '/product-images/11111111-1111-1111-1111-111111111111.webp';
  const newUrl = '/product-images/22222222-2222-2222-2222-222222222222.webp';
  const product = {
    findUnique: jest.fn(), update: jest.fn(), count: jest.fn(),
  };
  let service: ProductManagementService;
  beforeEach(() => {
    jest.resetAllMocks();
    product.findUnique.mockResolvedValue({ id: 'p1', name: 'Coffee', categoryId: 'c1', imageUrl: oldUrl, archivedAt: null });
    product.update.mockResolvedValue({});
    product.count.mockResolvedValue(0);
    service = new ProductManagementService({ product } as never, {} as never, {} as never);
    jest.spyOn(service, 'getAdminProductDetail').mockResolvedValue({} as never);
  });
  it.each([newUrl, null])('removes the previous image after saving %s', async (imageUrl) => {
    product.update.mockImplementation(() => {
      expect(removeProductImage).not.toHaveBeenCalled();
      return Promise.resolve({});
    });
    await service.updateProduct('p1', { imageUrl });
    expect(product.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ imageUrl }) }));
    expect(removeProductImage).toHaveBeenCalledWith(oldUrl);
  });
  it.each([undefined, oldUrl])('keeps the photo when unchanged', async (imageUrl) => {
    await service.updateProduct('p1', { imageUrl });
    expect(removeProductImage).not.toHaveBeenCalled();
  });
  it('keeps the previous image if saving fails', async () => {
    product.update.mockRejectedValue(new Error('Save failed'));
    await expect(service.updateProduct('p1', { imageUrl: newUrl })).rejects.toThrow('Save failed');
    expect(removeProductImage).not.toHaveBeenCalled();
  });
  it('keeps images still referenced by another product', async () => {
    product.count.mockResolvedValue(1);
    await service.updateProduct('p1', { imageUrl: newUrl });
    expect(removeProductImage).not.toHaveBeenCalled();
  });
});
