# 🐛 Problems Encountered & Solutions

This document chronicles the technical problems encountered while building the Smart Bookmark App and the solutions applied to resolve each one.

---

## Problem 1: Project Scaffolding — npm Naming Restrictions

### ❌ The Problem

When running `create-next-app` inside the workspace folder, the command failed with:

```
Could not create a project called "Smart Book App" because of npm naming restrictions:
  * name can only contain URL-friendly characters
  * name can no longer contain capital letters
```

The workspace directory was named `Smart Book App`, which contains **spaces** and **capital letters** — both of which violate npm's package naming rules. `create-next-app` tries to derive the package name from the directory name, causing the failure.

### ✅ The Solution

Instead of renaming the workspace folder (which would break the user's existing setup), we worked around it by:

1. **Scaffolding into a subfolder** with a valid name:
   ```bash
   npx -y create-next-app@latest smart-bookmark-app --ts --tailwind --app --use-npm --yes
   ```
2. **Copying all files** from the subfolder to the workspace root:
   ```powershell
   Copy-Item -Path "smart-bookmark-app\*" -Destination ".\" -Recurse -Force
   ```
3. **Cleaning up** the temporary subfolder:
   ```powershell
   Remove-Item -Path "smart-bookmark-app" -Recurse -Force
   ```

This preserved the original workspace path while getting a properly initialized Next.js project.

### 💡 Key Takeaway

Always ensure your project directory name is lowercase, contains no spaces, and uses only URL-safe characters (`a-z`, `0-9`, `-`, `_`) before running `create-next-app`. Alternatively, use the `--` flag or scaffold elsewhere and move files.

---

## Problem 2: Real-Time Sync Not Working Across Browser Tabs

### ❌ The Problem

The TDD required that bookmark changes in one browser tab should instantly appear in another open tab — a core real-time synchronization feature. The initial implementation used **Supabase Realtime** with `postgres_changes` subscriptions:

```typescript
const channel = supabase
  .channel("bookmarks-realtime")
  .on("postgres_changes", {
    event: "INSERT",
    schema: "public",
    table: "bookmarks",
  }, (payload) => {
    setBookmarks((prev) => [payload.new as Bookmark, ...prev]);
  })
  .subscribe();
```

However, when testing with two side-by-side tabs:
- **Tab A** (where the action happened): Bookmark appeared ✅
- **Tab B** (the other tab): Bookmark did **NOT** appear until a manual page reload ❌

### 🔍 Root Cause Analysis

Supabase Realtime's `postgres_changes` relies on several conditions being met simultaneously:

1. **Publication setup**: `ALTER PUBLICATION supabase_realtime ADD TABLE bookmarks` ✅ (was in migration)
2. **RLS authorization**: The WebSocket connection must carry a valid auth token for RLS policies to allow the event through. This can silently fail if the Supabase client's auth context isn't properly established on the Realtime connection.
3. **Replica Identity**: For `DELETE` events, the table needs `REPLICA IDENTITY FULL` to include the old row data in the payload. Without it, `payload.old` is empty, and filtering by `payload.old.id` fails silently.

The likely culprits were **RLS authorization on the WebSocket** and/or **Realtime configuration not fully propagated** — both of which are outside the application's control and depend on Supabase project settings.

### ✅ The Solution

Implemented a **dual-channel sync** approach:

#### Channel 1: BroadcastChannel API (same-browser, instant)

The [BroadcastChannel API](https://developer.mozilla.org/en-US/docs/Web/API/BroadcastChannel) is a native browser API that allows tabs on the same origin to communicate directly — no server needed.

```typescript
// Setup
const bc = new BroadcastChannel("smart-bookmark-sync");

// Sending (in the tab that adds/deletes)
broadcastChannel.current?.postMessage({
  type: "BOOKMARK_ADDED",
  bookmark: newBookmark,
});

// Receiving (in all other tabs)
bc.onmessage = (event) => {
  if (event.data.type === "BOOKMARK_ADDED") {
    setBookmarks((prev) => [event.data.bookmark, ...prev]);
  }
};
```

#### Channel 2: Supabase Realtime (cross-device, kept as secondary)

The existing `postgres_changes` subscription was retained for cross-device synchronization (different browsers, different machines).

#### Deduplication

Both mechanisms could fire for the same event (e.g., the local optimistic update + BroadcastChannel + Supabase Realtime), so deduplication was added:

```typescript
setBookmarks((prev) => {
  const exists = prev.some((b) => b.id === newBookmark.id);
  if (exists) return prev; // Skip duplicate
  return [newBookmark, ...prev];
});
```

### 💡 Key Takeaway

Don't rely solely on Supabase Realtime for same-browser cross-tab sync. The BroadcastChannel API is:
- **Zero-latency** (no server round-trip)
- **Always available** (no auth/config dependencies)
- **Lightweight** (native browser API, no library needed)
- **Reliable** (works even if the Supabase Realtime connection drops)

Use Supabase Realtime as a complement for **cross-device** scenarios.

---

## Problem 3: `useSearchParams()` Causing Build Error Without Suspense

### ❌ The Problem

The login page used `useSearchParams()` to check for an `?error=auth` query parameter (set when OAuth fails). In Next.js App Router, `useSearchParams()` in a client component causes the entire page to opt out of static rendering, and Next.js requires it to be wrapped in a `<Suspense>` boundary:

```
Error: useSearchParams() should be wrapped in a suspense boundary at page "/login"
```

### ✅ The Solution

Split the login page into two components:

```tsx
// Inner component that uses useSearchParams
function LoginContent() {
  const searchParams = useSearchParams();
  const error = searchParams.get("error");
  // ... rest of the login UI
}

// Outer component with Suspense boundary
export default function LoginPage() {
  return (
    <Suspense fallback={<LoadingSkeleton />}>
      <LoginContent />
    </Suspense>
  );
}
```

This allows Next.js to statically render the shell while the search params are resolved client-side.

### 💡 Key Takeaway

In Next.js App Router, always wrap `useSearchParams()` in a `<Suspense>` boundary. This is a framework requirement, not optional — it enables streaming SSR and prevents full-page client rendering.

---

## Problem 4: Optimistic State Updates Causing Duplicate Bookmarks

### ❌ The Problem

The initial `handleAddBookmark` function added the new bookmark to local state immediately after a successful insert:

```typescript
const { data } = await supabase.from("bookmarks").insert({...}).select().single();
setBookmarks((prev) => [data, ...prev]); // Optimistic update
```

But the Supabase Realtime subscription also fires an `INSERT` event for the same bookmark, causing it to appear **twice** in the list.

### ✅ The Solution

Added an existence check in every place that adds a bookmark to state — the optimistic update, the BroadcastChannel listener, and the Realtime listener:

```typescript
setBookmarks((prev) => {
  const exists = prev.some((b) => b.id === newBookmark.id);
  if (exists) return prev; // Already in the list, skip
  return [newBookmark, ...prev];
});
```

This idempotent pattern ensures that regardless of how many sync mechanisms fire (optimistic + BroadcastChannel + Realtime), each bookmark only appears once.

### 💡 Key Takeaway

When combining optimistic UI updates with realtime subscriptions, **always deduplicate by ID**. Multiple event sources will inevitably deliver the same data, and your state update logic must be idempotent.

---

## Problem 5: Supabase Client Re-creation on Re-renders

### ❌ The Problem

The initial implementation created the Supabase client directly in the component body:

```typescript
const supabase = createClient(); // Called on every render!
```

While `createBrowserClient` from `@supabase/ssr` implements a singleton pattern internally, relying on this is fragile. More critically, if the client reference changes between renders, the `useEffect` for the Realtime subscription would tear down and re-create the WebSocket channel on every render — causing flickering and potential connection issues.

### ✅ The Solution

Wrapped the client creation in `useState` to guarantee a stable reference:

```typescript
const [supabase] = useState(() => createClient());
```

The lazy initializer `() => createClient()` runs only once during the initial render, and the state value never changes — making it a stable reference for `useEffect` dependency arrays.

### 💡 Key Takeaway

In React, use `useState` with a lazy initializer or `useRef` to create singleton instances (API clients, WebSocket connections, etc.) that should persist across re-renders without triggering effect re-runs.

---

## Summary

| # | Problem | Solution | Category |
|---|---|---|---|
| 1 | npm naming restrictions on `create-next-app` | Scaffold in subfolder, move files | Setup |
| 2 | Realtime sync not working across tabs | Added BroadcastChannel API as primary cross-tab sync | Feature |
| 3 | `useSearchParams()` build error | Wrapped in `<Suspense>` boundary | Next.js |
| 4 | Duplicate bookmarks from multiple sync sources | Idempotent state updates with ID deduplication | State |
| 5 | Supabase client re-created on re-renders | Stable reference via `useState` initializer | React |
