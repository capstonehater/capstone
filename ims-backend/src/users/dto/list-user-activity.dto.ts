import { Type } from 'class-transformer';
import { IsInt, Max, Min } from 'class-validator';
import {
  DEFAULT_USER_ACTIVITY_PAGE,
  DEFAULT_USER_ACTIVITY_PAGE_SIZE,
  MAX_USER_ACTIVITY_PAGE_SIZE,
} from '../users.constants';

export class ListUserActivityDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = DEFAULT_USER_ACTIVITY_PAGE;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_USER_ACTIVITY_PAGE_SIZE)
  pageSize: number = DEFAULT_USER_ACTIVITY_PAGE_SIZE;
}
