import { Type } from 'class-transformer';
import { IsArray, ValidateNested } from 'class-validator';
import { ReturnItemInputDto } from './create-return.dto';

export class AddReturnItemsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReturnItemInputDto)
  items!: ReturnItemInputDto[];
}
