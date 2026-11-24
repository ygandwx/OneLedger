import { PrismaClient } from "@prisma/client";

const state = globalThis as typeof globalThis & { ledgerDb?: PrismaClient };
export const db = state.ledgerDb ??= new PrismaClient();
