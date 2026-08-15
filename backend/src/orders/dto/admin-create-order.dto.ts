import { IsString } from 'class-validator';
import { CreateOrderDto } from './create-order.dto';

// Same shape as a client's own order, plus the target client — used when an
// Admin places an order on behalf of a walk-in customer at the counter.
export class AdminCreateOrderDto extends CreateOrderDto {
  @IsString()
  clientId!: string;
}
