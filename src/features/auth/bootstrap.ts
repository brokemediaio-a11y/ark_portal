import "server-only";
import { randomUUID } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";

// Bootstrap hashes are server-only. Never restore these passwords on restart.
const accounts = [
  {
    "name": "Ark Travelers Administrator",
    "email": "info@arktravelers.com",
    "role": "admin",
    "hash": "scrypt:b4a996d0302be2415e67ee8be6adff17:304465c970c8c0b5de5fd3f21e5688a92ef5c50c5907f9cad5fe1c82325c96fd60d7a22336a0229ec1618dc16c497f6b02ae02c6c8a04c9c565ca32c3d2d95eb"
  },
  {
    "name": "Nexordis Development",
    "email": "admin@nexordis.com",
    "role": "super_admin",
    "hash": "scrypt:ad661e6bb00d08556d734bcd45815197:64a475b5a4a2e1de8e54cf52de9bd0b38c9d032e1ebb357a9e237ae569261cec2a840502f0203527b15ceff216ca5ab8eb757d6df4bdb0d7e7ee12a5b3efcd31"
  }
] as const;

export function seedAccounts(database: DatabaseSync) {
  database.exec("BEGIN IMMEDIATE");
  try {
    if (!database.prepare("SELECT value FROM app_metadata WHERE key='bootstrap_accounts_v1'").get()) {
      const insert = database.prepare("INSERT INTO users (id,name,email,password_hash,role,active,must_change_password,created_at) VALUES (?,?,?,?,?,1,1,?) ON CONFLICT(email) DO NOTHING");
      for (const account of accounts) {
        // Preserve existing accounts and changed passwords during upgrades.
        insert.run(randomUUID(), account.name, account.email, account.hash, account.role, new Date().toISOString());
      }
      database.prepare("INSERT INTO app_metadata (key,value) VALUES ('bootstrap_accounts_v1','complete')").run();
    }
    database.exec("COMMIT");
  } catch (error) { database.exec("ROLLBACK"); throw error; }
}
