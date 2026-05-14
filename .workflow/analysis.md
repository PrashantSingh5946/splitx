# SplitX — Analysis

## Purpose
Splitwise-style expense-sharing REST API backend. Users create groups, add members, log shared expenses, and track group totals. Designed to back a mobile/web frontend for collaborative bill splitting. Includes Docker + Docker Compose for local dev with MongoDB.

---

## Architecture

**Stack**
- Node.js + Express 4 (JavaScript)
- MongoDB + Mongoose 7 ODM
- JWT (`jsonwebtoken`) + bcryptjs
- Cookie-parser, CORS
- Docker / Docker Compose (Node 19 + MongoDB)
- Faker.js (database seeder)

**Folder layout**
```
splitx/
├── index.js                 Express entry, DB connect, middleware, route mount
├── controllers/             AuthController, GroupController, ExpenseController
├── models/                  UserModel, GroupModel, ExpenseModel
├── routes/                  AuthRoute, GroupRoute, ExpenseRoute
├── middlewares/             AuthMiddleware (JWT verification)
├── util/
│   ├── SecretToken.js       JWT creation helper
│   └── Enums/SplitType.js   0=equal, 1=some members, 2=one person, 3=percentage
├── database/Seeder.js       Faker-based test data generator
└── test/bcrypt.js           Bcrypt sanity test
```

**Data models**
- **User** — email, username, password (bcrypt), firstName, lastName, groups[]
- **Group** — name, groupMembers[], ownerId, expenses[], totalExpenses, settledExpenses
- **Expense** — name, amount, ownerId, groupId, splitType, share[], isSettled

**Request flow**
Client → Route → (AuthMiddleware) → Controller → Mongoose model → MongoDB

---

## Features
- User registration (bcrypt password hash + JWT cookie)
- Email/password login
- JWT session verification endpoint
- Group CRUD (create, list, get, update, delete with cascade expense removal)
- Expense CRUD (create, list by group, get, update, delete — all with MongoDB transactions)
- `totalExpenses` counter maintained on group via transactions
- 4 split type enums defined (equal, some, one, percentage)
- Docker Compose for zero-setup local dev
- Faker.js seeder for test data

---

## Future Scope
- **Split calculation not implemented** — `splitType` and `share` fields stored but never computed; no "who owes whom" logic
- **No settlement endpoints** — `isSettled` and `settledExpenses` fields exist but no API to settle or track payments
- **`ShowAll` groups incomplete** — returns only owner's groups, not groups where user is a member
- **No member management** — can't add/remove members after group creation; no invite flow
- **No user profile endpoints** — no fetch/update for own profile
- **No input validation** — no Joi/Zod; any payload accepted
- **No rate limiting** — auth endpoints unprotected from brute force
- **JWT cookie `httpOnly: false`** — XSS vulnerability
- **CORS hardcoded to `localhost:3000`** — breaks in any other environment
- **`updatedAt` never updated** — set to creation date only, not on mutations
- **Transaction abort inconsistent** — some catch blocks skip `session.abortTransaction()`
- **No pagination** on list endpoints
- **No indexes** on frequently queried fields (email, groupId, userId)
- **No logging** — only console.log debugging statements
- **Almost no tests** — one bcrypt file; no controller/route coverage
- **No API docs** — no Swagger/OpenAPI
- **Android app planned** — README hints at mobile client, not started
