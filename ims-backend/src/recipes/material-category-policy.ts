import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { containerCategoryFilter } from '../catalog/container-category';

// Food ingredients require the exact product category. Containers can be used
// by any product recipe while remaining hidden from standalone POS sales.
export async function assertMaterialsAllowedForCategory(
  tx: Prisma.TransactionClient,
  categoryId: string,
  rawMaterialIds: string[],
) {
  if (!rawMaterialIds.length) return;
  const disallowed = await tx.rawMaterial.findFirst({
    where: {
      id: { in: rawMaterialIds },
      categories: { none: { OR: [{ id: categoryId }, containerCategoryFilter] } },
    },
    select: { name: true },
  });
  if (disallowed) {
    throw new BadRequestException(
      `${disallowed.name} is not assigned to this product category. Update the material's product categories or choose another ingredient.`,
    );
  }
}
