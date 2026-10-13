import 'dotenv/config';
import { hash } from 'bcryptjs';
import { Role } from '../../modules/users/enums';
import { User } from '../../modules/users/entities';
import dataSource from '../cli';

interface DemoUser {
  email: string;
  fullName: string;
  role: Role;
}

const MIN_PASSWORD_LENGTH = 12;
const DEFAULT_HASH_ROUNDS = 12;

const DEMO_USERS: readonly DemoUser[] = [
  { email: 'admin@example.test', fullName: 'Avery Admin', role: Role.Admin },
  { email: 'reviewer.one@example.test', fullName: 'Riley Reviewer', role: Role.Reviewer },
  { email: 'reviewer.two@example.test', fullName: 'Rowan Reviewer', role: Role.Reviewer },
  { email: 'sales.one@example.test', fullName: 'Sam Sales', role: Role.Sales },
  { email: 'sales.two@example.test', fullName: 'Sky Sales', role: Role.Sales },
];

async function seed(): Promise<void> {
  const password = process.env.SEED_USER_PASSWORD;
  if (password === undefined || password.length < MIN_PASSWORD_LENGTH) {
    throw new Error(
      `Set SEED_USER_PASSWORD (${MIN_PASSWORD_LENGTH}+ characters) in your environment before seeding`,
    );
  }

  await dataSource.initialize();
  try {
    const rounds = Number(process.env.PASSWORD_HASH_ROUNDS ?? DEFAULT_HASH_ROUNDS);
    const passwordHash = await hash(password, rounds);
    await dataSource
      .createQueryBuilder()
      .insert()
      .into(User)
      .values(DEMO_USERS.map((user) => ({ ...user, passwordHash })))
      .orIgnore()
      .execute();
    console.log(`Seeded users: ${DEMO_USERS.map((u) => `${u.email} (${u.role})`).join(', ')}`);
  } finally {
    await dataSource.destroy();
  }
}

seed().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
