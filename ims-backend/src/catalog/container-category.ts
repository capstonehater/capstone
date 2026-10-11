export function isContainerCategory(name: string) {
  return /^containers?$/i.test(name.trim());
}

export const containerCategoryFilter = {
  name: { in: ['Container', 'Containers'], mode: 'insensitive' as const },
};
