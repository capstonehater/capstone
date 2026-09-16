import { Role } from '@prisma/client';

export type AuthenticatedUser = {
  id: string;
  email: string;
  role: Role;
  profilePictureUrl?: string | null;
  name: string;
  isActive: boolean;
  sessionId: string;
};
