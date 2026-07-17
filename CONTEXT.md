# SplitX — Project Context

Full context dump for resuming development with an AI assistant or new contributor.
Last updated: July 2026.

---

## What is SplitX

A React Native (Expo) bill-splitting app backed by a Node/Express + MongoDB API.
Users create groups, add shared expenses, and track who owes whom.
Inspired by Splitwise. Feature-complete: the backend is deployed to Vercel (`https://splitx-plum.vercel.app`, MongoDB Atlas) and the Expo client talks to it directly — no local setup required to run the app against production. Local docker setup below is for backend development only.

---

## Repo Structure

```
splitx/                          ← repo root
├── docker-compose.yml           ← Express server + MongoDB
├── index.js                     ← Express entry point
├── .env                         ← backend env vars
├── routes/                      ← AuthRoute, GroupRoute, ExpenseRoute, UserRoute
├── controllers/
├── models/
├── middlewares/
├── database/
│   └── Seeder.js                ← seed script (run inside docker)
└── splitx-client/
    └── splitx/                  ← Expo app root
        ├── app/
        │   ├── _layout.tsx      ← root Stack navigator + AppProvider
        │   ├── auth.tsx         ← login / signup screen
        │   ├── aurora.tsx       ← standalone aurora demo screen
        │   ├── add-group.tsx    ← add group modal
        │   ├── add-expense.tsx  ← add expense modal (transparentModal)
        │   └── (tabs)/
        │       ├── _layout.tsx  ← custom tab bar + FAB
        │       ├── index.tsx    ← Dashboard
        │       ├── groups.tsx   ← Groups list
        │       ├── activity.tsx ← Activity feed
        │       └── profile.tsx  ← Profile + settings
        │   └── group/
        │       └── [id].tsx     ← Group detail page
        ├── components/
        │   ├── AppTopBar.tsx    ← logo + bell (notifications) + avatar
        │   ├── NotificationsModal.tsx
        │   ├── Avatar.tsx       ← single Avatar + MemberAvatarStack
        │   ├── BalancePill.tsx  ← "owes ₹X" / "gets back ₹X" / "settled" pill
        │   ├── Money.tsx        ← formatted currency display
        │   ├── Skeleton.tsx     ← loading placeholder
        │   ├── AddMembersModal.tsx
        │   ├── Toast.tsx
        │   └── AuroraBg.tsx
        ├── constants/
        │   ├── theme.ts         ← Colors, Tokens, getTokens(dark)
        │   └── api.ts           ← API_BASE URL (points at deployed Vercel backend)
        ├── services/
        │   ├── api.ts           ← base request() + JWT token management
        │   ├── auth.ts          ← login, signup, checkEmail, fetchMe, logout
        │   ├── groups.ts        ← fetchGroups, fetchGroup, createGroup, searchUsers
        │   ├── expenses.ts      ← fetchExpenses, createExpense, updateExpense, deleteExpense, settleUp
        │   └── mappers.ts       ← raw API → typed Group / Expense / Member / Settlement
        ├── store/
        │   └── AppContext.tsx   ← global state (auth, groups, theme, currency)
        ├── types/
        │   └── index.ts         ← Member, Expense, Group, GroupBalances interfaces
        └── utils/
            └── balance.ts       ← computeShares, computeGroupBalances, computeOverallBalance
```

---

## Running the Project

### Production

The backend is deployed on Vercel (`https://splitx-plum.vercel.app`, `vercel.json` at repo root) against MongoDB Atlas, and `constants/api.ts` already points at it:
```ts
// constants/api.ts
export const API_BASE = 'https://splitx-plum.vercel.app';
```
So to run the client against production, no backend setup is needed — just start Expo (below).

### Backend (local development only)

```bash
cd splitx/                      # repo root
docker compose up               # Express :3000 + MongoDB :27017
```

Point the client at your local backend by temporarily editing `constants/api.ts`'s `API_BASE` (e.g. `http://<LAN-IP>:3000` for a physical device, `http://10.0.2.2:3000` for the Android emulator, `http://localhost:3000` for iOS sim).

Backend `.env` (copy from `.env.example`):
```
PORT=3000
MONGO_URL=<your MongoDB connection string>   # required — no default
TOKEN_KEY=<jwt signing secret>
APP_URL=<client origin for invite links>
```

Seed the DB (destructive — guarded):
```bash
MONGO_URL=... SEED_CONFIRM=yes node database/Seeder.js
```
The seeder refuses to run without `MONGO_URL` set and `SEED_CONFIRM=yes` (a guard against accidentally wiping a real database). It creates:
- **9 users** — Prashant (octanesingh@gmail.com), Aarav, Priya, Karan, Meera, Riya, Sameer, Ishaan, Tara
- **Password for all:** `Splitx@123`
- **3 groups:** Goa Trip 2025 (10 expenses), Apartment 4B (8 expenses), Weekend Crew (6 expenses), including percentage-split examples

### Client

```bash
cd splitx-client/splitx
npx expo start
```

The client is its own git repo (remote: `github.com/PrashantSingh5946/splitx-client`), nested inside the backend repo but gitignored by it.

---

## Architecture & Key Decisions

### Auth Flow
- Backend uses httpOnly JWT cookies (`token` cookie).
- React Native's `fetch` has no cookie jar, so the token is manually extracted from the `Set-Cookie` response header on login/signup and persisted in `AsyncStorage` (`@splitx_token`).
- Every request attaches it as a `Cookie: token=<value>` header.
- On app launch, `AppContext` reads the stored token → calls `GET /users/me` → restores session if valid.
- Logout = clear token from AsyncStorage + clear state in AppContext.

### Global State (`AppContext`)
Everything lives in a single React context. Key fields:
```ts
authed: boolean              // is user logged in
currentUser: UserProfile     // logged-in user's profile
groups: Group[]              // all groups (fetched on login)
T: Tokens                    // current theme tokens (dark/light)
darkMode: boolean            // currently forced to dark
currency: string             // hardcoded '₹' — make user-configurable later
groupsLoading / groupsError  // fetch state
```

Key actions: `login()`, `logout()`, `refreshGroups()`, `addGroupLocally()`, `addExpenseLocally()`

### Theme System
```ts
// constants/theme.ts
Colors.dark / Colors.light    // full token sets
getTokens(dark: boolean)      // returns the right set
T.primary = '#5B4CF5'         // purple — same in both modes
T.bg / T.fg / T.surface / T.border / T.fgMuted / T.fgSubtle
T.owed   // green  (#34D399 dark / #22C55E light)
T.owe    // red    (#F87171 dark / #EF4444 light)
T.settled // grey
```

All components consume `const { T } = useApp()` — never hardcode colors.

### Data Model (frontend types)
```ts
Member    { id, name, initials, color }
Expense   { id, name, payerId, amount, splitType, participants, date, settled }
Group     { id, name, emoji, members, expenses, invitedEmails }
GroupBalances { net, settlements, youOwe, owesYou, yourNet }
```

**Important:** the current user's ID is always normalized to `'u-me'` client-side (done in `mappers.ts`). All balance logic uses `'u-me'` as the self-reference.

### Split Types
| Frontend string | Backend int | Meaning |
|---|---|---|
| `'equal-all'` | `0` | Divide equally among all group members |
| `'equal-some'` | `1` | Divide equally among `participants` array |
| `'one-person'` | `2` | Entire amount borne by `participants[0]` |
| `'percentage'` | `3` | Custom % per member via `percentages` map |

### Balance Algorithm (`utils/balance.ts`)
1. `computeShares(expense, group)` → `Record<memberId, amountOwed>`
2. `computeGroupBalances(group)` → net per member, greedy debt-simplification, `youOwe` / `owesYou` arrays
3. `computeOverallBalance(groups)` → sum of `yourNet` across all groups

---

## UI Design System

### Page Layout Pattern
Every tab page follows this structure:
```tsx
<View style={{ flex:1, paddingTop: insets.top }}>
  <LinearGradient colors={['#0D0B1F','#000000','#0D0B1F']} style={StyleSheet.absoluteFill} />
  <AppTopBar />                           {/* logo + bell + avatar */}
  <View style={styles.fixedTop}>          {/* heading + hero card — FIXED */}
    ...
  </View>
  <View style={[styles.listWrapper, { marginBottom: insets.bottom + 90 }]}>
    <ScrollView ...>                      {/* scrollable content */}
      ...
    </ScrollView>
  </View>
</View>
```

- `marginBottom: insets.bottom + 90` stops scrollable content above the transparent navbar.
- `overflow: 'hidden'` on `listWrapper` clips content so it never bleeds behind the navbar.

### Card / Table Background Pattern
```tsx
<View style={[styles.card, { borderColor: T.border }]}>
  <LinearGradient
    colors={['#201A45', '#181B25']}
    start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
    style={StyleSheet.absoluteFill}
  />
  {/* card content */}
</View>
// card style must have: overflow: 'hidden'
```

### Aurora / Hero Card Pattern (Skia)
```tsx
<View style={styles.heroCard}>
  <LinearGradient colors={[T.primary, shadeHex(T.primary, 0.18)]} style={StyleSheet.absoluteFill} />
  <Canvas style={StyleSheet.absoluteFill}>
    <Circle cx={-20} cy={-20} r={90} color="rgba(255,255,255,0.55)">
      <Blur blur={35} />
    </Circle>
    <Circle cx={300} cy={110} r={70} color="rgba(255,255,255,0.30)">
      <Blur blur={30} />
    </Circle>
  </Canvas>
  {/* content */}
</View>
```

Note: `Blur` on `Circle` is a bloom/glow effect within the Skia canvas — it is **not** a backdrop blur. It cannot blur RN views behind it.

### Page Gradient
```tsx
const PAGE_GRADIENT = ['#0D0B1F', '#000000', '#0D0B1F']
// purple tint top and bottom, pure black in the middle — subtle aurora effect
```

### Navbar (Custom Tab Bar)
- `position: 'absolute', bottom: 0` — truly floats over page content
- `backgroundColor: 'transparent'` — no background layer
- No border (`borderTopWidth: 0`)
- FAB (center button): 64×64, `borderRadius: 32`, primary color gradient, routes to `/add-group`
- Currently FAB goes to `/add-group` — TODO: make it context-aware (add-expense when inside a group)

### shadeHex Helper
Used in multiple files to darken a hex color for gradient ends:
```ts
function shadeHex(hex: string, amount: number): string // amount 0–1 darkens
```

---

## Known Issues / Gotchas

### Backdrop Blur (Logout Modal)
- **Wanted:** frosted glass blur behind the logout confirmation card.
- **Tried:**
  - `expo-blur` `BlurView` inside `<Modal>` → only grey tint on Android (separate window layer)
  - Skia `BackdropBlur` → only blurs content within same Skia canvas, not RN views behind it
  - `@react-native-community/blur` → proper native solution but requires `expo run:android` (native rebuild) to link. Currently errors with "Can't find ViewManager 'AndroidBlurView'" because Expo Go doesn't bundle it.
- **Current state:** solid `rgba(0,0,0,0.75)` dark overlay. `@react-native-community/blur` is in `package.json` but not actively imported.
- **Fix:** run `npx expo run:android` (builds a custom dev client), then re-add `import { BlurView } from '@react-native-community/blur'` in `profile.tsx`.

### Current User ID Normalization
- Backend MongoDB `_id` strings are normalized to `'u-me'` for the logged-in user everywhere.
- This is done in `mappers.ts` → `mapMember()` and `mapExpense()`.
- All balance math, payer checks, and UI logic depend on `'u-me'` for self-reference.

### Dark Mode Toggle
- `toggleDarkMode` exists in AppContext and persists to AsyncStorage.
- The Settings row in Profile is **hidden** (`display: none` effectively — the row is just not rendered).
- App is currently locked to dark mode (`darkMode` defaults to `true`).

### Currency
- Hardcoded to `'₹'` (INR) in AppContext.
- The Settings row shows `₹ INR` but is not interactive.
- Make configurable when profile editing is built.

### Notifications
- Client-derived from group expenses/settlements, not a real backend notifications system.
- First 2 items per group are marked "unread", the rest "read".
- No real-time updates, no mark-as-read persistence.

### Settle Up
- A real backend feature (no longer a client-side "one-person expense" trick).
- `POST /settlements/add` records a `Settlement` (payer, payee, amount) on the group; `GET /settlements/group/:group_id` lists them.
- `computeGroupBalances` subtracts settlements from net balances, and the activity feed merges expenses + settlements.

---

## API Endpoints (Backend)

| Method | Path | Description |
|---|---|---|
| POST | `/login` | Login, returns JWT cookie + user |
| POST | `/signup` | Register, returns JWT cookie + user |
| GET | `/users/me` | Get current user profile |
| GET | `/users/search?q=` | Search users by name/email/username |
| GET | `/check-email?email=` | Check if email exists / has pending invite |
| GET | `/groups/` | Get all groups for current user |
| GET | `/groups/get/:id` | Get single group with expenses |
| POST | `/groups/add` | Create group |
| DELETE | `/groups/delete/:id` | Delete group |
| POST | `/groups/:id/members` | Add members to group |
| GET | `/expenses/group/:groupId` | Get expenses for a group |
| POST | `/expenses/add` | Create expense (validates ownerId/splitType/share/percentages against group membership) |
| PUT | `/expenses/update/:id` | Update expense (name, amount, isSettled; finite-number guarded) |
| DELETE | `/expenses/delete/:id` | Delete expense |
| POST | `/settlements/add` | Record a settlement (payer → payee, amount) in a group |
| GET | `/settlements/group/:group_id` | Get all settlements for a group |

All auth routes (`/login`, `/signup`, `/check-email`) are rate-limited, and login returns a generic 401 (no account enumeration).

---

## Key Libraries

| Package | Version | Purpose |
|---|---|---|
| `expo-router` | ~55.0.14 | File-based routing |
| `@shopify/react-native-skia` | ^2.6.2 | GPU canvas — aurora orbs, blur effects |
| `expo-linear-gradient` | ~55.0.13 | Card / hero gradients |
| `react-native-reanimated` | 4.2.1 | Animations |
| `react-native-gesture-handler` | ~2.30.0 | Gesture support |
| `@react-native-async-storage/async-storage` | 2.2.0 | JWT + dark mode persistence |
| `expo-haptics` | ~55.0.14 | Haptic feedback (installed, not widely used yet) |
| `expo-blur` | ~55.0.14 | BlurView (installed, not used — see Known Issues) |
| `@react-native-community/blur` | ^4.4.1 | Native backdrop blur (installed, needs native rebuild) |
| `@expo/vector-icons` (Feather) | ^15.0.3 | All icons |
| `react-native-safe-area-context` | ~5.6.0 | `useSafeAreaInsets` for navbar/status bar offsets |
