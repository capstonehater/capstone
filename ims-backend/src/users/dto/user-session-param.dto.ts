import { IsUUID } from 'class-validator';

export class UserSessionParamDto {
  @IsUUID()
  id: string;

  @IsUUID()
  sessionId: string;
}
