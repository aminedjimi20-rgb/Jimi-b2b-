import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateFabricantDto } from './dto/create-fabricant.dto';

@Injectable()
export class FabricantsService {
  constructor(private prisma: PrismaService) {}

  async findAll() {
    const fabricants = await this.prisma.fabricant.findMany({
      orderBy: { nom: 'asc' },
      include: { _count: { select: { products: true } } },
    });
    return fabricants.map(({ _count, ...f }) => ({ ...f, productCount: _count.products }));
  }

  async create(dto: CreateFabricantDto) {
    return this.prisma.fabricant.create({ data: dto });
  }

  async update(id: string, dto: Partial<CreateFabricantDto>) {
    await this.assertExists(id);
    return this.prisma.fabricant.update({ where: { id }, data: dto });
  }

  async remove(id: string) {
    await this.assertExists(id);
    await this.prisma.fabricant.delete({ where: { id } });
  }

  private async assertExists(id: string) {
    const fabricant = await this.prisma.fabricant.findUnique({ where: { id } });
    if (!fabricant) throw new NotFoundException('Fabricant introuvable.');
  }
}
