# SplitX

Expense-sharing API backend — create groups, add shared expenses, and track who owes what. Built as the server for a Splitwise-style mobile/web app.

![Node.js](https://img.shields.io/badge/Node.js-339933?style=flat&logo=node.js&logoColor=white)
![Express](https://img.shields.io/badge/Express-000000?style=flat&logo=express&logoColor=white)
![MongoDB](https://img.shields.io/badge/MongoDB-47A248?style=flat&logo=mongodb&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-2496ED?style=flat&logo=docker&logoColor=white)
![JWT](https://img.shields.io/badge/JWT-000000?style=flat&logo=jsonwebtokens&logoColor=white)

---

## Features

- **User auth** — register and login with bcrypt-hashed passwords and JWT cookies
- **Groups** — create groups with named members; owner can update or delete
- **Expenses** — add, edit, and delete expenses with atomic MongoDB transactions
- **Running totals** — group `totalExpenses` updated automatically on every change
- **Cascade delete** — deleting a group removes all associated expenses
- **Split types** — equal among all, equal among some, paid by one, or by percentage
- **Docker Compose** — zero-config local dev with MongoDB included
- **Database seeder** — Faker.js script to populate test data

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Runtime | Node.js |
| Framework | Express 4 |
| Database | MongoDB + Mongoose 7 |
| Auth | JWT + bcryptjs |
| Dev | Docker, Docker Compose |

---

## Getting Started

### With Docker (recommended)

```bash
docker-compose up
```

Starts MongoDB and the Express server on port `3000`.

### Without Docker

```bash
npm install
```

Create a `.env` file:

```env
MONGO_URI=mongodb://localhost:27017/splitx
TOKEN_KEY=your_jwt_secret
```

```bash
npm start
```

### Seed test data

```bash
node database/Seeder.js
```

---

## API Reference

### Auth

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/signup` | Register a new user |
| `POST` | `/login` | Login and receive JWT cookie |
| `POST` | `/` | Verify current session |

### Groups — `/groups`

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/add` | Create a group |
| `GET` | `/` | List your groups |
| `GET` | `/get/:id` | Get group details |
| `PUT` | `/update/:id` | Update group (owner only) |
| `DELETE` | `/delete/:id` | Delete group + all its expenses |

### Expenses — `/expenses`

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/add` | Add an expense to a group |
| `GET` | `/group/:group_id` | List expenses in a group |
| `GET` | `/get/:id` | Get expense details |
| `PUT` | `/update/:id` | Update an expense |
| `DELETE` | `/delete/:id` | Delete an expense |

All routes except `/signup` and `/login` require a valid JWT cookie.

---

## Data Models

```
User     { email, username, password, firstName, lastName, groups[] }
Group    { name, groupMembers[], ownerId, expenses[], totalExpenses }
Expense  { name, amount, ownerId, groupId, splitType, share[], isSettled }
```

### Split types

| Value | Meaning |
|-------|---------|
| `0` | Equal split among all members |
| `1` | Equal split among selected members |
| `2` | Fully paid by one person |
| `3` | Split by percentage |

---

## Project Structure

```
splitx/
├── controllers/        AuthController, GroupController, ExpenseController
├── models/             UserModel, GroupModel, ExpenseModel
├── routes/             AuthRoute, GroupRoute, ExpenseRoute
├── middlewares/        JWT verification
├── util/
│   ├── SecretToken.js  JWT creation
│   └── Enums/          SplitType definitions
├── database/Seeder.js  Faker-based test data generator
├── Dockerfile
└── docker-compose.yml
```

---

## Environment Variables

| Variable | Description |
|----------|-------------|
| `MONGO_URI` | MongoDB connection string |
| `TOKEN_KEY` | JWT signing secret |
