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
