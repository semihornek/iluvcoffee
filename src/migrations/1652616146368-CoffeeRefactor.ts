import { MigrationInterface, QueryRunner } from 'typeorm';

export class CoffeeRefactor1652616146368 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    queryRunner.query(`ALTER TABLE "coffee" RENAME COLUMN "name" TO "title"`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    queryRunner.query(`ALTER TABLE "coffee" RENAME COLUMN "title" TO "name"`);
  }
}
