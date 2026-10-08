# Housekeeping boards: API contract

Edge function `housekeeping-api` at `https://safcrtrfdzsnftghibot.supabase.co/functions/v1/housekeeping-api`.
Every call is `POST` JSON `{ action, staff_email, ... }` with headers `apikey` and `Authorization: Bearer <anon key>` (copy how `team-training/index.html`
or `onboarding/index.html` do it; the portal login is `sessionStorage.bhb_staff_email`). Failure is HTTP 400/403 `{ "error": "plain message" }`.

Two tiles use it:
* **Housekeepers boards** (`hk-board`, page `housekeeping/index.html`, for the cleaners, phone first). Needs the `hk-board` tile.
* **Housekeeping Boards Config** (`hk-config`, page `housekeeping/config.html`, for the head housekeeper, desktop and phone). Needs the `hk-config` tile.
A person holding `hk-config` may also call the board actions.

All times are UK local, strings `HH:MM`. Dates `YYYY-MM-DD`. `today` below is the UK date.

## The Guestline "Room Status Report" (what the config page parses)
Sample: `C:\Users\GM\Downloads\BLACKHORSE_HouseRoomStatus_20261007_131857.pdf`. Columns: Room ID, Room Type, Sub Group, Room Status (Occupied/Vacant),
Housekeeping Status (`Stayover`, `Departure / Dirty Room`, may also be e.g. `Clean`, `Inspected`, `Arrival`...), Occupied From, Occupied To, Lead Name, Ad, Ch, Inf,
Night (like `1/2` = night 1 of 2; `0/1` for a booking that arrives today), Room Section. For a **departure** row the Occupied From/To/Lead/Ad/Ch/Inf columns describe the **next**
booking going into that room (empty when nobody is arriving); for a **stayover** row they describe the guests currently in the room. Below the table is a
"ROOS/DFS returning to service today" table (Room ID, Start Date, End Date, Notes). The footer says "Page 1 of 2 at 13:18 on the 07/Oct/2026" (the report date and time).
The report has NO booking comments column in the sample, but other runs may: capture any extra text (a Comments/Notes column, or extra lines under a room row) as `notes`.

## Shared shapes
**Task** (one room to clean on a day):
```
{ id, date, room:'14', name:'Rosemary', room_type:'ROSEMARY', group:'SELF_CATERED', kind:'departure'|'stayover',
  hk_status:'Departure / Dirty Room', room_status:'Vacant',
  minutes: 120,                                   // time to clean this room (departure or stayover minutes)
  incoming: { people, adults, children, infants, nights, from, to, lead_name? } | null,   // departure: who is going in next (null = nobody arriving)
  current:  { people, adults, children, infants, night_done, night_total, to, lead_name? } | null,  // stayover: the guests in the room
  report_notes: string|null,                      // comments that came with the report
  note: string|null,                              // note added by the head housekeeper
  cleaner: { name, email|null, planday_id|null, other:bool } | null,
  cleaned_at, cleaned_by, checked_at, checked_by, check_note,   // ISO / names / null
  issues: n,                                      // maintenance issues raised from this room today
  manual: bool, gone: bool }
```
`lead_name` is only sent to config callers, never to the board.

**Day**: `{ date, message, start_time:'09:00', break_minutes:20, report_name, report_at, imported_by, imported_at }`.

**Plan** (worked out by the server from tasks + day):
```
{ rooms, departures, stayovers, minutes,                          // totals
  per_cleaner: [ { key, name, email, rooms, departures, stayovers, minutes, finish:'HH:MM' } ],
  unassigned: { rooms, minutes },
  cleaners_on_shift: n,
  even_split_finish: 'HH:MM'|null,                                // all minutes shared equally between the cleaners on shift
  latest_finish: 'HH:MM'|null }                                   // latest of the assigned cleaners
```
`finish = start_time + sum of that cleaner's room minutes + break_minutes` (the break only counts when they have at least one room).

## Config calls
* `config.bootstrap` { date? } -> `{ me:{email,name,admin}, today, date, day, tasks:[Task], plan:Plan, rooms:[Room], cleaners:[Cleaner], all_staff:[Cleaner], planday:{ok, error?}, log:[{room, who, what, at}] }`
  `Room` = `{ room, name, room_type, minutes, stayover_minutes|null, sort_order, active }`. `Cleaner` = `{ planday_id, name, email|null, shift?:'09:00-17:00', draft?:bool }`:
  `cleaners` are Housekeeping staff with a Planday shift that date; `all_staff` is everyone in the Housekeeping department (for the "Other" drop-down).
  Tasks are sorted by room sort order; `gone` tasks (no longer on the latest report, but already worked on) are included, flagged.
* `report.import` { date, report_name?, report_at?, rooms:[ParsedRow], roos?:[{room, start, end, notes}] } -> `{ added, updated, unchanged, removed, skipped, tasks, plan, day }`
  `ParsedRow` = `{ room, room_type?, group?, room_status?, hk_status, occupied_from?, occupied_to?, lead_name?, adults, children, infants, night_done?, night_total?, section?, notes? }`.
  The page parses the PDF in the browser and sends every row of the report (also rows that need no cleaning). The server decides: `hk_status` containing "stayover" -> stayover task;
  containing "departure" -> departure task; anything else (Clean, Inspected, Arrival, Out of order...) needs no cleaning and is skipped. Re-importing the same day later MERGES:
  assignments, notes, cleaned and checked stamps are kept; rooms that vanish from the report are flagged `gone` (never deleted if cleaned).
* `task.update` { id, cleaner?: { planday_id?, name, email?, other? } | null, note? } -> `{ task, plan }` (set or clear the cleaner; set the head housekeeper's note)
* `task.add` { date, room, kind, note? } -> `{ task, plan }` (a room not on the report, `manual`)
* `task.remove` { id } -> `{ plan }` (only manual tasks, or ones not yet cleaned: marks `gone`)
* `day.save` { date, message?, start_time?, break_minutes? } -> `{ day, plan }`
* `task.check` { id, checked: bool, note? } -> `{ task }` (the head housekeeper confirms the room has been checked; only when cleaned)
* `task.reopen` { id } -> `{ task }` (clears cleaned and checked: the room needs doing again)
* `rooms.save` { rooms:[Room] } -> `{ rooms, plan }` (change names and minutes; adds a room if new)

## Board calls
* `board.get` { date? (default today) } -> `{ me:{email,name}, now:'HH:MM', date, day, message, tasks:[Task] (only MY rooms; no lead_name), mine:{ rooms, minutes, finish:'HH:MM'|null, cleaned, remaining }, issue_types:[{key,label}] }`
  Tasks are in room order. Nothing assigned to me -> `tasks:[]`.
* `task.cleaned` { id, done: bool } -> `{ task, mine }` (marks my room cleaned now, by me; `done:false` undoes it unless it has been checked)
* `issue.raise` { task_id, job_type, description, room_offline?: bool } -> `{ job_no, task }` (creates a job in the Maintenance List: location "Room 14 Rosemary", raised by me)

## Teams, several cleaners per room, set-up jobs (added 7 Oct, after the first release)
* **Task** now has `cleaners: [{ name, email|null, planday_id|null, other }]` (everyone cleaning the room; `[]` = unassigned), `team: string|null` (the team it was given to), and `kind` can be `'setup'`:
  a room the report calls clean ("Room is Clean") but that carries a "Housekeeping Notes" line (for example "Extra bed needed"). It is shown with a SET UP pill, 10 minutes, and the note; the next guests are still shown. `cleaner` (first person) remains for old callers.
* **Plan** now has `cleaners_assigned` (distinct people given at least one room; REPLACES `cleaners_on_shift`: the head housekeeper is on the rota but only counts if she is given rooms), `setups`, `share_minutes`.
  `per_cleaner[].minutes` shares a room's minutes between the people on it when `day.share_minutes` is true (default): 120 minutes for 3 people = 40 each. `even_split_finish` = shared equally between `cleaners_assigned` (null when nobody is assigned).
* `day` now has `share_minutes: bool`; `day.save` accepts it.
* `config.bootstrap` also returns `teams: [{ id, date, name, members:[Person] }]` for that date.
* `team.save` { date, id?, name?, members:[Person] (2 to 8) } -> `{ teams }` (name defaults to "Karen + Tyler"); `team.delete` { date, id } -> `{ teams }`.
* `task.update` { id, cleaners?: [Person] (up to 8; [] clears), team_name?: string, note? } -> `{ task, plan }`. Giving a room to a team = send that team's members as `cleaners` and `team_name`; adding or removing someone for that one room = send the edited list (keep `team_name` or send none). Teams do not change by themselves when the list on a room is edited.
* **Board**: `board.get` tasks include a room if the person is anywhere in `cleaners`; each task has `with: [names of the OTHER people on the room]` and `my_minutes` (their share), `cleaners`; `mine.minutes`/`mine.finish` already use the shared minutes.
* **Report**: a line "Housekeeping Notes : Extra bed needed" sits under the room row (in the Room Type / Sub Group area). It belongs to that room: send it as `notes` on that row (the server strips the "Housekeeping Notes :" label). Sample: `C:\Users\GM\Downloads\BLACKHORSE_HouseRoomStatus_20261007_152239.pdf` (room 16 has the note and status "Room is Clean"; rooms 06, 14, 17 are dirty departures).

## Room started, timer and head housekeeper feedback (8 Oct 2026)
* **Task** now has `started_at`, `started_by`, `took_minutes` (cleaned minus started, null until both exist), `feedback` (`'ok'` thumbs up | `'fix'` needs correcting | null), `feedback_note`, `feedback_at`, `feedback_by`, `fixed_at`, `fixed_by`. Sent on both the board and config calls (a cleaner sees the feedback on their own rooms).
* `task.started` { id, started: bool } -> `{ task }`. The cleaner (anyone on the room) or the head housekeeper. The first tap wins (a second person on a shared room keeps the first start time). `started:false` clears it ("Started by mistake") unless the room is already cleaned. The board counts up from `started_at` and turns red past the room's minutes.
* `task.feedback` { id, result: 'ok' | 'fix' | null, note? } -> `{ task }` (config only; the room must be cleaned). `ok` also marks the room checked (same as the old Confirm checked) and keeps an optional note. `fix` needs a `note` and clears checked and any "fixed". `null` takes the feedback off (and the check, if it was a thumbs up).
* `task.fixed` { id, done: bool } -> `{ task }` (the cleaner or head housekeeper, only while `feedback = 'fix'`): "I have fixed it" so the head housekeeper looks again.
* `task.reopen`, and a room changing kind on a re-import, clear started and feedback too.
