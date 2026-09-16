import { Role, User } from '@prisma/client';
import { AuthenticatedUser } from '../common/types/authenticated-user.type';

type PublicUserSource = Pick<
  User,
  'id' | 'email' | 'firstName' | 'middleInitial' | 'lastName' | 'role' | 'profilePictureUrl'
>;
type AuthUserSource = Pick<
  User,
  | 'id'
  | 'email'
  | 'firstName'
  | 'middleInitial'
  | 'lastName'
  | 'role'
  | 'isActive'
  | 'profilePictureUrl'
>;

export function buildUserName(input: {
  firstName: string;
  middleInitial?: string | null;
  lastName: string;
}): string {
  const middle = input.middleInitial ? ` ${input.middleInitial}.` : '';
  return `${input.firstName}${middle} ${input.lastName}`.trim();
}

export function toPublicUser(user: PublicUserSource): {
  id: string;
  email: string;
  name: string;
  role: Role;
  profilePictureUrl: string | null;
} {
  return {
    id: user.id,
    email: user.email,
    name: buildUserName(user),
    role: user.role,
    profilePictureUrl: user.profilePictureUrl,
  };
}

export function toAuthenticatedUser(
  user: AuthUserSource,
  sessionId: string,
): AuthenticatedUser {
  return {
    ...toPublicUser(user),
    isActive: user.isActive,
    sessionId,
  };
}
