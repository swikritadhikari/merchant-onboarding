import { type MigrationInterface, type QueryRunner } from 'typeorm';

export class AddListingIndexes1791568083799 implements MigrationInterface {
  public name = 'AddListingIndexes1791568083799';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."idx_merchant_applications_reviewer"`);
    await queryRunner.query(
      `CREATE INDEX "idx_merchant_applications_decided_by" ON "merchant_applications" ("decided_by_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_merchant_applications_created_at" ON "merchant_applications" ("created_at", "id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_merchant_applications_reviewer" ON "merchant_applications" ("assigned_reviewer_id", "created_at") `,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."idx_merchant_applications_reviewer"`);
    await queryRunner.query(`DROP INDEX "public"."idx_merchant_applications_created_at"`);
    await queryRunner.query(`DROP INDEX "public"."idx_merchant_applications_decided_by"`);
    await queryRunner.query(
      `CREATE INDEX "idx_merchant_applications_reviewer" ON "merchant_applications" ("assigned_reviewer_id", "status") `,
    );
  }
}
