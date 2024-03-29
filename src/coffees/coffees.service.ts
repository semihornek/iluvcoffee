import { HttpException, HttpStatus, Inject, Injectable, NotFoundException, Scope } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Connection, In, Repository } from 'typeorm';
import { ConfigService, ConfigType } from '@nestjs/config';

import { CreateCoffeeDto } from './dto/create-coffee.dto';
import { UpdateCoffeeDto } from './dto/update-coffee.dto';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';

import { Coffee } from './entities/coffee.entity';
import { Flavor } from './entities/flavors.entity';
import { Event } from '../events/entities/event.entity';

import { COFFEE_BRANDS } from './coffees.constants';
import coffeesConfig from './config/coffees.config';

@Injectable({ scope: Scope.DEFAULT })
export class CoffeesService {
  constructor(
    @InjectRepository(Coffee)
    private readonly coffeeRepository: Repository<Coffee>,
    @InjectRepository(Flavor)
    private readonly flavorRepository: Repository<Flavor>,

    private readonly connection: Connection, // @Inject(COFFEE_BRANDS) coffeeBrands: string[], // @Inject(coffeesConfig.KEY)
  ) // private readonly coffeesConfiguration: ConfigType<typeof coffeesConfig>,
  {
    console.log('CoffeesService instantiated');
    // console.log(coffeeBrands);
    // console.log(coffeesConfiguration.foo);
  }

  findAll = async (paginationQuery: PaginationQueryDto) => {
    const { offset, limit } = paginationQuery;
    return await this.coffeeRepository.find({ relations: ['flavors'], skip: offset, take: limit });
  };

  findOne = async (id: string) => {
    const coffee = await this.coffeeRepository.findOne(id, { relations: ['flavors'] });
    if (!coffee) throw new NotFoundException(`Coffee #${id} not found`);
    return coffee;
  };

  create = async (createCoffeeDto: CreateCoffeeDto) => {
    const flavors = await Promise.all(createCoffeeDto.flavors.map((name) => this.preloadFlavorByName(name)));

    const coffee = this.coffeeRepository.create({ ...createCoffeeDto, flavors });
    return await this.coffeeRepository.save(coffee);
  };

  update = async (id: string, updateCoffeeDto: UpdateCoffeeDto) => {
    const flavors = updateCoffeeDto.flavors && (await Promise.all(updateCoffeeDto.flavors.map((name) => this.preloadFlavorByName(name))));

    const coffee = await this.coffeeRepository.preload({ id: +id, ...updateCoffeeDto, flavors });
    if (!coffee) throw new NotFoundException(`Coffee #${id} not found.`);
    return this.coffeeRepository.save(coffee);
  };

  remove = async (id: string) => {
    const coffee = await this.coffeeRepository.findOne(id);
    return await this.coffeeRepository.remove(coffee);
  };

  private preloadFlavorByName = async (name: string) => {
    const existingFlavor = await this.flavorRepository.findOne({ name });
    if (existingFlavor) return existingFlavor;
    return this.flavorRepository.create({ name });
  };

  recommendCoffee = async (coffee: Coffee) => {
    const queryRunner = this.connection.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      coffee.recommendations++;

      const recommendEvent = new Event();
      recommendEvent.name = 'recommend_coffee';
      recommendEvent.type = 'coffee';
      recommendEvent.payload = { coffeeId: coffee.id };

      await queryRunner.manager.save(coffee);
      await queryRunner.manager.save(recommendEvent);

      await queryRunner.commitTransaction();
    } catch (error) {
      await queryRunner.rollbackTransaction();
    } finally {
      await queryRunner.release();
    }
  };
}
