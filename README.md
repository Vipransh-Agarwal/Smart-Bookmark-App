# 📑 Smart Bookmark App

A secure, real-time bookmark manager built with **Next.js**, **Supabase**, and **Tailwind CSS**. Authenticate via Google, save your favorite links, and see updates instantly across all your open tabs and devices.

🔗 **Live Demo:** [smart-bookmark-bn2igveo7-vipranshs-projects-6b2bc7f5.vercel.app](https://smart-bookmark-bn2igveo7-vipranshs-projects-6b2bc7f5.vercel.app/)

---

## ✨ Features

| Feature | Description |
|---|---|
| **Google OAuth** | One-click sign-in via Google — no passwords stored |
| **Add / Delete Bookmarks** | Save links with a title and URL; delete with confirmation |
| **Real-Time Sync** | Bookmarks update instantly across all open tabs (BroadcastChannel) and across devices (Supabase Realtime) |
| **Search & Filter** | Instantly filter bookmarks by title or URL |
| **Favicon Display** | Automatically fetches and displays site favicons |
| **Row Level Security** | Every user can only access their own data — enforced at the database level |
| **Responsive Design** | Mobile-first layout that adapts from phones to desktops |
| **Dark Theme** | Premium glassmorphism UI with animated gradient background |

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| **Framework** | [Next.js 16](https://nextjs.org/) (App Router) |
| **Language** | TypeScript |
| **Styling** | Tailwind CSS v4 + custom CSS (glassmorphism, animations) |
| **Auth** | [Supabase Auth](https://supabase.com/docs/guides/auth) (Google OAuth 2.0) |
| **Database** | [Supabase](https://supabase.com/) (PostgreSQL) with Row Level Security |
| **Realtime** | Supabase Realtime (`postgres_changes`) + BroadcastChannel API |
| **Deployment** | [Vercel](https://vercel.com/) |

---

## 📂 Project Structure

```
Smart Book App/
├── env.local.example          # Environment variable template
├── supabase/
│   └── migration.sql           # DB schema, RLS policies, Realtime setup
├── src/
│   ├── middleware.ts            # Route protection & session refresh
│   ├── lib/supabase/
│   │   ├── client.ts            # Browser-side Supabase client
│   │   └── server.ts            # Server-side Supabase client (cookies)
│   ├── app/
│   │   ├── layout.tsx           # Root layout (Inter font, dark mode, SEO)
│   │   ├── page.tsx             # Root redirect → /login
│   │   ├── globals.css          # Global styles & design tokens
│   │   ├── login/
│   │   │   └── page.tsx         # Login page with Google Sign-In
│   │   ├── auth/callback/
│   │   │   └── route.ts         # OAuth code → session exchange
│   │   └── dashboard/
│   │       └── page.tsx         # Server component: fetch bookmarks
│   └── components/
│       ├── DashboardClient.tsx  # Client component: CRUD, realtime, search
│       ├── BookmarkCard.tsx     # Individual bookmark card
│       └── Toast.tsx            # Success/error notifications
├── package.json
├── tsconfig.json
└── next.config.ts
```

---

## 🚀 Getting Started

### Prerequisites

- **Node.js** v20+
- **npm** (or yarn / pnpm / bun)
- A **Supabase** project ([create one free](https://supabase.com/))
- **Google OAuth** credentials configured in Supabase

### 1. Clone the Repository

```bash
git clone https://github.com/Vipransh-Agarwal/Smart-Bookmark-App.git
cd Smart-Bookmark-App
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Set Up Supabase

#### a) Create the Database Table

Copy the contents of [`supabase/migration.sql`](supabase/migration.sql) and run it in your **Supabase SQL Editor** (Dashboard → SQL Editor → New Query → Paste → Run).

This will:
- Create the `bookmarks` table with UUID primary key
- Add indexes on `user_id` and `created_at`
- Enable **Row Level Security** (RLS) with policies so users can only access their own bookmarks
- Enable **Supabase Realtime** on the bookmarks table

<details>
<summary>📄 View migration SQL</summary>

```sql
CREATE TABLE IF NOT EXISTS public.bookmarks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  url TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bookmarks_user_id ON public.bookmarks(user_id);
CREATE INDEX IF NOT EXISTS idx_bookmarks_created_at ON public.bookmarks(created_at DESC);

ALTER TABLE public.bookmarks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own bookmarks"
  ON public.bookmarks FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own bookmarks"
  ON public.bookmarks FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own bookmarks"
  ON public.bookmarks FOR DELETE USING (auth.uid() = user_id);

ALTER PUBLICATION supabase_realtime ADD TABLE public.bookmarks;
```

</details>

#### b) Configure Google OAuth

1. Go to **Supabase Dashboard → Authentication → Providers → Google**
2. Enable Google provider
3. Add your Google OAuth **Client ID** and **Client Secret** (from [Google Cloud Console](https://console.cloud.google.com/apis/credentials))
4. Set the **Redirect URL** shown in Supabase as an Authorized redirect URI in Google Cloud Console

### 4. Configure Environment Variables

Copy the example file and fill in your Supabase credentials:

```bash
cp env.local.example .env.local
```

Edit `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
```

> ⚠️ **Never expose the Service Role key** in client-side environment variables.

### 5. Run the Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the app.

---

## 🏗️ Architecture

### Authentication Flow

```
User → "Sign in with Google" → Supabase Auth → Google OAuth → Callback
  → Exchange code for session → Set secure cookie → Redirect to /dashboard
```

### Real-Time Sync (Cross-Tab & Cross-Device)

The app uses a **dual-channel** approach for real-time updates:

1. **BroadcastChannel API** (same browser) — When a bookmark is added/deleted in Tab A, a message is instantly broadcast to Tab B via the native browser BroadcastChannel API. This is zero-latency and works offline.

2. **Supabase Realtime** (cross-device) — The app subscribes to `postgres_changes` on the `bookmarks` table. When the database changes from any device, all connected clients receive the update via WebSocket.

Both mechanisms include deduplication to prevent duplicate entries.

### Route Protection

The Next.js middleware (`src/middleware.ts`) runs on every request:
- **Unauthenticated** users accessing `/dashboard` → redirected to `/login`
- **Authenticated** users accessing `/login` or `/` → redirected to `/dashboard`
- Session tokens are refreshed automatically on every request

### Row Level Security (RLS)

All data access is secured at the PostgreSQL level:

| Operation | Policy |
|---|---|
| `SELECT` | `auth.uid() = user_id` |
| `INSERT` | `auth.uid() = user_id` |
| `DELETE` | `auth.uid() = user_id` |

Even if a malicious user guesses a bookmark ID, the database returns 0 rows if they don't own it.

---

## 📜 Available Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start development server (Turbopack) |
| `npm run build` | Build for production |
| `npm run start` | Start production server |
| `npm run lint` | Run ESLint |

---

## 🌐 Deployment

The app is deployed on **Vercel** with automatic deployments from the GitHub repository.

### Vercel Setup

1. Import the repository into [Vercel](https://vercel.com/)
2. Framework preset: **Next.js** (auto-detected)
3. Add environment variables:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
4. Deploy

### Important Notes

- Add your Vercel deployment URL to the **Supabase Auth → URL Configuration → Redirect URLs**
- Update the **Google OAuth redirect URI** in Google Cloud Console to include the Vercel domain

---

## 🗃️ Database Schema

### `bookmarks` table

| Column | Type | Constraints |
|---|---|---|
| `id` | `UUID` | Primary Key, auto-generated |
| `user_id` | `UUID` | Foreign Key → `auth.users(id)`, NOT NULL, CASCADE delete |
| `title` | `TEXT` | NOT NULL |
| `url` | `TEXT` | NOT NULL |
| `created_at` | `TIMESTAMPTZ` | Default: `now()` |

### Indexes

- `idx_bookmarks_user_id` — speeds up per-user bookmark queries
- `idx_bookmarks_created_at` — speeds up chronological sorting

---

## 🔒 Security

- **No passwords stored** — authentication delegated to Google via OAuth 2.0
- **JWT verification** — all API requests include a Supabase JWT token
- **RLS enforced** — database rejects unauthorized access at the row level
- **URL validation** — inputs are validated to prevent `javascript:` XSS links
- **Secure cookies** — session managed via Supabase SSR helpers with HttpOnly cookies

---

## 📄 License

This project is open source and available under the [MIT License](LICENSE).
