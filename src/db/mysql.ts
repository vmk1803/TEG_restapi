import mysql from "mysql2/promise";
import type { Pool, RowDataPacket } from "mysql2/promise";

type ColumnCountRow = RowDataPacket & {
  count: number;
};

export function createMySqlPool(databaseUrl: string): Pool {
  return mysql.createPool({
    uri: databaseUrl,
    connectionLimit: 10,
    decimalNumbers: true,
    // Return DATE columns as "YYYY-MM-DD" strings. Otherwise mysql2 builds a
    // local-midnight Date, which toISOString() shifts to the previous day on
    // servers ahead of UTC (e.g. IST), moving 1st-of-month expenses into the
    // prior month.
    dateStrings: ["DATE"]
  });
}

export async function ensureDatabaseSchema(pool: Pool): Promise<void> {
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS users (
      id CHAR(36) PRIMARY KEY,
      full_name VARCHAR(80) NOT NULL,
      email VARCHAR(191) NOT NULL UNIQUE,
      password_hash VARCHAR(255) NOT NULL,
      role ENUM('USER', 'ADMIN') NOT NULL,
      created_at DATETIME(3) NOT NULL,
      updated_at DATETIME(3) NOT NULL
    )
  `);

  await pool.execute(`
    CREATE TABLE IF NOT EXISTS incomes (
      id CHAR(36) PRIMARY KEY,
      user_id CHAR(36) NOT NULL,
      total_income DECIMAL(12, 2) NOT NULL,
      allocations_json JSON NOT NULL,
      created_at DATETIME(3) NOT NULL,
      updated_at DATETIME(3) NOT NULL,
      CONSTRAINT fk_incomes_user_id FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  await pool.execute(`
    CREATE TABLE IF NOT EXISTS refresh_tokens (
      id CHAR(36) PRIMARY KEY,
      user_id CHAR(36) NOT NULL,
      token_hash CHAR(64) NOT NULL,
      previous_token_hash CHAR(64) NULL,
      previous_rotated_at DATETIME(3) NULL,
      expires_at DATETIME(3) NOT NULL,
      created_at DATETIME(3) NOT NULL,
      updated_at DATETIME(3) NOT NULL,
      INDEX idx_refresh_tokens_token_hash (token_hash),
      INDEX idx_refresh_tokens_previous_token_hash (previous_token_hash),
      INDEX idx_refresh_tokens_user_id (user_id),
      CONSTRAINT fk_refresh_tokens_user_id FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  await pool.execute(`
    CREATE TABLE IF NOT EXISTS expenses (
      id CHAR(36) PRIMARY KEY,
      user_id CHAR(36) NOT NULL,
      category_code VARCHAR(32) NOT NULL,
      description VARCHAR(255) NOT NULL,
      amount DECIMAL(12, 2) NOT NULL,
      spent_date DATE NOT NULL,
      created_at DATETIME(3) NOT NULL,
      updated_at DATETIME(3) NOT NULL,
      CONSTRAINT fk_expenses_user_id FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  const [spentDateColumns] = await pool.query<ColumnCountRow[]>(
    `
      SELECT COUNT(*) AS count
      FROM information_schema.columns
      WHERE table_schema = DATABASE()
        AND table_name = 'expenses'
        AND column_name = 'spent_date'
    `
  );

  if (spentDateColumns[0]?.count === 0) {
    await pool.execute(`
      ALTER TABLE expenses
      ADD COLUMN spent_date DATE NULL
    `);

    await pool.execute(`
      UPDATE expenses
      SET spent_date = DATE(created_at)
      WHERE spent_date IS NULL
    `);

    await pool.execute(`
      ALTER TABLE expenses
      MODIFY COLUMN spent_date DATE NOT NULL
    `);
  }

  await pool.execute(`
    CREATE TABLE IF NOT EXISTS recurring_expenses (
      id CHAR(36) PRIMARY KEY,
      user_id CHAR(36) NOT NULL,
      category_code VARCHAR(32) NOT NULL,
      description VARCHAR(255) NOT NULL,
      amount DECIMAL(12, 2) NOT NULL,
      active TINYINT(1) NOT NULL DEFAULT 1,
      created_at DATETIME(3) NOT NULL,
      updated_at DATETIME(3) NOT NULL,
      INDEX idx_recurring_expenses_user_id (user_id),
      CONSTRAINT fk_recurring_expenses_user_id FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  const [recurringIdColumns] = await pool.query<ColumnCountRow[]>(
    `
      SELECT COUNT(*) AS count
      FROM information_schema.columns
      WHERE table_schema = DATABASE()
        AND table_name = 'expenses'
        AND column_name = 'recurring_id'
    `
  );

  if (recurringIdColumns[0]?.count === 0) {
    await pool.execute(`
      ALTER TABLE expenses
      ADD COLUMN recurring_id CHAR(36) NULL,
      ADD CONSTRAINT fk_expenses_recurring_id FOREIGN KEY (recurring_id)
          REFERENCES recurring_expenses(id) ON DELETE SET NULL,
      ADD UNIQUE KEY ux_expenses_recurring_spent_date (recurring_id, spent_date)
    `);
  }

  // Smart Add: the original sentence and how it was entered (voice/text).
  // Both columns are added in one statement, so checking one is enough.
  const [inputTextColumns] = await pool.query<ColumnCountRow[]>(
    `
      SELECT COUNT(*) AS count
      FROM information_schema.columns
      WHERE table_schema = DATABASE()
        AND table_name = 'expenses'
        AND column_name = 'input_text'
    `
  );

  if (inputTextColumns[0]?.count === 0) {
    await pool.execute(`
      ALTER TABLE expenses
      ADD COLUMN input_text VARCHAR(500) NULL,
      ADD COLUMN input_source VARCHAR(16) NULL
    `);
  }
}
