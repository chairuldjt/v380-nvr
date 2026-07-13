# Handoff: V380 NVR Live View UI/UX & PTZ Fixes

## Session Metadata
- Created: 2026-07-13 22:30:29
- Project: e:\project\web\home-server
- Branch: master
- Session duration: 1.5 hours

## Handoff Chain

- **Continues from**: [2026-07-13-203243-v380-nvr-base-implementation.md](./2026-07-13-203243-v380-nvr-base-implementation.md)
  - Previous title: V380 NVR Base Implementation
- **Supersedes**: None

> Review the previous handoff for full context before filling this one.

## Current State Summary

Completed a massive overhaul of the Live View page UI and backend PTZ functionality. 
The backend V380Decoder REST API bindings have been properly hooked up using `POST /api/ptz/<action>`. On the frontend, implemented automatic saving of Grid Layouts to the database (UserPreferences), added a dynamic theme switcher (next-themes) in the top header, fully working Grid Lock/Unlock, native fullscreen mode, and made the layout highly responsive/compact for Mobile.

## Codebase Understanding

### Architecture Overview

- **Frontend (Next.js + Tailwind + Shadcn UI):** Uses local state + `localStorage` token for auth. `page.tsx` heavily relies on `lucide-react` icons and Shadcn UI primitives (`Card`, `Button`, `Tabs`).
- **Backend (Express + Prisma + Node.js):** REST API runs on port 4000. `v380-wrapper.ts` manages ChildProcess execution of the native binary V380Decoder and forwards REST PTZ HTTP calls directly to the binary's internal API (`http://127.0.0.1:<camera.httpPort>/api/ptz/<cmd>`).

### Critical Files

| File | Purpose | Relevance |
|------|---------|-----------|
| `backend/src/services/v380-wrapper.ts` | V380 Binary orchestration and PTZ | Contains the native process lifecycle and direct HTTP REST calls to the binary decoder's API for PTZ movements |
| `frontend/src/app/(dashboard)/live/page.tsx` | Main Live View Grid | Contains the complex drag-and-drop, tap-to-assign, Grid sizing state (1, 2, 4, 9, 16), polling logic for camera status, and layout auto-save logic. |
| `backend/src/routes/api.ts` | API Endpoints | Registers all routes including new `/preferences/live-layout` and `/cameras/:id/ptz` |
| `frontend/src/lib/api.ts` | Frontend API client | Wrapper around native `fetch` handling JWT insertion and error handling (401 redirects). |

### Key Patterns Discovered

- The V380Decoder binary expects PTZ commands via `POST /api/ptz/<up|down|left|right>` (lowercase), not query string parameters.
- Shadcn UI's `Card` component defaults to `flex-col` + `overflow-hidden`. This often breaks horizontal toolbars if not overridden specifically with `flex-row`.
- Fast Refresh cache for turbopack requires aggressive clearing (`rm -rf .next` and manual hard refreshes) when deep nested SVG Icon imports (`lucide-react`) are changed.

## Work Completed

### Tasks Finished

- [x] Fix MJPEG stream failing to load in `LivePlayer` by dynamically using `window.location.hostname`.
- [x] Implement backend Database mapping for `UserPreference` to save live grid layout setups.
- [x] Fix Backend PTZ commands routing to the `v380-wrapper.ts` and verify actual HTTP calls.
- [x] Rebuild Desktop/Mobile UI: Add 2-camera split mode, Lock/Unlock toggles, "Tap to Assign" camera for mobile.
- [x] Clean up toolbar UI: Remove yellow borders, replace with neutral white/zinc borders.
- [x] Move ThemeSwitcher (next-themes) to top header bar.
- [x] Optimize `/playback` menu for mobile: added a collapsible Sheet containing date picker and camera selection on small screens (`lg:hidden`) and responsive video player control buttons (`flex-wrap`).
- [x] Clean up and optimize `/config` (Device list) page for mobile: fixed React hook render rules (`CameraFormFields` inline variable + `useCallback`), created mobile-friendly card layout for small screens (`md:hidden`), and cleaned up TypeScript warnings.
- [x] Fixed root URL (`/`) routing logic to auto-redirect to `/live` instead of showing Next.js default page.
- [x] Fixed hydration error on `/playback` caused by `@base-ui` `<SheetTrigger>` by swapping `asChild` prop to `render`.
- [x] Connected actual API responses to `/playback` page (rendering true time blocks dynamically, hooking FFMPEG dummy files with `<video>` reference and syncing `timeProgress` state with slider).
- [x] Created `SystemConfig` table in Prisma schema and generated its REST APIs for storing Recording Retention Policy, Auto-Delete flags, and Max Storage logic.
- [x] Created Users CRUD REST API endpoints (`/api/users`).
- [x] Implemented `/settings/storage` page with Shadcn UI to handle NVR global configs (auto-delete switches, retention days slider).
- [x] Implemented `/settings/users` page with Shadcn UI (Card & Table hybrids for mobile-first layout) for Admin to manage Operator accounts, reset passwords, and assign roles.

### Files Modified

| File | Changes | Rationale |
|------|---------|-----------|
| `backend/prisma/schema.prisma` | Added `UserPreference` relation | To save grid layouts per user. |
| `backend/src/services/v380-wrapper.ts` | Fixed `sendPtzCommand` | Mapped to correct V380 Decoder HTTP API paths. |
| `frontend/src/app/(dashboard)/live/page.tsx` | UI Overhaul | Added lock, grid 2, theme switcher, fullscreen support, and mobile panel collapse. |
| `frontend/src/components/camera/LivePlayer.tsx`| Changed `backendHost` & `Badge` logic | Avoid mixed content/localhost hardcoding issues on LAN access. |
| `frontend/src/app/(dashboard)/playback/page.tsx` | Mobile Sheet & Responsive Toolbar | Added `Sheet` drawer for mobile devices to allow picking dates and selecting cameras without cluttering/hiding search controls. |
| `frontend/src/app/(dashboard)/config/page.tsx` | Mobile Grid Cards & Hooks Fix | Replaced wide desktop `<Table>` with stackable `<Card>` grid for `md:hidden`, fixed `CameraFormFields` hook violation (`Cannot create components during render`), and cleaned up types. |

### Decisions Made

| Decision | Options Considered | Rationale |
|----------|-------------------|-----------|
| Auto-saving grid layouts | LocalStorage vs Database | Chose Database (`UserPreference`) so the grid layout roams with the user's account across different devices/PCs. |
| Mobile Assignment | Drag & Drop Polyfill vs Tap-to-assign | Native HTML5 Drag and Drop doesn't work on mobile browsers. Tap-to-assign is much simpler and more intuitive for touch screens. |
| PTZ API Method | ONVIF SOAP vs Native Web API | Used the Native Web API (`/api/ptz`) built into the decoder binary for faster response without heavy XML parsing. |

## Pending Work

## Immediate Next Steps

1. Setup error handling bounds / graceful disconnects if the V380 binary crashes unexpectedly in production.
2. Conduct end-to-end testing of the complete V380 Decoder lifecycle flow.

## Important Context

If the frontend layout looks weird or icons are missing after applying changes, **always delete the `.next` folder in frontend and restart the `npm run dev` server**. Turbopack caches SVG and DOM structures aggressively in Next.js 16.
When modifying the backend express routes, make sure the `ts-node` or `tsx` backend server process is actually killed and restarted, as `nodemon` sometimes fails to clear port 4000. Use `restart.bat` (Windows) or `restart.sh` (Linux) available in the root project folder.

### Assumptions Made

- Assuming all V380 cameras used support PTZ. Non-PTZ cameras will silently ignore the HTTP command.
- Assuming the end-user accesses the frontend on Port 3000 and backend API is on Port 4000.

### Potential Gotchas

- Calling the V380Decoder REST API for PTZ with uppercase commands (e.g., `UP`) fails; it expects lowercase (`up`, `down`).
- `LivePlayer.tsx` requires exactly 3.5 seconds (`setTimeout`) after calling "Start Decoder" before trying to refresh the MJPEG Image tag to give the binary time to spin up the local server.
- The base-ui v1 components (like `DialogTrigger`, `SheetTrigger`, `AlertDialogTrigger`) used in this project's shadcn wrapper require the `render={<Button>...</Button>}` prop instead of `asChild={true}`. Using `asChild` will cause hydration errors and `<button> inside <button>` DOM nesting violations.

## Environment State

### Tools/Services Used

- `tsx` for running Express backend.
- `next 16.2.10` with Turbopack for frontend.
- SQLite for Prisma Database (`dev.db`).

### Active Processes

- Run `restart.bat` / `restart.sh` in project root to start both backend & frontend.

### Environment Variables

- `JWT_SECRET`
- `NEXT_PUBLIC_API_URL`

## Related Resources

- V380 Decoder CLI Docs: https://github.com/PyanSofyan/V380Decoder/blob/main/README.md

---

**Security Reminder**: Before finalizing, run `validate_handoff.py` to check for accidental secret exposure.
