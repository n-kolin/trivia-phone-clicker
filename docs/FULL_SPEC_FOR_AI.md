# FULL BUILD SPECIFICATION — Phone Trivia System
# (For an AI starting from zero — describes everything that must be built)

---

## 1. WHAT YOU ARE BUILDING

A real-time trivia quiz system with three actors:
- **Admin** — creates quizzes, manages questions and participants, controls the game via a web dashboard
- **Participants** — join by calling a phone number and pressing 1–4 on their keypad to answer
- **Display screen** — a public screen projected on a wall showing questions, timer, live answerer names, and leaderboard

Everything is real-time via WebSockets (Socket.io).

---

## 2. TECH STACK

| Layer | Technology |
|-------|-----------|
| Frontend | React 18 + TypeScript, React Router v6 |
| Backend | Node.js + Express + TypeScript |
| Database | PostgreSQL |
| Real-time | Socket.io |
| Auth | JWT stored in localStorage |
| Shared types | Monorepo package `@trivia/shared` at `/shared/src/index.ts` |
| State | In-memory Maps (NO Redis) |
| Hosting | Railway |


---

## 3. PROJECT FOLDER STRUCTURE

```
/
├── client/                        # React app (CRA + TypeScript)
│   ├── public/index.html
│   ├── .env                       # REACT_APP_API_URL, REACT_APP_PHONE_NUMBER
│   └── src/
│       ├── App.tsx                # Router setup
│       ├── api.ts                 # Axios instance with JWT header
│       └── pages/
│           ├── LoginPage.tsx
│           ├── RegisterPage.tsx
│           ├── QuizzesPage.tsx
│           ├── QuizEditPage.tsx
│           ├── LobbyPage.tsx
│           ├── DashboardPage.tsx
│           ├── DisplayPage.tsx
│           └── ReportsPage.tsx
├── server/
│   └── src/
│       ├── index.ts               # Express + Socket.io setup
│       ├── config.ts              # env vars
│       ├── db/
│       │   ├── db.ts              # pg Pool
│       │   └── sessionStore.ts    # in-memory phone sessions
│       ├── middleware/
│       │   └── authMiddleware.ts  # JWT verify
│       ├── repositories/
│       │   ├── quizRepository.ts
│       │   └── questionRepository.ts
│       ├── routes/
│       │   ├── authRoutes.ts
│       │   ├── quizRoutes.ts
│       │   ├── questionRoutes.ts
│       │   ├── participantRoutes.ts
│       │   ├── reportRoutes.ts
│       │   └── webhookHandler.ts  # telephony webhooks
│       └── services/
│           ├── quizManager.ts     # core game logic + in-memory state
│           ├── sessionManager.ts
│           ├── authService.ts
│           └── reportService.ts
└── shared/
    └── src/
        └── index.ts               # all shared TypeScript interfaces
```

---

## 4. DATABASE SCHEMA (PostgreSQL — create all tables)

```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username VARCHAR(100) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_login_at TIMESTAMPTZ
);

CREATE TABLE questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  text TEXT NOT NULL,
  options JSONB NOT NULL,        -- [{"digit":1,"text":"..."},...]
  correct_answer INT NOT NULL,   -- 1-4 (0 for survey type)
  type VARCHAR(20) DEFAULT 'regular', -- 'regular'|'bonus'|'survey'|'scratch'
  difficulty INT DEFAULT 1,      -- 1=easy, 2=medium, 3=hard
  image_url TEXT,                -- optional image
  language VARCHAR(10) DEFAULT 'he',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE quizzes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  status VARCHAR(20) DEFAULT 'draft',  -- 'draft'|'active'|'ended'
  settings JSONB DEFAULT '{}',         -- timer, leaderboard_freq, smart_scoring, etc.
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE quiz_questions (
  quiz_id UUID REFERENCES quizzes(id) ON DELETE CASCADE,
  question_id UUID REFERENCES questions(id),
  order_index INT NOT NULL,
  PRIMARY KEY (quiz_id, question_id)
);

CREATE TABLE participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id UUID REFERENCES quizzes(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  phone VARCHAR(50) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE participant_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_id UUID REFERENCES participants(id) ON DELETE CASCADE,
  quiz_id UUID REFERENCES quizzes(id) ON DELETE CASCADE,
  question_id UUID REFERENCES questions(id),
  answer INT,                    -- digit pressed (1-4), NULL if no answer
  is_correct BOOLEAN DEFAULT FALSE,
  points INT DEFAULT 0,
  answered_at_ms INT,            -- ms since question started
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE quiz_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id UUID REFERENCES quizzes(id),
  report_data JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE call_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  caller_hash VARCHAR(64) NOT NULL,
  quiz_id UUID REFERENCES quizzes(id),
  connected_at TIMESTAMPTZ NOT NULL,
  disconnected_at TIMESTAMPTZ,
  questions_answered INT DEFAULT 0
);
```


---

## 5. SHARED TYPESCRIPT TYPES (`/shared/src/index.ts`)

Define and export ALL of these:

```typescript
export interface AnswerOption {
  digit: number;   // 1-4
  text: string;
}

export type QuestionType = 'regular' | 'bonus' | 'survey' | 'scratch';

export interface Question {
  id: string;
  text: string;
  options: AnswerOption[];
  correctAnswer: number;   // 1-4 (0 for survey)
  type: QuestionType;
  difficulty: 1 | 2 | 3;
  imageUrl?: string;
  language: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Quiz {
  id: string;
  name: string;
  description: string;
  status: 'draft' | 'active' | 'ended';
  settings: QuizSettings;
  questions: { order: number; questionId: string }[];
  createdAt: Date;
  updatedAt: Date;
}

export interface QuizSettings {
  timerSeconds: number;          // default 10, range 5-60
  leaderboardFrequency: number;  // show leaderboard every N questions, default 5
  maxParticipants: number;       // default 20
  smartScoring: boolean;         // default true
  bonusQuestions: boolean;       // default true
  showAnswererNames: boolean;    // show name on display when someone answers, default true
}

export interface Participant {
  id: string;
  quizId: string;
  name: string;
  phone: string;
  createdAt: Date;
}

export interface LeaderboardEntry {
  rank: number;
  participantId: string;
  name: string;
  totalPoints: number;
  correctAnswers: number;
}

export interface QuestionResults {
  questionId: string;
  quizId: string;
  totalParticipants: number;
  answeredCount: number;
  unansweredCount: number;
  distribution: {
    [digit: number]: { count: number; percentage: number };
  };
  correctAnswer?: number;   // only after reveal
}

export interface SessionRecord {
  sessionId: string;
  callSid: string;
  callerHash: string;
  quizId: string;
  status: 'active' | 'inactive';
  connectedAt: string;
  answers: Record<string, number>;   // questionId → digit pressed
  answerTimestamps: Record<string, number>; // questionId → ms since question started
  answeredCurrentQuestion: boolean;
}
```

---

## 6. ALL API ENDPOINTS

### Auth
```
POST /api/auth/login
  Body: { username: string, password: string }
  Response: { token: string }
```

### Quizzes (require Bearer JWT except /public)
```
GET    /api/quizzes
  Response: Quiz[]

POST   /api/quizzes
  Body: { name: string, description: string }
  Response: Quiz

GET    /api/quizzes/:id
  Response: Quiz (with questions array)

DELETE /api/quizzes/:id

GET    /api/quizzes/:id/public
  No auth required
  Response: { id, name, description, status }

POST   /api/quizzes/:id/start
  Sets status = 'active', initializes in-memory state

POST   /api/quizzes/:id/end
  Sets status = 'ended', clears in-memory state, saves report

POST   /api/quizzes/:id/questions
  Body: { questionId: string, order: number }

DELETE /api/quizzes/:id/questions/:questionId

POST   /api/quizzes/:id/questions/:questionId/activate
  Starts question timer, emits quiz:question-activated

POST   /api/quizzes/:id/questions/:questionId/stop
  Stops timer, emits quiz:question-stopped

POST   /api/quizzes/:id/questions/:questionId/reveal
  Calculates scores, saves to DB, emits quiz:answer-revealed

GET    /api/quizzes/:id/results/:questionId
  Response: QuestionResults

GET    /api/quizzes/:id/leaderboard
  Response: LeaderboardEntry[]

PATCH  /api/quizzes/:id/settings
  Body: Partial<QuizSettings>
```

### Participants (require Bearer JWT)
```
GET    /api/quizzes/:quizId/participants
  Response: Participant[]

POST   /api/quizzes/:quizId/participants
  Body: { name: string, phone: string }
  Response: Participant

DELETE /api/quizzes/:quizId/participants/:participantId

POST   /api/quizzes/:quizId/participants/import
  Body: multipart/form-data with xlsx file
  Columns: name | phone
  Response: { imported: number, errors: string[] }
```

### Questions (require Bearer JWT)
```
GET    /api/questions
  Response: Question[]

POST   /api/questions
  Body: { text, options, correctAnswer, type, difficulty, imageUrl? }
  Response: Question

PUT    /api/questions/:id
  Body: same as POST
  Response: Question

DELETE /api/questions/:id

POST   /api/questions/import
  Body: multipart/form-data with xlsx file
  Columns: שאלה | תשובה נכונה | תשובה 2 | תשובה 3 | תשובה 4 | סוג | קושי
  Response: { imported: number, errors: string[] }
```

### Reports
```
GET    /api/reports/:quizId
  Response: { quiz, perQuestion: QuestionResults[], leaderboard: LeaderboardEntry[] }
```

### Telephony Webhooks (no auth — called by telephony provider)
```
POST   /api/webhook/incoming-call
  Returns TwiML/IVR greeting audio

POST   /api/webhook/dtmf
  Body: { CallSid, Digits, From }
  Records answer, emits quiz:participant-answered

POST   /api/webhook/call-status
  Body: { CallSid, CallStatus }
  Handles call end
```


---

## 7. WEBSOCKET EVENTS (Socket.io)

Server emits to ALL connected clients in real-time:

```typescript
// New question started — triggers display animation sequence
'quiz:question-activated' → {
  questionId: string,
  question: Question,
  questionIndex: number,    // 0-based
  totalQuestions: number,
  timerSeconds: number      // from quiz settings, default 10
}

// Every second while timer runs
'quiz:timer-tick' → { secondsLeft: number }

// Someone answered — show their name floating on display
// NOTE: do NOT reveal which answer they chose, only that they answered
'quiz:participant-answered' → {
  name: string,
  answeredAt: number        // ms since question started
}

// Live count update (how many answered so far)
'quiz:results-update' → QuestionResults

// Timer stopped (admin pressed stop, or timer hit 0)
'quiz:question-stopped' → { questionId: string }

// Correct answer revealed — show green highlight + fastest answerer
'quiz:answer-revealed' → {
  questionId: string,
  correctAnswer: number,
  correctCount: number,
  totalAnswered: number,
  fastestName: string | null,   // name of fastest correct answerer
  fastestMs: number | null      // their response time in ms
}

// Leaderboard shown (every N questions, N from settings)
'quiz:leaderboard' → { entries: LeaderboardEntry[] }

// Quiz ended
'quiz:ended' → { winner: LeaderboardEntry | null }

// Participant count update (someone joined/left phone call)
'quiz:participant-count' → { count: number }
```

---

## 8. SCORING SYSTEM

### Base formula
```
points = max(50, 150 - (elapsed_seconds * 10))

Examples (10-second timer):
  Answered at 0s  → 150 points
  Answered at 5s  → 100 points  ← average
  Answered at 10s →  50 points

Wrong answer or no answer → 0 points (no penalty)
50-question quiz → winner gets ~5,000 points on average
```

### Smart scoring (admin toggle, default ON)
- Only 1 person answered correctly → that person gets +50% bonus
- Less than 30% answered correctly → all correct answerers get +25% bonus
- Nobody answered correctly → next question should be easier (if available in quiz)

### Bonus questions (admin toggle, default ON)
- Questions marked as `type = 'bonus'` → all points × 2
- Shown with a special "BONUS ×2" badge on the display screen

### Survey questions
- Questions marked as `type = 'survey'` → no correct answer, no points
- Just shows distribution of answers after timer ends

---

## 9. QUESTION TYPES

| Type | Behavior | Scoring |
|------|----------|---------|
| `regular` | Standard question, 2–4 options | Speed-based formula |
| `bonus` | Same as regular, marked with badge | Speed-based × 2 |
| `survey` | No correct answer, shows distribution only | No points |
| `scratch` | Question text revealed letter by letter | Speed-based (earlier reveal = more time = more points) |

All question types support an optional `imageUrl` field — if set, display the image above the question text.

---

## 10. SCREEN FLOW

### Admin flow (requires login):
```
/login → /quizzes → /quiz/:id/edit → /quiz/:id/lobby → /dashboard/:id → /reports/:id
```

### Public screens (no login required):
```
/display/:id     ← projected on big screen for audience
/register/:id    ← participants self-register (name + phone)
```

---

## 11. SCREEN DETAILS

### `/login`
- Hebrew RTL UI
- Username + password fields
- On success: save JWT to `localStorage`, redirect to `/quizzes`
- On failure: show "שם משתמש או סיסמה שגויים"

---

### `/quizzes`
- List all quizzes with status badge:
  - `draft` → yellow badge "טיוטה"
  - `active` → green badge "פעיל"
  - `ended` → gray badge "הסתיים"
- "צור חידון חדש" form: name + description → POST /api/quizzes
- Per-quiz action buttons:
  - draft → "ערוך" → `/quiz/:id/edit`
  - active → "לוח בקרה" → `/dashboard/:id`
  - ended → "דוח" → `/reports/:id`
  - always → "מסך ציבורי" → opens `/display/:id` in new tab

---

### `/quiz/:id/edit`
Three tabs:

**Tab 1 — שאלות (Questions)**
- Form: question text, 2–4 answer options, select correct answer, type (regular/bonus/survey/scratch), difficulty (1–3 stars)
- "הוסף לרשימה" button → adds to pending list (not saved yet)
- "שמור X שאלות" button → saves all pending to DB
- List of saved questions with delete button
- List of pending questions with remove button
- "ייבוא מאקסל" button → upload xlsx file
  - Columns: `שאלה | תשובה נכונה | תשובה 2 | תשובה 3 | תשובה 4 | סוג | קושי`
  - First answer column is always the correct answer
  - System shuffles answer order on display

**Tab 2 — משתתפים (Participants)**
- Form: name + phone → "הוסף משתתף" → POST /api/quizzes/:id/participants
- "ייבוא מאקסל" button → upload xlsx with columns: `שם | טלפון`
- List of registered participants with delete button
- Self-registration link: `{origin}/register/:id` with copy button

**Tab 3 — הגדרות (Settings)**
- Timer duration: slider 5–60 seconds (default 10)
- Show leaderboard every N questions: input 1–20 (default 5)
- Max participants: input 1–20 (default 20)
- Smart scoring: toggle on/off (default on)
- Bonus questions: toggle on/off (default on)
- Show answerer names on display: toggle on/off (default on)

**Nav bar:**
- "← חזור" → back to /quizzes
- Quiz name in center
- "התחל חידון ▶" button → saves pending questions → navigates to `/quiz/:id/lobby`

---

### `/quiz/:id/lobby`
- Full screen dark background
- Large phone number displayed in gold color (from `REACT_APP_PHONE_NUMBER` env var)
- "ממתין למשתתפים..." text with pulsing green dot
- Live participant count (via WebSocket `quiz:participant-count`)
- Top-right controls:
  - "← חזור לעריכה" button
  - "▶ התחל עכשיו" green button → calls POST /api/quizzes/:id/start → navigates to `/dashboard/:id`

---

### `/dashboard/:id`
- RTL Hebrew UI, dark theme
- Top nav: back button | "לוח בקרה" title | "📺 מסך ציבורי" purple button (opens display in new tab) | "סיים חידון" red button
- Stats bar: participant count | question X/total | timer | answered count
- Main area (left side):
  - **No active question**: list of all quiz questions, each with "▶ הפעל" button → POST activate
  - **Question active**: shows question text + 4 colored option bars with live answer counts, timer countdown, "⏹ עצור" and "👁 חשוף" buttons
  - **After reveal**: shows correct answer highlighted, fastest answerer name
  - **Leaderboard**: shows top 5 when leaderboard event fires
- Sidebar (right side): live leaderboard top 10, refreshes on every reveal

---

### `/display/:id` (PUBLIC — projected on big screen)

Full screen, dark background, Hebrew RTL. No controls visible.

**Phase sequence when a question activates:**

1. **`question-in`** — question text slides in from top (600ms CSS transition)
2. **`options-in`** — each option card appears one by one with bounce animation, 500ms apart
3. **`playing`** — timer starts after last option appears (400ms delay)
   - Colored progress bar shrinks left-to-right: green (>50%) → yellow (>20%) → red (≤20%)
   - Large number in center of bar counts down
   - When `showAnswererNames` is ON: each `quiz:participant-answered` event shows a floating name bubble: "⚡ [name] ענה!" that floats up and fades out
   - Live answered count shown: "ענו: X"
4. **`stopped`** — timer ends or admin stops
   - Each option bar shows percentage of answers received
5. **`revealed`** — admin reveals answer
   - Correct option turns green with "✓ נכון!"
   - Wrong options fade to 40% opacity
   - Shows: "🏆 הכי מהיר: [name] — [X.X] שניות"
   - Shows: "✅ ענו נכון: X | סה"כ ענו: Y"
6. **`leaderboard`** — shown every N questions (from settings)
   - Full screen dark
   - "🏆 לוח המובילים" title
   - Top 10 entries with medals 🥇🥈🥉 then numbers 4–10
   - Each row: rank icon | name | points (gold) | correct count (green)
7. **`winner`** — shown when quiz ends
   - Large 🏆 emoji
   - "המנצח הוא..."
   - Winner name in large text
   - Points and correct answer count
   - "תודה על השתתפותכם 🎉"

**Waiting screen** (between questions or before quiz starts):
- 🎯 emoji
- "ממתינים לשאלה..."
- Participant count

**Option colors:**
```typescript
const OPTION_COLORS = ['#e74c3c', '#3498db', '#f39c12', '#27ae60'];
// 1=Red, 2=Blue, 3=Orange, 4=Green
```

---

### `/register/:id` (PUBLIC)
- No auth required
- Shows quiz name
- Form: full name + phone number
- Submit → POST /api/quizzes/:id/participants
- Success: "נרשמת בהצלחה! 🎉"

---

### `/reports/:id`
- Quiz name + date
- Per-question stats: question text, answer distribution bar chart, correct answer highlighted, how many answered correctly
- Final leaderboard: top 10 with points and correct count
- "ייצוא לאקסל" button → downloads xlsx

---

## 12. IN-MEMORY STATE (server-side, no Redis)

### Quiz state (`quizManager.ts`)
```typescript
interface QuizState {
  activeQuestionId: string | null;
  questionStatus: 'active' | 'stopped' | null;
  revealedQuestions: string[];
  questionStartedAt: number | null;  // Date.now() when question activated
  questionIndex: number;
  totalQuestions: number;
}

const quizStates = new Map<string, QuizState>();
const timerIntervals = new Map<string, NodeJS.Timeout>();
```

Timer behavior:
- Ticks every 1 second, emits `quiz:timer-tick`
- When it hits 0: automatically calls `stopQuestion()` then `revealAnswer()`

### Phone sessions (`sessionStore.ts`)
```typescript
const sessions = new Map<string, SessionRecord>();
// key = callSid
```

---

## 13. SCORING LOGIC (server-side, called on reveal)

When `revealAnswer(quizId, questionId)` is called:
1. Get all active phone sessions for this quiz
2. For each registered participant, match phone (last 9 digits) to a session
3. Check if they answered the correct digit
4. Calculate: `points = max(50, 150 - Math.round(answeredAtMs / 1000) * 10)`
5. If `smartScoring` is ON: apply bonuses (see section 8)
6. If question `type === 'bonus'`: multiply points × 2
7. Insert row into `participant_scores` table
8. Find fastest correct answerer (lowest `answeredAtMs`)
9. Emit `quiz:answer-revealed` with `fastestName` and `fastestMs`

Phone matching:
```typescript
const normalize = (p: string) => p.replace(/\D/g, '').slice(-9);
// match session callerHash against participant phone
```

---

## 14. TELEPHONY WEBHOOKS

Participants call a phone number. The telephony provider (Twilio or ימות המשיח) sends HTTP webhooks:

### `POST /api/webhook/incoming-call`
- Called when someone dials in
- Create a new `SessionRecord` in memory
- Return TwiML XML that plays a greeting and waits for DTMF input

### `POST /api/webhook/dtmf`
Body: `{ CallSid, Digits, From }`
1. Find session by CallSid
2. Find active quiz (there should be only one active quiz at a time)
3. Find active question in that quiz
4. If participant already answered this question → ignore
5. Record: `session.answers[questionId] = digit`, `session.answerTimestamps[questionId] = Date.now() - questionStartedAt`
6. Mark `session.answeredCurrentQuestion = true`
7. Find participant name by matching phone number
8. Emit `quiz:participant-answered` with name and timestamp
9. Emit updated `quiz:results-update`
10. Return TwiML confirmation audio ("תשובתך נקלטה")

### `POST /api/webhook/call-status`
Body: `{ CallSid, CallStatus }`
- If `CallStatus === 'completed'`: mark session as inactive, log to `call_logs`

---

## 15. ENVIRONMENT VARIABLES

### Server (`.env`)
```
PORT=3000
NODE_ENV=development
DATABASE_URL=postgresql://user:pass@host:port/dbname
JWT_SECRET=your-secret-key
TELEPHONY_PROVIDER=twilio
TWILIO_ACCOUNT_SID=...
TWILIO_AUTH_TOKEN=...
TWILIO_PHONE_NUMBER=+1234567890
WEBHOOK_BASE_URL=https://your-server.railway.app
```

### Client (`client/.env`)
```
REACT_APP_API_URL=http://localhost:3000
REACT_APP_PHONE_NUMBER=03-XXXXXXX
```

---

## 16. IMPORTANT IMPLEMENTATION NOTES

1. **All UI is Hebrew RTL** — use `direction: 'rtl'` on all containers
2. **No Redux** — local React state + WebSocket events only
3. **No Redis** — all game state is in-memory Maps on the server
4. **Socket.io broadcasts to ALL** — no room filtering, all clients get all events
5. **Phone matching** — normalize both sides: `phone.replace(/\D/g, '').slice(-9)`
6. **JWT in Authorization header** — `Bearer <token>`
7. **Shared package** — import types from `@trivia/shared`, resolved via tsconfig paths
8. **Max participants** — 20 (configurable constant `MAX_PARTICIPANTS = 20` in config)
9. **Answer options are shuffled** on display — correct answer position is randomized each time
10. **Timer auto-reveals** — when timer hits 0, server automatically stops and reveals
11. **One active quiz at a time** — the webhook handler finds the single active quiz
12. **Question images** — if `imageUrl` is set, show image above question text on display screen
13. **Difficulty stars** — show 1–3 stars on question cards in dashboard and edit page
14. **Scratch questions** — reveal text character by character, one letter every ~100ms
