import { IsIn } from 'class-validator';

export const ORDER_STATUSES = [
  'EN_ATTENTE',
  'CONFIRMEE',
  'PREPARATION',
  'PRETE',
  'EXPEDIEE',
  'LIVREE',
  'ANNULEE',
] as const;

export type OrderStatusValue = (typeof ORDER_STATUSES)[number];

export class UpdateOrderStatusDto {
  @IsIn(ORDER_STATUSES)
  status!: OrderStatusValue;
}
