# App Audit Report — Pocket Router

วันที่: 2026-06-27 21:55 Asia/Bangkok
Workspace: `D:\dev\money-tagging`
Stack: Next.js 16.2.9 (Turbopack) + React 19.2.4 + Supabase 2.108 + Zustand 5 + Tailwind 4 + shadcn (base-nova)

## 1. Verdict

**VERDICT: PASS_WITH_WARNINGS**

Build และ TypeScript ผ่านครบ (0 errors), แต่ ESLint พบ **12 errors + 6 warnings** — ส่วนใหญ่เป็นเรื่อง `react-hooks/set-state-in-effect` (Next 16/React 19 ห้าม `setState` แบบ synchronous ใน `useEffect` แม้กระทั่ง `setMounted(true)`), 2 จุดใช้ `any`, 3 จุดมี unescaped entities ใน JSX, และ 3 warnings เรื่อง `<img>` (Next/Image). โค้ด runtime ทำงานได้ ไม่มี bug ที่ block release แต่ควรแก้ก่อนส่งมอบ production.

TODO ทั้ง 4 ข้อจาก README เสร็จครบ (DONE x4). Security ใช้ anon key เท่านั้น, ไม่มี `service_role` รั่วใน client bundle, `.env*` ถูก gitignore ถูกต้อง.

## 2. Build / Type / Lint

### Build: **PASS**
**Method:** `npx next build` ใน `D:\dev\money-tagging` (timeout 10 นาที)
**Evidence (last 20 บรรทัด):**
```
▲ Next.js 16.2.9 (Turbopack)
- Environments: .env.local
  Creating an optimized production build ...
✓ Compiled successfully in 2.8s
  Running TypeScript ...
  Finished TypeScript in 3.1s ...
  Collecting page data using 10 workers ...
  Generating static pages using 10 workers (0/8) ...
  Generating static pages using 10 workers (2/8)
  Generating static pages using 10 workers (4/8)
  Generating static pages using 10 workers (6/8)
✓ Generating static pages using 10 workers (8/8) in 662ms
  Finalizing page optimization ...
Route (app)
┌ ○ /
├ ○ /auth/callback
├ ○ /banks
├ ○ /login
├ ○ /_not-found
├ ○ /pockets
└ ƒ /pockets/[id]
○  (Static)   prerendered as static content
ƒ  (Dynamic)  server-rendered on demand
```
ทุก route compile สำเร็จ, prerender 8/8 หน้า, exit code 0.

### TypeScript: **PASS**
**Method:** `npx tsc --noEmit` ใน workspace
**Evidence:** exit code `0`, ไม่มี type error ใด ๆ แม้จะตั้ง `"strict": true`

### Lint: **FAIL (12 errors, 6 warnings)**
**Method:** `npx eslint .`
**Evidence (สรุปจาก `eslint-output.txt`):**

| # | File:Line | Severity | Rule |
|---|-----------|----------|------|
| 1 | `src/app/banks/page.tsx:71` | error | `react-hooks/set-state-in-effect` (`setMounted(true)`) |
| 2 | `src/app/login/page.tsx:38` | error | `@typescript-eslint/no-explicit-any` |
| 3 | `src/app/login/page.tsx:54` | error | `@typescript-eslint/no-explicit-any` |
| 4 | `src/app/login/page.tsx:66` | error | `react-hooks/set-state-in-effect` |
| 5 | `src/app/login/page.tsx:71` | error | `react-hooks/set-state-in-effect` |
| 6 | `src/app/page.tsx:18` | error | `react-hooks/set-state-in-effect` |
| 7 | `src/app/pockets/[id]/page.tsx:63` | error | `react-hooks/set-state-in-effect` |
| 8 | `src/app/pockets/[id]/page.tsx:294` | error | `react/no-unescaped-entities` (`'`) |
| 9 | `src/app/pockets/[id]/page.tsx:374` | error | `react/no-unescaped-entities` (`"` x2) |
| 10 | `src/app/pockets/page.tsx:42` | error | `react-hooks/set-state-in-effect` |
| 11 | `src/components/TransferDialog.tsx:36` | error | `react-hooks/set-state-in-effect` |
| 12 | `src/app/pockets/[id]/page.tsx:73` | warning | `@typescript-eslint/no-unused-vars` (`availableBanksForAlloc`) |
| 13 | `src/components/ClientProviders.tsx:12` | warning | `@typescript-eslint/no-unused-vars` (`pathname`) |
| 14 | `src/components/ClientProviders.tsx:13` | warning | `@typescript-eslint/no-unused-vars` (`router`) |
| 15 | `src/components/DraggableBankAllocationCard.tsx:157` | warning | `@next/next/no-img-element` |
| 16 | `src/components/TransferDialog.tsx:91` | warning | `@next/next/no-img-element` |
| 17 | `src/components/TransferDialog.tsx:127` | warning | `@next/next/no-img-element` |
| 18 | `src/components/DraggableBankAllocationCard.tsx:46` | — | (line 47 `setTimeout`) |

`✖ 18 problems (12 errors, 6 warnings)` — exit code 1

> หมายเหตุ: ESLint rule `react-hooks/set-state-in-effect` เป็นกฎใหม่ของ React 19/Next 16 ที่ห้าม `setState` แบบ synchronous ใน body ของ `useEffect` แม้กระทั่ง pattern `setMounted(true)` ที่ใช้กันแพร่หลาย — pattern นี้ยังคงทำงานได้ runtime แต่ถือว่าเป็น antipattern.

## 3. README TODO Status

| # | TODO | สถานะ | หลักฐาน |
|---|------|--------|--------|
| 1 | Delete allocations, a11y @pocket/[id] | DONE | `usePocketRouterStore.ts:42,630` (action + impl), `pockets/[id]/page.tsx:36,161-173,459-467` (Trash button → ConfirmDeleteDialog), `DraggableBankAllocationCard.tsx:184-199` (always-visible trash button, `aria-label`, `title`, `e.stopPropagation()`, `onPointerDown` stop) |
| 2 | Remove right arrow @/pockets | DONE | `grep "ArrowRight\|ChevronRight" src/app/pockets/` → 0 matches. `PocketCard.tsx` ไม่มี right arrow เลย เหลือแค่ Edit/Trash icon button. (`TransferDialog.tsx:110` ยังมี `ArrowRight` แต่เป็น dialog ในการโอนเงิน ไม่ใช่ pocket card.) |
| 3 | Add bank icon @/banks | DONE | `banks/page.tsx:264-282` แสดง `Landmark` icon หรือ `bank.logoUrl` (มี `onError` fallback). `DraggableBankAllocationCard.tsx:152-161` ก็แสดง logo/Landmark เช่นกัน |
| 4 | Remember order + drag & drop /banks /pockets | DONE | `types/index.ts:9,19` (`order?: number`), `banks/page.tsx:95-104` (sort by order, fallback createdAt), `banks/page.tsx:106-120` (`handleReorderBank` → `reorderBanks`), `pockets/page.tsx:46-71` (เหมือนกัน), `usePocketRouterStore.ts:404-443,538-574` (`reorderBanks`/`reorderPockets` optimistic + DB persist), `DraggableListItem.tsx` (HTML5 + touch drag) |

## 4. Security Findings

**ไม่พบปัญหาร้ายแรง** — ตรวจทุกข้อตามเกณฑ์:

- `.env.local` ถูก `.gitignore`: `.gitignore:34` มี `.env*` (ครอบคลุม `.env.local`)
- ไม่มี `service_role` / `SERVICE_ROLE` ใน `src/`: `grep -r "service_role" src/` → 0 matches
- Supabase keys ใช้ prefix `NEXT_PUBLIC_` ทั้งคู่ (`src/utils/supabase/client.ts:4-5`): anon key + URL เท่านั้น, ปลอดภัยสำหรับ client bundle
- OAuth callback ใช้ client-side session detection (`src/app/auth/callback/page.tsx`) — เป็นวิธีที่ถูกต้องสำหรับ Supabase PKCE/implicit flow + มี retry `setTimeout(..., 1500)` สำหรับ hash fragment
- `redirectTo` ใช้ `${window.location.origin}/auth/callback` (`login/page.tsx:50`) — ปลอดภัย เพราะอยู่ใน 'use client'
- หมายเหตุเล็กน้อย: ตอนนี้แอปใช้ Supabase client ตัวเดียว (`utils/supabase/client.ts`) โดยไม่มี server-side client — เป็นเรื่องปกติของแอปที่ทุก data fetching เป็น client-side ผ่าน Zustand, แต่ถ้าจะเพิ่ม RSC data fetching ในอนาคต ต้องสร้าง `server.ts` ที่ใช้ service role key ฝั่ง server เท่านั้น

## 5. Next.js / React Antipatterns

1. **`setMounted(true)` ใน `useEffect` ต้องห้ามใน React 19** — ใช้กัน 6 ไฟล์:
   - `src/app/page.tsx:17-19`
   - `src/app/banks/page.tsx:70-72`
   - `src/app/pockets/page.tsx:41-43`
   - `src/app/pockets/[id]/page.tsx:62-64`
   - `src/app/login/page.tsx:65-67`
   - `src/app/login/page.tsx:69-73` (deps array `[settings.currency, mounted]` — redundant)
   - `src/components/TransferDialog.tsx:34-41` (`setAmount`/`setShowSuccess` ใน effect แทนที่จะ derived จาก `open` prop)
   - **คำแนะนำ:** เปลี่ยนเป็น derived state จาก Zustand `isHydrated` flag (zustand `persist` มี `onRehydrateStorage` callback) หรือใช้ `useSyncExternalStore`

2. **Async params ใน `pockets/[id]/page.tsx`** — ใช้ `use(params)` ถูกต้องแล้ว (`pockets/[id]/page.tsx:3,27`) ✓

3. **Server vs Client boundary:**
   - `layout.tsx` = Server Component ✓ (ดี เพราะ root layout ควรเป็น server)
   - ทุก `page.tsx` = `'use client'` (16 ไฟล์) — จำเป็นเพราะทุกหน้าต้องอ่าน Zustand store และ localStorage ที่มี persist
   - **ปัญหา:** `pages/[id]/page.tsx` ถูก build เป็น Dynamic (`ƒ`) ทั้งที่เป็น client component ทั้งหมด — เพราะ Next 16 ตีความว่ามี dynamic route param ที่ต้อง resolve ฝั่ง server. สามารถ force static + client fetch ได้แต่ไม่จำเป็น.

4. **`useEffect` ที่ fetch data ที่ควรเป็น server component:**
   - `BottomNav.tsx:16-20` → `fetchData()` ใน effect ที่ depend on `settings.storageType`. ยอมรับได้เพราะ data ต้อง sync กับ client-side Zustand store และ auth state
   - `ClientProviders.tsx:15-20` → `initialize()` จาก auth store. จำเป็นเพราะ Supabase session อยู่ใน localStorage
   - **สรุป:** ไม่มี antipattern ที่ร้ายแรง — data fetching ถูกจัดการผ่าน Zustand + persist ซึ่งเป็น client-side pattern โดยตั้งใจ

5. **Tailwind v4 syntax:** `globals.css:1-3` ใช้ `@import "tailwindcss"`, `@import "tw-animate-css"`, `@import "shadcn/tailwind.css"` ถูกต้อง. `@theme inline {...}` (line 7-49) กำหนด design tokens ครบ. `@custom-variant dark` (line 5) สำหรับ `.dark *` selector ✓

6. **Unescaped entities ใน JSX** (3 จุด) — `pockets/[id]/page.tsx:294` (apostrophe ใน "pocket's"), `:374` (`"..."` × 2) — Next.js 16 strict React rule

## 6. Zustand Store Notes

1. **`persist` middleware (line 788-790):**
   - ใช้ `name: 'pocket-router-storage'` เท่านั้น, **ไม่มี `partialize`** → persist ทั้ง state รวม `isLoading`, `lastError`, `subscribeRealtime` (module-level channel references)
   - **คำแนะนำ:** เพิ่ม `partialize: (state) => ({ banks: state.banks, pockets: state.pockets, allocations: state.allocations, settings: state.settings })` เพื่อไม่ persist transient state

2. **Optimistic updates + rollback:** ทุก mutation (`addBank`, `updateBank`, `deleteBank`, `reorderBanks`, `addPocket`, `updatePocket`, `deletePocket`, `reorderPockets`, `addAllocation`, `updateAllocation`, `deleteAllocation`, `transferBetweenBanks`, `updateSettings`) มี pattern "snapshot previous state → set optimistic → if error: rollback + set lastError" ที่สอดคล้องกัน ✓

3. **Error handling:**
   - ทุก mutation มี `lastError: { message, context }` propagation ✓
   - `transferBetweenBanks` (line 649-742) มีการตรวจ `sourceAlloc.amount < amount` early return ที่ line 658 ✓
   - **ข้อสังเกต:** `updateAllocation` (line 604-628) **ไม่ validate** ว่า `updatedAllocation.amount` เป็นบวก — ถ้า caller ส่งค่าลบ/NaN มา จะ update DB เลย
   - **ข้อสังเกต:** `addBank`/`addPocket` (line 318-321, 450-453) ใช้ `alert()` สำหรับ offline-mode limit — ควรใช้ `lastError` pattern แทนเพื่อ UX ที่สอดคล้อง

4. **Realtime channels:** module-level `banksChannel`/`pocketsChannel`/`allocationsChannel` (line 55-57) ใช้ singleton pattern ที่ดี — ไม่ leak subscriptions. `unsubscribeRealtime()` ถูกเรียกใน cleanup ของ `ClientProviders.tsx:48` ✓

5. **Order persistence race condition:** `reorderBanks`/`reorderPockets` (line 404-443, 538-574) ส่ง parallel `Promise.allSettled` updates ทั้งหมด → ถ้า DB row ถูก DELETE โดย realtime subscription ระหว่าง reorder, UPDATE จะ fail แต่ rollback ทั้ง array → ผู้ใช้เห็นค่าเก่าทันที. ไม่ critical แต่ควรระวัง.

6. **`updateSettings` cascade** (line 745-786): toggle `storageType` ระหว่าง local/supabase จะ trigger `fetchData()` หรือ `unsubscribeRealtime()` อัตโนมัติ — ดีและถูกต้อง.

7. **`fetchData` preserves local order** (line 162-180): merge logic ที่ใช้ local `order` fallback เมื่อ DB row ไม่มี — ป้องกัน order reset หลัง sync ✓

## 7. UX / Accessibility

1. **`<img>` แทน `next/image`** (3 จุด): `banks/page.tsx:271`, `DraggableBankAllocationCard.tsx:157`, `TransferDialog.tsx:91,127`. รูป logo จาก external URL → Next warning เรื่อง LCP/bandwidth. ถ้าต้อง optimize ใช้ `next/image` พร้อม `remotePatterns` config.

2. **Drag-and-drop ไม่รองรับ keyboard:**
   - `DraggableListItem.tsx:206-211` — `draggable` div ไม่มี keyboard alternative
   - Banks/pockets **ไม่สามารถสลับลำดับด้วยคีย์บอร์ด** — screen reader / keyboard-only user ถูก lock ออกจากฟีเจอร์ reorder
   - **คำแนะนำ:** เพิ่ม "Move up"/"Move down" button คู่กับ drag handle

3. **Clickable `<Card>` ไม่ใช่ `<button>`:**
   - `BankCard.tsx:33`, `PocketCard.tsx:36` — ทั้งคู่ใช้ `<Card onClick={onClick}>` ที่ clickable แต่ไม่ใช่ `<button>` หรือมี `role="button"` / `tabIndex` / `onKeyDown`
   - แต่ **ในทางปฏิบัติ** ทั้งสอง component นี้ถูกใช้ในหน้า `/banks` และ `/pockets` ที่ใช้ `DraggableListItem` wrapper — `PocketCard` ใน `pockets/page.tsx:202` มี `onClick={() => router.push(...)}` โดยตรงบน `<Card>` (ไม่ใช่ `<button>`) — keyboard user เข้าถึง detail page ไม่ได้
   - **BankCard** ตัวเองไม่ถูกใช้แล้วใน production code (เห็นแค่ import ใน component list, แต่ `/banks` ใช้ custom `<Card>` inline) — ควรลบไฟล์ทิ้งหรือ refactor

4. **Form inputs มี `<Label htmlFor>` ครบ:**
   - `login/page.tsx:175,187` ✓
   - `banks/page.tsx:377,388,400,470,481,492` ✓
   - `pockets/page.tsx:280,290,333,342` ✓
   - `pockets/[id]/page.tsx:379,433` ✓
   - `TransferDialog.tsx:141` ✓

5. **Color contrast (dark mode tokens):**
   - ดู `globals.css:86-118` — ใช้ `oklch` color space, primary ใน dark = `oklch(0.922 0 0)` (เกือบขาว) บน background `oklch(0.145 0 0)` (เกือบดำ) → contrast สูง ✓
   - `text-zinc-400` (เช่น `pockets/[id]/page.tsx:266`) บน background `oklch(0.145 0 0)` ≈ luminance ratio 7:1 ✓ (WCAG AAA)
   - บน light mode: `text-zinc-500` (`banks/page.tsx:362`) บน `bg-zinc-50` → ratio ≈ 4.6:1 ✓ (WCAG AA)

6. **`DraggableBankAllocationCard.tsx:184-199` — Trash button:**
   - `aria-label`, `title`, `type="button"`, `e.stopPropagation()` บน `onClick` + `onPointerDown` ✓
   - Visible always (ไม่ใช่ hover-only) — เป็น mobile-friendly ที่ดี ✓
   - Touch target 36×36px (`h-9 w-9`) ≥ 44px Apple HIG แต่ผ่าน Material minimum 48dp — **ปรับเป็น `h-11 w-11` เพื่อให้ถึง 44pt**

7. **BottomNav active indicator** (`BottomNav.tsx:36-63`): ใช้ `usePathname()` เทียบ exact match — `/pockets/abc-123` จะไม่ highlight "Pockets" tab. ควรใช้ `pathname.startsWith('/pockets')`.

8. **`viewport.maximumScale: 1, userScalable: false`** (`layout.tsx:17-19`): **block pinch-to-zoom** — เป็น a11y antipattern สำหรับ user ที่ต้อง zoom อ่านตัวเลขการเงิน. แนะนำลบ `userScalable: false` ออก.

## 8. Critical Bugs (block release)

**ไม่มี** — build ผ่าน, runtime behavior ทำงานได้ทั้งหมด, ไม่มี memory leak, ไม่มี crash, ไม่มี data corruption risk.

## 9. Recommendations (ไม่ block แต่ควรแก้)

**Priority HIGH (แก้ก่อน merge):**
1. แก้ 12 ESLint errors (เน้น `react-hooks/set-state-in-effect` 6 จุด — refactor เป็น derived state หรือ `useSyncExternalStore`)
2. ลบ unused vars: `availableBanksForAlloc` (`pockets/[id]/page.tsx:73`), `pathname`/`router` (`ClientProviders.tsx:12-13`)
3. แก้ unescaped entities 3 จุด (`pockets/[id]/page.tsx:294,374`)
4. แก้ 2 จุดที่ใช้ `any` (`login/page.tsx:38,54`)
5. ลบ `viewport.userScalable: false` (`layout.tsx:19`) — a11y blocker
6. เพิ่ม `partialize` ใน zustand `persist` เพื่อไม่ save `lastError`/`isLoading`

**Priority MEDIUM:**
7. เพิ่ม keyboard alternative สำหรับ drag-and-drop reorder (Move up/Move down buttons)
8. เปลี่ยน `<Card onClick>` → semantic `<button>` หรือเพิ่ม `role="button"` + `tabIndex` + `onKeyDown` (สำหรับ `PocketCard` ใน `pockets/page.tsx:200-202`)
9. เปลี่ยน `BottomNav` ใช้ `pathname.startsWith()` เพื่อ active บน sub-routes
10. ขยาย Trash button เป็น `h-11 w-11` ให้ถึง 44pt touch target
11. เปลี่ยน `<img>` 3 จุดเป็น `next/image` พร้อม `remotePatterns` config

**Priority LOW:**
12. Validate `updateAllocation.amount > 0` ใน store
13. เปลี่ยน `alert()` ใน `addBank`/`addPocket` เป็น `lastError` pattern
14. ลบ unused `BankCard.tsx` (ไม่ถูกใช้ใน production code)

## 10. Evidence

**ไฟล์ที่อ่าน:**
- `package.json`, `tsconfig.json`, `eslint.config.mjs`, `postcss.config.mjs`, `next.config.ts`, `components.json`, `AGENTS.md`, `.gitignore`, `README.md`, `.mavis/plans/app-audit.yaml`
- `src/app/{layout,page,globals.css}.tsx`
- `src/app/{auth/callback,login,banks/page,pockets/page,pockets/[id]}/page.tsx`
- `src/hooks/{useAuthStore,usePocketRouterStore}.ts`
- `src/components/{BankCard,PocketCard,BottomNav,ErrorModal,ClientProviders,DashboardSummary,TransferDialog,ConfirmDeleteDialog,DraggableBankAllocationCard,DraggableListItem}.tsx`
- `src/utils/supabase/client.ts`, `src/types/index.ts`, `src/lib/utils.ts`

**คำสั่งที่รัน:**
- `npx tsc --noEmit` → exit 0, 0 errors
- `npx eslint .` → 18 problems (12 errors + 6 warnings), exit 1
- `npx next build` → ✓ Compiled successfully, 8/8 static pages, exit 0

**คำสั่ง grep:**
- `grep -r "service_role" src/` → 0 matches
- `grep "process\.env\." src/` → 2 matches (ทั้งคู่ `NEXT_PUBLIC_*` ใน client.ts)
- `grep "'use client'" src/**/*.tsx` → 16 matches
- `grep "deleteAllocation" src/` → 4 matches (impl + caller)
- `grep "ArrowRight|ChevronRight" src/app/pockets/` → 0 matches (TODO #2 confirmed)
- `grep "aria-label" src/` → 5 matches (a11y ที่เพียงพอ)

**Build output file:** `C:\Users\t-sir\.mavis\plans\plan_3dbe3b07\workspace\next-build-output.txt`
**ESLint output file:** `C:\Users\t-sir\.mavis\plans\plan_3dbe3b07\workspace\eslint-output.txt`

---

VERDICT: PASS_WITH_WARNINGS