# WL-SQL

<div align="center">

![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white)
![License](https://img.shields.io/badge/License-MIT-green?style=for-the-badge)
![Node.js](https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)

**A type-safe, fluent SQL query builder for TypeScript/JavaScript applications.**

[Installation](#installation) • [Usage](#usage) • [API](#api) • [Examples](#examples)

</div>

---

## Why WL-SQL?

- ✅ **100% Type-safe** - Catch errors at compile time, not runtime
- 🔗 **Fluent API** - Chain methods for readable query building
- 🛡️ **SQL Injection Prevention** - Parameterized queries by default
- 📦 **Zero Dependencies** - Lightweight and fast
- 🔌 **Database Agnostic** - Works with MySQL, PostgreSQL, SQLite
- 🎯 **IntelliSense** - Full autocomplete support in your IDE

## Installation

```bash
npm install wl-sql
# or
yarn add wl-sql
# or
pnpm add wl-sql
```

## Quick Start

```typescript
import { query, table } from 'wl-sql';

// Define your table schema
interface User {
  id: number;
  name: string;
  email: string;
  created_at: Date;
}

const users = table<User>('users');

// Build queries with full type safety
const selectQuery = query()
  .select('id', 'name', 'email')
  .from(users)
  .where('id', '=', 1)
  .build();

// Output: SELECT id, name, email FROM users WHERE id = ?
// Params: [1]
```

## Usage Examples

### SELECT Queries

```typescript
// Simple select
query()
  .select('*')
  .from(users)
  .build();
// SELECT * FROM users

// Select with conditions
query()
  .select('name', 'email')
  .from(users)
  .where('status', '=', 'active')
  .andWhere('age', '>=', 18)
  .orderBy('created_at', 'DESC')
  .limit(10)
  .build();
// SELECT name, email FROM users WHERE status = ? AND age >= ? ORDER BY created_at DESC LIMIT 10

// Join tables
query()
  .select('users.name', 'orders.total')
  .from(users)
  .join('orders', 'users.id', '=', 'orders.user_id')
  .where('orders.status', '=', 'completed')
  .build();
// SELECT users.name, orders.total FROM users JOIN orders ON users.id = orders.user_id WHERE orders.status = ?
```

### INSERT Queries

```typescript
query()
  .insert(users)
  .values({
    name: 'Rithy Tep',
    email: 'rithy@example.com',
  })
  .build();
// INSERT INTO users (name, email) VALUES (?, ?)

// Bulk insert
query()
  .insert(users)
  .values([
    { name: 'User 1', email: 'user1@example.com' },
    { name: 'User 2', email: 'user2@example.com' },
  ])
  .build();
```

### UPDATE Queries

```typescript
query()
  .update(users)
  .set({ name: 'New Name', updated_at: new Date() })
  .where('id', '=', 1)
  .build();
// UPDATE users SET name = ?, updated_at = ? WHERE id = ?
```

### DELETE Queries

```typescript
query()
  .delete()
  .from(users)
  .where('status', '=', 'inactive')
  .build();
// DELETE FROM users WHERE status = ?
```

## API Reference

### Query Builder Methods

| Method | Description |
|--------|-------------|
| `select(...columns)` | Select columns |
| `from(table)` | Specify table |
| `where(column, op, value)` | Add WHERE clause |
| `andWhere(column, op, value)` | Add AND condition |
| `orWhere(column, op, value)` | Add OR condition |
| `join(table, col1, op, col2)` | INNER JOIN |
| `leftJoin(table, col1, op, col2)` | LEFT JOIN |
| `rightJoin(table, col1, op, col2)` | RIGHT JOIN |
| `orderBy(column, direction)` | ORDER BY |
| `groupBy(...columns)` | GROUP BY |
| `having(column, op, value)` | HAVING clause |
| `limit(count)` | LIMIT results |
| `offset(count)` | OFFSET results |
| `build()` | Generate SQL & params |

## Database Adapters

```typescript
import { createAdapter } from 'wl-sql';

// MySQL
const mysql = createAdapter('mysql', {
  host: 'localhost',
  user: 'root',
  password: 'password',
  database: 'mydb',
});

// Execute query
const users = await mysql.execute(
  query().select('*').from(users).build()
);
```

## Contributing

Contributions are welcome! Please read our contributing guidelines first.

```bash
# Clone repo
git clone https://github.com/RithyTep/wl-sql.git

# Install dependencies
npm install

# Run tests
npm test

# Build
npm run build
```

## License

MIT License - see [LICENSE](LICENSE) for details.

---

<div align="center">

**Made with ❤️ by [Rithy Tep](https://github.com/RithyTep)**

[![GitHub](https://img.shields.io/badge/GitHub-RithyTep-181717?style=flat-square&logo=github)](https://github.com/RithyTep)

</div>
