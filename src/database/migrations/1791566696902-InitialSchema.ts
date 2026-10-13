import { type MigrationInterface, type QueryRunner } from 'typeorm';

export class InitialSchema1791566696902 implements MigrationInterface {
  public name = 'InitialSchema1791566696902';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."user_role" AS ENUM('ADMIN', 'REVIEWER', 'SALES')`,
    );
    await queryRunner.query(
      `CREATE TABLE "users" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "email" character varying(254) NOT NULL, "full_name" character varying(120) NOT NULL, "password_hash" character varying(100) NOT NULL, "role" "public"."user_role" NOT NULL, "is_active" boolean NOT NULL DEFAULT true, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "chk_users_email_lowercase" CHECK ("email" = lower("email")), CONSTRAINT "PK_a3ffb1c0c8416b9fc6f907b7433" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(`CREATE UNIQUE INDEX "uq_users_email" ON "users" ("email") `);
    await queryRunner.query(
      `CREATE TYPE "public"."business_type" AS ENUM('SOLE_PROPRIETORSHIP', 'PARTNERSHIP', 'LLC', 'CORPORATION', 'NON_PROFIT')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."application_status" AS ENUM('DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'INFO_REQUESTED', 'APPROVED', 'REJECTED', 'RISK_FAILED')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."risk_status" AS ENUM('NOT_STARTED', 'PENDING', 'LOW', 'MEDIUM', 'HIGH', 'ERROR')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."review_decision" AS ENUM('APPROVE', 'REJECT', 'REQUEST_INFO')`,
    );
    await queryRunner.query(
      `CREATE TABLE "merchant_applications" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "business_name" character varying(200) NOT NULL, "legal_business_name" character varying(200) NOT NULL, "business_type" "public"."business_type" NOT NULL, "tax_id" character varying(32) NOT NULL, "bank_account_number" character varying(34) NOT NULL, "status" "public"."application_status" NOT NULL DEFAULT 'DRAFT', "risk_status" "public"."risk_status" NOT NULL DEFAULT 'NOT_STARTED', "risk_score" smallint, "risk_assessed_at" TIMESTAMP WITH TIME ZONE, "submission_count" integer NOT NULL DEFAULT '0', "submitted_at" TIMESTAMP WITH TIME ZONE, "created_by_id" uuid NOT NULL, "assigned_reviewer_id" uuid, "decision" "public"."review_decision", "decision_note" text, "decided_by_id" uuid, "decided_at" TIMESTAMP WITH TIME ZONE, "version" integer NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "owner_full_name" character varying(120) NOT NULL, "owner_email" character varying(254) NOT NULL, "owner_phone" character varying(20) NOT NULL, "processing_monthly_volume_minor" bigint NOT NULL, "processing_average_ticket_minor" bigint NOT NULL, "processing_currency" character(3) NOT NULL, "processing_mcc" character(4) NOT NULL, CONSTRAINT "chk_merchant_applications_decision_fields" CHECK (("decision" IS NULL) = ("decided_by_id" IS NULL) AND ("decision" IS NULL) = ("decided_at" IS NULL)), CONSTRAINT "chk_merchant_applications_amounts" CHECK ("processing_monthly_volume_minor" >= 0 AND "processing_average_ticket_minor" > 0), CONSTRAINT "chk_merchant_applications_submission_count" CHECK ("submission_count" >= 0), CONSTRAINT "chk_merchant_applications_risk_score" CHECK ("risk_score" IS NULL OR "risk_score" BETWEEN 0 AND 100), CONSTRAINT "PK_09b9df0877db73b8a232c8c7ed4" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_merchant_applications_pending_submission" ON "merchant_applications" ("submitted_at") WHERE "status" = 'SUBMITTED'`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_merchant_applications_reviewer" ON "merchant_applications" ("assigned_reviewer_id", "status") `,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_merchant_applications_created_by" ON "merchant_applications" ("created_by_id", "created_at") `,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_merchant_applications_status_created_at" ON "merchant_applications" ("status", "created_at") `,
    );
    await queryRunner.query(
      `CREATE TABLE "audit_logs" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "actor_id" uuid, "actor_role" character varying(16), "action" character varying(64) NOT NULL, "entity_type" character varying(64) NOT NULL, "entity_id" uuid NOT NULL, "metadata" jsonb NOT NULL DEFAULT '{}'::jsonb, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_1bb179d048bbc581caa3b013439" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_audit_logs_entity" ON "audit_logs" ("entity_type", "entity_id", "created_at") `,
    );
    await queryRunner.query(
      `CREATE TABLE "risk_assessments" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "application_id" uuid NOT NULL, "submission_no" integer NOT NULL, "provider" character varying(64) NOT NULL, "provider_reference" character varying(128) NOT NULL, "score" smallint NOT NULL, "risk_level" character varying(16) NOT NULL, "reasons" jsonb NOT NULL, "attempt" smallint NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "uq_risk_assessments_application_submission" UNIQUE ("application_id", "submission_no"), CONSTRAINT "chk_risk_assessments_level" CHECK ("risk_level" IN ('LOW', 'MEDIUM', 'HIGH')), CONSTRAINT "chk_risk_assessments_score" CHECK ("score" BETWEEN 0 AND 100), CONSTRAINT "PK_2717ff3f294d30390a712653d63" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `ALTER TABLE "merchant_applications" ADD CONSTRAINT "fk_merchant_applications_created_by" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "merchant_applications" ADD CONSTRAINT "fk_merchant_applications_assigned_reviewer" FOREIGN KEY ("assigned_reviewer_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "merchant_applications" ADD CONSTRAINT "fk_merchant_applications_decided_by" FOREIGN KEY ("decided_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "risk_assessments" ADD CONSTRAINT "fk_risk_assessments_application" FOREIGN KEY ("application_id") REFERENCES "merchant_applications"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );

    await queryRunner.query(`
      CREATE FUNCTION audit_logs_block_mutation() RETURNS trigger
      LANGUAGE plpgsql AS $$
      BEGIN
        RAISE EXCEPTION 'audit_logs is append-only (% rejected)', TG_OP;
      END;
      $$
    `);
    await queryRunner.query(`
      CREATE TRIGGER trg_audit_logs_immutable
      BEFORE UPDATE OR DELETE ON "audit_logs"
      FOR EACH ROW EXECUTE FUNCTION audit_logs_block_mutation()
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TRIGGER trg_audit_logs_immutable ON "audit_logs"`);
    await queryRunner.query(`DROP FUNCTION audit_logs_block_mutation()`);
    await queryRunner.query(
      `ALTER TABLE "risk_assessments" DROP CONSTRAINT "fk_risk_assessments_application"`,
    );
    await queryRunner.query(
      `ALTER TABLE "merchant_applications" DROP CONSTRAINT "fk_merchant_applications_decided_by"`,
    );
    await queryRunner.query(
      `ALTER TABLE "merchant_applications" DROP CONSTRAINT "fk_merchant_applications_assigned_reviewer"`,
    );
    await queryRunner.query(
      `ALTER TABLE "merchant_applications" DROP CONSTRAINT "fk_merchant_applications_created_by"`,
    );
    await queryRunner.query(`DROP TABLE "risk_assessments"`);
    await queryRunner.query(`DROP INDEX "public"."idx_audit_logs_entity"`);
    await queryRunner.query(`DROP TABLE "audit_logs"`);
    await queryRunner.query(`DROP INDEX "public"."idx_merchant_applications_status_created_at"`);
    await queryRunner.query(`DROP INDEX "public"."idx_merchant_applications_created_by"`);
    await queryRunner.query(`DROP INDEX "public"."idx_merchant_applications_reviewer"`);
    await queryRunner.query(`DROP INDEX "public"."idx_merchant_applications_pending_submission"`);
    await queryRunner.query(`DROP TABLE "merchant_applications"`);
    await queryRunner.query(`DROP TYPE "public"."review_decision"`);
    await queryRunner.query(`DROP TYPE "public"."risk_status"`);
    await queryRunner.query(`DROP TYPE "public"."application_status"`);
    await queryRunner.query(`DROP TYPE "public"."business_type"`);
    await queryRunner.query(`DROP INDEX "public"."uq_users_email"`);
    await queryRunner.query(`DROP TABLE "users"`);
    await queryRunner.query(`DROP TYPE "public"."user_role"`);
  }
}
