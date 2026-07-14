# FULafia Central Administrative Appointment Booking Platform

A web-based appointment booking system designed specifically for the principal administrative offices (Vice Chancellor, Registrar, Bursar, Faculty Deans) of the **Federal University of Lafia (FULafia)**. 

This platform digitizes the traditional paper-based logbook scheduling, replacing physical wait lines with a real-time availability calendar, delegated administrative vetting for office Secretaries, and automated email simulation logs.

---

## Technical Stack

- **Frontend**: React (Vite) + Vanilla CSS (Light Mode, FULafia Brand Identity Theme) + Lucide Icons + client-side QR Code generator.
- **Backend**: Node.js + Express + RESTful API.
- **Database**: SQLite (via `sql.js` WebAssembly, making it completely independent of local C++ compilers or native OS dependencies).
- **Authentication**: JSON Web Token (JWT) with secure cookies + password hashing using `bcryptjs`.
- **Notifications**: Interactive in-app alerts + simulated email dispatch logs saved in the database.

---

## Setup & Running Locally

You can set up and run the application either automatically using the provided Windows batch files or manually via the terminal.

### Option A: Automatic Setup (Recommended for Windows)

1. **Setup dependencies & database**:
   Double-click the **`setup.bat`** file in the root directory (or run `setup.bat` in command prompt). 
   *This script automatically verifies Node.js presence, installs all root, frontend, and backend packages, and seeds the SQLite database.*

2. **Start the application**:
   Double-click the **`start.bat`** file in the root directory (or run `start.bat` in command prompt).
   *This checks that dependencies exist and starts both the Express API and Vite React server concurrently.*

---

### Option B: Manual Setup (Terminal / Linux / macOS)

1. **Install All Dependencies**:
   Open a terminal in the root project folder and run:
   ```bash
   npm run install:all
   ```
   *This command automatically runs npm install across the root, backend API, and React frontend.*

2. **Seed the Database**:
   Pre-populate the SQLite database with officials, secretaries, visitors, and sample appointments by running:
   ```bash
   npm run seed
   ```

3. **Start Development Servers**:
   Run the unified dev command to launch the backend (port `5000`) and the Vite-React frontend (port `5173` or fallback `5174`) concurrently:
   ```bash
   npm run dev
   ```

---

### Access Links
- **Frontend App**: [http://localhost:5173](http://localhost:5173) (or check Vite terminal output for fallback port, e.g. `5174`)
- **Backend Health Check**: [http://localhost:5000/health](http://localhost:5000/health)

---

---

## Demo & Defense Credentials

All seed accounts use the default password: **`password123`**

| Role | Email Address | Assigned Profile / Access Details |
| :--- | :--- | :--- |
| **System Admin** | `admin@fulafia.edu.ng` | System stats, official profile CRUD, secretary creation. |
| **Secretary (VC)** | `vc_sec@fulafia.edu.ng` | Manages appointments for **Prof. Shehu Abdul Rahman (VC)**. Includes approval actions, reschedule proposal, and QR check-in simulator. |
| **Secretary (Registrar)** | `reg_sec@fulafia.edu.ng` | Manages appointments for **Malam Nuradeen Abdu (Registrar)**. |
| **Secretary (Dean)** | `dean_sec@fulafia.edu.ng` | Manages appointments for **Prof. Shuaib Abdulsalam (Dean of Computing)**. |
| **Visitor (Student)** | `student@fulafia.edu.ng` | **Shuaib Abdulsalam** (Matric: `2021/CP/CSC/0033`). Accesses slot selector, cancel button, reschedule acceptor, and QR slip. |
| **Visitor (Staff)** | `staff@fulafia.edu.ng` | **Dr. Kabir Usman** (Staff ID: `FUL/ST/402`). |

---

## Key Features & Evaluation Scope

1. **Visitor Booking Flow**:
   - **Real-Time Slots Calculation**: Generates clean, available slots by inspecting existing bookings (prevents double-booking).
   - **Office Buffer Offsets**: Slots are padded by configurable buffer durations (0m, 5m, 10m, 15m, 20m) between meetings.
   - **Daily 1-Hour Rest Exclusions**: Automatically flags and hides slots overlapping with the official's configurable lunch break.
   - **Blackout Calendars**: Blocks slot generation on dates designated as blackout dates (e.g. Senate meetings) showing reasons to visitors.
   - **14-Day Limit**: Restricts bookings to the upcoming two-week period.
   - **Interactive Timeline**: Visitors can monitor request statuses, accept proposed reschedules, or download secure QR slips.
   - **Suspension Lock**: Temporarily suspends booking privileges if a visitor accumulates more than 2 past approved uncompleted visits (no-shows).

2. **Secretary Delegated Approval Dashboard**:
   - **Vetting Queues**: Tabbed inbox sorting pending, approved, and historic appointments.
   - **Reschedule proposals**: Secretary can propose an alternative date/time with a custom note.
   - **Settings Gear modal**: Configure the official's hours, buffer duration, rest times, and blackout calendar directly in-app.
   - **Offline Cryptographic Check-in**: Scans or verifies visitor QR tokens. Generating signatures using backend HMAC SHA-256 and checking them with timing-attack-safe comparisons (`crypto.timingSafeEqual`).

3. **Admin Controls & Reporting**:
   - **Wait-Time Analytics**: Tracks the Average Waiting Time (in minutes) from scheduled start times to actual check-in completions.
   - **Audit CSV Downloads**: Generates local, spreadsheet-ready CSV downloads of the complete appointments registry and email notification logs.
   - **Busiest Offices Leaderboard**: Renders top principal officers ranked by scheduling transaction volumes.
   - **Secretary Accounts Manager**: Interactive form to register new secretaries and link them to principal officer profiles.
   - **Officials Registrar**: Side-by-side dropdown grids to define official working hours and configurations.

4. **Real-time Push Alerts**:
   - **WebSocket Sync**: Emits backend messages to automatically refresh visitor schedules and secretary review lists on state updates.
   - **Floating Toaster Alerts**: Renders real-time sliding popups in the top right of the viewport on notification arrivals.
