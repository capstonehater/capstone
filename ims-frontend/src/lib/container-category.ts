export function isContainerCategory(name: string) {
  return /^containers?$/i.test(name.trim());
}
