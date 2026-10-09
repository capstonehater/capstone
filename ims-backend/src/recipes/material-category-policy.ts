import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

// Assignments apply to the exact product category, including no implicit access
// for parent categories, subcategories, or materials with no assignments.
export async function assertMaterialsAllowedForCategory(
  tx: Prisma.TransactionClient,
  categoryId: string,
  rawMaterialIds: string[],
) {
  if (!rawMaterialIds.length) return;
  const disallowed = await tx.rawMaterial.findFirst({
    where: {
      id: { in: rawMaterialIds },
      categories: { none: { id: categoryId } },
    },
    select: { name: true },
  });
  if (disallowed) {
    throw new BadRequestException(
      `${disallowed.name} is not assigned to this product category. Update the material's product categories or choose another ingredient.`,
    );
  }
}
