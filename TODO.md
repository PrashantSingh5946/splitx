# SplitX — Project TODO

> Last updated: July 2026. See `CONTEXT.md` for full architecture/running details.

---

## 🚀 How to Run the Project

### Against production (default)

The backend is live on Vercel (`https://splitx-plum.vercel.app`, MongoDB Atlas) and `constants/api.ts` already points at it — just start the client:

```bash
cd splitx-client/splitx
npx expo start              # scan QR with Expo Go, or press a/i for emulators
```

### Local backend (development only)

```bash
cd /path/to/splitx          # repo root (contains docker-compose.yml)
docker compose up           # Express on :3000 + MongoDB on :27017
```

Then point the client at it by temporarily editing `API_BASE` in `constants/api.ts`
(`http://<LAN-IP>:3000` on a physical device, `http://10.0.2.2:3000` on the Android
emulator, `http://localhost:3000` on the iOS simulator).

> **Seed the database** (destructive — guarded):
> ```bash
> MONGO_URL=... SEED_CONFIRM=yes node database/Seeder.js
> ```
> Refuses to run without `MONGO_URL` and `SEED_CONFIRM=yes`. Seeds 9 users, 3 groups
> (Goa Trip, Apartment 4B, Weekend Crew), 17 expenses incl. percentage-split examples.
> Seed credentials: `octanesingh@gmail.com` / `Splitx@123`

Backend `.env` (copy from `.env.example`): `PORT`, `MONGO_URL` (required, no default),
`TOKEN_KEY`, `APP_URL`.

Auth: JWT stored in `AsyncStorage`, extracted from `Set-Cookie` on login and attached
as a `Cookie` header on every request. A global 401 handler clears the token and
redirects to the auth screen.

---

## ✅ Completed

### UI / Client
- [x] All 4 tabs (Dashboard, Groups, Activity, Profile) with fixed headers + scrollable content
- [x] Custom transparent floating navbar + FAB, aurora gradient backgrounds, Skia blur orbs
- [x] Balance pills (owed / owe / settled), notifications modal, logout modal
- [x] Auth screens (login/signup), protected routes, session restore on launch
- [x] Group detail page, add-expense flow (all split types incl. percentage), add-group flow
- [x] Global 401 → logout + redirect

### Backend / Data
- [x] Deployed to Vercel (`vercel.json`) against MongoDB Atlas; client wired to live API
- [x] Auth, groups, expenses, users, settlements routes
- [x] Percentage splits persisted end-to-end (`percentages` map, validated server-side)
- [x] Equal-all splits snapshot participants at creation (no retroactive rewrites)
- [x] Real settle-up: `Settlement` model + `/settlements` endpoints (no more one-person-expense trick)
- [x] Input validation on expense create/update; finite-number guard on updates
- [x] Auth rate limiting + generic login errors (no account enumeration)
- [x] HTML-escaping of user input in emails
- [x] Env-based seeder with `SEED_CONFIRM` guard + `.env.example`

---

## 🔲 Pending / Nice-to-have

### Correctness / Infra (deferred — see PRIORITIES.md, out of scope for now)
- [ ] **Automated test suite** — `npm test` is currently a self-recursive placeholder
- [ ] **Serverless-safe rate limiting** — current limiter is in-memory/per-process; move to a shared store (Redis or Mongo TTL) so it holds across Vercel instances

### Features / Polish
- [ ] **Real notifications** — currently client-derived from expenses/settlements, no persistence or real-time updates
- [ ] **Profile editing** — make `currency` (hardcoded `₹ INR`) and dark-mode toggle user-configurable (both wired in AppContext, UI rows hidden)
- [ ] **Backdrop blur on logout modal** — needs `@react-native-community/blur` + a native rebuild (`expo run:android`); currently a solid dark overlay
- [ ] **Haptic feedback** — `expo-haptics` on FAB tap, settle confirm, destructive actions
- [ ] **Context-aware FAB** — add-expense when inside a group, add-group otherwise

---

## 📝 Notes

- `@react-native-community/blur` is in `package.json` but requires a native rebuild to work — currently unused. Logout modal backdrop uses solid `rgba(0,0,0,0.75)`.
- Dark mode toggle exists in AppContext but the UI row is hidden on Profile for now.
- `currency` is hardcoded to `₹ INR` in AppContext — make it a user setting when profile edit is built.
