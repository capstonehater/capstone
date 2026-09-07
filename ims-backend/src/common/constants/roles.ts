import { Role } from '@prisma/client';

export const ALL_ROLES: Role[] = [
  Role.ADMINISTRATOR,
  Role.MANAGER,
  Role.STAFF,
];
