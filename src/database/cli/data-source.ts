import 'dotenv/config';
import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { buildTypeOrmOptions, databaseConfigFromEnv } from '../config';

export default new DataSource(buildTypeOrmOptions(databaseConfigFromEnv()));
