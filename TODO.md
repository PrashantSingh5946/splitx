# SplitX — Project TODO

---

## 🚀 How to Run the Project

### Backend (Docker)

```bash
cd /path/to/splitx          # repo root (contains docker-compose.yml)
docker compose up           # starts Express on :3000 + MongoDB on :27017
```

> **Seed the database** (first time or after a wipe):
> ```bash
> docker exec -it express-server node database/Seeder.js
> ```
> Seeds 9 users, 3 groups (Goa Trip, Apartment 4B, Weekend Crew), 17 expenses.
> Seed credentials: `octanesingh@gmail.com` / `Splitx@123`

Backend `.env` lives at repo root — key values:
| Variable | Value |
|---|---|
| `PORT` | `3000` |
| `MONGO_URL` | `mongodb://mongo:27017/splitx` |
| `TOKEN_KEY` | `splitx_jwt_secret_key_dev` |
| `APP_URL` | `http://<your-LAN-IP>:8081` |

---

### Client (Expo)

```bash
cd splitx-client/splitx
npx expo start              # scan QR with Expo Go, or press a/i for emulators
```

> **API base URL** lives in `constants/api.ts`.
> Change the `LOCAL_HOST` IP to your machine's LAN IP when running on a physical device.
> Android emulator: `10.0.2.2` | iOS simulator: `localhost`

Auth: JWT stored in `AsyncStorage` via `@react-native-async-storage/async-storage`.
Token is extracted from `Set-Cookie` on login and attached as `Cookie` header on every request.

---

## ✅ Completed

- [x] Dashboard — fixed heading + Net Balance hero card, scrollable groups list
- [x] Groups tab — fixed heading, scrollable group cards
- [x] Activity tab — fixed heading, scrollable list
- [x] Profile tab — fixed avatar/name header, scrollable settings
- [x] Custom transparent floating navbar (no border, no background)
- [x] Aurora gradient backgrounds on all 4 tab pages (`#0D0B1F → #000 → #0D0B1F`)
- [x] Aurora gradient on group cards, profile cards, logout modal (`#201A45 → #181B25`)
- [x] Skia blur orbs on hero card and logout modal
- [x] Balance pills — theme-aware (owed / owe / settled)
- [x] Notifications modal — slide-up sheet from bottom, overlaps navbar
- [x] Logout modal — themed aurora card with frosted buttons, dark overlay backdrop
- [x] AppTopBar — avatar + bell icon with unread badge
- [x] Database seeder — 9 users, 3 groups, 17 expenses

---

## 🔲 Pending

### Core Flows
- [ ] **Group detail page** — expense list, member balance breakdown, "Add expense" entry point
- [ ] **Add expense flow** — split types (equal, exact, percentage), payer selection, group picker
- [ ] **Settle up flow** — select debt to settle, confirmation screen, mark as settled
- [ ] **Add group flow** — group name, emoji picker, member invite

### Auth
- [ ] **Auth screens** — Login + Signup UI (email/password, form validation, error states)
- [ ] **Client-side auth** — protected routes, session restore on app launch (already partially wired via `verifySession` in AppContext), logout clears token + redirects

### Polish
- [ ] **Tab bar icons** — proper Feather icons, active vs inactive color states
- [ ] **Page transitions** — shared element card → detail, slide-up for add-expense / settle-up sheets
- [ ] **Haptic feedback** — `expo-haptics` on FAB tap, settle confirm, destructive actions

### Backend / Infrastructure
- [ ] **Deploy backend to Vercel** — add `vercel.json`, move secrets to Vercel env vars, point `MONGO_URL` to MongoDB Atlas
- [ ] **Wire client to live API** — update `constants/api.ts` `API_BASE` to deployed Vercel URL, remove local IP fallback

---

## 📝 Notes

- `@react-native-community/blur` is in `package.json` but requires a native rebuild (`expo run:android`) to work — currently unused. Logout modal backdrop uses solid `rgba(0,0,0,0.75)`.
- Dark mode toggle exists in AppContext but the UI row is hidden on the Profile page for now.
- `currency` is hardcoded to `₹ INR` in AppContext — make it a user setting when the profile edit flow is built.
