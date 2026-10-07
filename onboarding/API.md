# Onboarding: API contract

One edge function, `onboarding-api`, at `https://safcrtrfdzsnftghibot.supabase.co/functions/v1/onboarding-api`.
Every call is `POST` JSON `{ action, ... }` with headers `apikey: <anon key>` and `Authorization: Bearer <anon key>`
(the anon key is in `team-training/index.html`: copy how it calls `training-api`).
Success is HTTP 200 with the JSON shown. Failure is HTTP 400/403 with `{ "error": "plain-English message" }`
(public calls may also add `"code"`: `notfound | expired | cancelled | done`, and `"fields": { "<field>": "message" }` on a validation failure).

Two audiences:

* **Manager calls** send `staff_email` (the Staff Portal login, `sessionStorage.bhb_staff_email`, exactly as `team-training/index.html` does).
  Allowed for anyone who holds the `onboarding` tile. Anyone with the tile may see everything, health answers included. The `settings.save`
  and `planday.create` actions need an admin (`me.admin`).
* **Public calls** (`p.*`) send `token` (the secret in the starter's link) and no login.

## Statuses

`draft` (made, link not sent) -> `link_sent` -> `in_progress` (they have opened it) -> `signed` (contract signed) -> `submitted` (everything done)
-> `in_planday` (employee created in Planday) -> `complete` (a person ticked it off). `cancelled` at any point.

## Manager calls

### `bootstrap` -> 
```
{ me: { email, name, admin },
  settings: { notify_emails:[...], link_valid_days, auto_planday, hourly_signatory, hourly_signatory_title, salaried_signatory, salaried_signatory_title },
  planday: { configured: bool, can_create: bool, error?: string,
             departments: [{ id, name }], groups: [{ id, name }] },
  templates: [ { key:'hourly', label:'Hourly paid staff', fields:['job_title','hourly_rate'] },
               { key:'salaried', label:'Salaried staff', fields:['job_title','salary','hours'] } ] }
```

### `starters.list` { filter?: 'open'|'all'|'cancelled' } -> `{ starters: [Summary] }`
Summary: `{ id, first_name, last_name, email, job_title, department_name, start_date, contract_type, status, step, link_sent_at, link_expires_at, first_opened_at, signed_at, submitted_at, risk_required, risk_status, flags: n, planday_id, files: n }`
Newest first. `open` = everything except `complete` and `cancelled`.

### `starter.save` { id?, ...fields } -> `{ starter: Full }`
Creates (no `id`) or updates (editable until `submitted`). Fields:
`first_name last_name email mobile job_title department_id department_name group_id group_name start_date (YYYY-MM-DD)
contract_type ('hourly'|'salaried') hourly_rate salary hours work_location employment_type ('full_time'|'part_time') night_work (bool)
term ('permanent'|'temporary') line_manager line_manager_tel notes`.
Rules: hourly needs `hourly_rate`; salaried needs `salary` and `hours`. A changed contract after the starter has signed is refused.

### `starter.get` { id } -> `{ starter: Full, files: [File], log: [{ who, what, at }], link: string|null }`
Full = Summary + all the fields above + `details`, `checklist`, `health`, `health_flags`, `wtd`, `has_signature`, `contract_date`, `risk_note`, `risk_by`, `risk_at`,
`planday_error`, `planday_at`, `created_by`, `created_at`. Opening this logs "viewed" against the person.
`health_flags` = `[ { id, level:'risk'|'review'|'exclusion', title, reason, answer, hazards:[hazardKey], note? } ]` (see `health.json` for the hazard keys and wording).
File = `{ id, kind:'contract'|'health'|'wtd'|'payroll'|'risk', name, size, created_at }`.

### `starter.send` { id } -> `{ link, emailed: bool, email_error?: string }`
Makes the link if there is none (valid `link_valid_days`), emails it to the starter from the venue, sets `link_sent`. Also works to re-send; a new
link is made if the old one expired.

### `starter.link` { id } -> `{ link, expires_at }`   (copy the link without emailing)
### `starter.cancel` { id } -> `{ starter }`
### `starter.risk` { id, status:'none'|'required'|'in_progress'|'done'|'not_needed', note? } -> `{ starter }`
### `starter.complete` { id, done: bool } -> `{ starter }`   (tick off / un-tick `complete`)
### `contract.preview` { contract_type, first_name, last_name, job_title, hourly_rate?, salary?, hours?, start_date } -> `{ blocks, signatory }`
Blocks are described below. Used to show the manager the contract before sending.

### `file.url` { file_id } -> `{ url, name }`   (a link that works for 5 minutes; open in a new tab)
### `planday.preview` { id } -> `{ payload: {...}, missing: [string], already: bool }`
### `planday.create` { id } -> `{ starter, planday_id }`   (admin; refuses if `missing` is not empty or it is already created)
### `settings.get` -> `{ settings }`   /   `settings.save` { notify_emails?, link_valid_days?, auto_planday?, ...signatory fields } -> `{ settings }` (admin)

## Public calls (the starter)

### `p.open` { token } -> 
```
{ starter: { first_name, last_name, job_title, department_name, start_date, contract_type, status, step },
  details, checklist, health, wtd,            // what they have already saved (so they can come back and carry on)
  signed: { health: bool, wtd: bool, contract: bool }, has_signature: bool,
  submitted: bool, expires_at }
```
Errors carry `code`: `notfound`, `expired`, `cancelled`. If already `submitted` it still returns 200 with `submitted:true` (show the thank-you).

### `p.save` { token, section, data, step? } -> `{ ok:true, statement?:'A'|'B'|'C', student_loan?:bool }`
`section` is `details`, `checklist`, `health` or `wtd`. Saves what is sent (merging into what is stored) and remembers `step` so the link reopens there.
Validation failure -> HTTP 400 `{ error, fields:{...} }`. Field names below.

**details** (payroll):
`title ('Mr'|'Mrs'|'Miss'|'Ms'|'Mx'|'Dr'|'')`, `first_names`, `last_name`, `gender ('male'|'female')` (as shown on the birth certificate or gender recognition certificate),
`dob (YYYY-MM-DD)`, `address1`, `address2`, `town`, `county`, `postcode`, `country` (default 'United Kingdom'), `email`, `mobile`,
`eligible_uk (true|false)`, `ni_number` (like `QQ123456C`, blank allowed: "I don't know it yet" -> `ni_unknown:true`),
`bank_name`, `account_holder`, `sort_code (6 digits)`, `account_number (8 digits)`, `building_society_roll` (optional),
`nok_name`, `nok_relationship`, `nok_address`, `nok_tel_day`, `nok_tel_eve` (optional).
Required: all except `address2`, `county`, `title`, `building_society_roll`, `nok_tel_eve`, and `ni_number` when `ni_unknown`.

**checklist** (HMRC starter checklist; `statement` and `student_loan` are worked out by the server):
`other_job (bool)` (Q8), `pension (bool)` (Q9, only asked if `other_job` is false), `since_april (bool)` (Q10, only asked if both above are false),
`student_loan (bool)` (Q11), `loan_exempt (bool)` (Q12, only if Q11 yes), `plans` (array of `'plan1'|'plan2'|'plan4'|'plan5'|'postgrad'`, only if Q12 no; at least one),
`confirm_name` (their full name, used as the declaration).
Statement: Q8 yes or Q9 yes -> C; else Q10 yes -> B; else A.

**health**: `answers`: `{ <questionId>: { a: 'yes'|'no'|'skip', d: 'details text' } }` for yes/no questions; `{ v: number|string }` for number/text questions;
`jobs: [ { company, role, start, finish } ]`; `gp: { name, address, tel }`. Question ids and wording come from `onboarding/health.json`
(served beside the pages: fetch `health.json` relative to the page). A yes whose question has `details` needs `d`.
`data` = `{ answers, jobs, gp }`. The server recomputes `health_flags` on every save.

**wtd**: `{ choice: 'opt_out' | 'keep_limit' }`. (The employee must be free to choose either.)

### `p.sign` { token, doc:'health'|'wtd'|'contract', signature?:'data:image/png;base64,...', agree:true, full_name } -> `{ ok:true, signed:{health,wtd,contract} }`
`signature` is needed the first time (kept for the later documents, so on the next call it may be omitted). `agree` must be true; `full_name` is the typed name beside it.
Signing `health` needs the health questions saved; `wtd` needs `wtd.choice`; `contract` needs the contract opened (`p.contract`). Signing `contract` makes the contract PDF.

### `p.contract` { token } -> `{ blocks: [Block], signatory: { name, title }, contract_date, start_date, full_name }`
The contract with every value filled in for this starter. Block kinds (render in order):
`{k:'cover', t}` cover-page line (centred); `{k:'title', t}`; `{k:'h', n:'5.', t}` clause heading; `{k:'c', n:'5.1', t}` clause;
`{k:'s', n:'(a)', t}` sub-clause (indented); `{k:'p', t, b?:true, i?:1}` plain paragraph (bold / indented).
Text is plain (no HTML); escape it.

### `p.submit` { token } -> `{ ok:true }`
Needs details, checklist, health, wtd and the three signatures. Makes the payroll starter form, health questionnaire and opt-out PDFs, marks `submitted`, tells the team.

## health.json (shared question bank)
`onboarding/health.json`: `sections[] -> questions[]` with `type` in `yesno | number | text | jobs | gp`, `details` (the prompt shown when Yes), `help`, `optional`, `allowSkip`
(yes/no with a third "Prefer not to say"), `flag` (what the manager is told). The page renders from it; do not hard-code the questions.
