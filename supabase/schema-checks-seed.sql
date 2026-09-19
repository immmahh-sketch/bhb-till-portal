-- ============================================================
-- Seed checklist templates + questions. Safe to re-run: each
-- template is only inserted if a template with that name doesn't
-- already exist (so editing questions later in the portal sticks).
-- ============================================================

do $seed$
begin

-- ---------------- GUEST JOURNEY ----------------
if not exists (select 1 from public.checklist_templates where name='Guest Journey Walk-round') then
  with tpl as (
    insert into public.checklist_templates (category, area, name, frequency, due_time, sort_order)
    values ('guest_journey','Whole venue','Guest Journey Walk-round','weekly','15:00',10)
    returning id)
  insert into public.checklist_items (template_id, sort_order, prompt, input_type, required)
  select id, v.ord, v.prompt, v.itype, v.req from tpl, (values
    (1,'Car park surface, lighting and signage all OK — no hazards','yes_no',true),
    (2,'Car park and entrance clear of litter and rubbish','yes_no',true),
    (3,'Exterior bins emptied and not overflowing','yes_no',true),
    (4,'Exterior lighting and signage all working','yes_no',true),
    (5,'Front of house / reception area clean and tidy','yes_no',true),
    (6,'All light bulbs working throughout guest areas (none out)','yes_no',true),
    (7,'Tables and chairs clean, straight and undamaged','yes_no',true),
    (8,'Floors clean throughout guest areas','yes_no',true),
    (9,'Marquee set up correctly and clean for today','yes_no',true),
    (10,'Marquee heating/temperature comfortable','yes_no',true),
    (11,'Toilets clean, stocked (soap/paper/towels) and bins emptied','yes_no',true),
    (12,'Music at appropriate volume and style for time of day','yes_no',true),
    (13,'Room temperature comfortable throughout the venue','yes_no',true),
    (14,'Venue correctly set for any show rounds / viewings today','yes_no',true),
    (15,'Any maintenance issues found (describe, or leave blank)','text',false)
  ) as v(ord, prompt, itype, req);
end if;

-- ---------------- SHIFT: BAR ----------------
if not exists (select 1 from public.checklist_templates where name='Bar Opening Checks') then
  with tpl as (
    insert into public.checklist_templates (category, area, name, frequency, due_time, sort_order)
    values ('shift','Bar','Bar Opening Checks','daily','12:00',20)
    returning id)
  insert into public.checklist_items (template_id, sort_order, prompt, input_type, required, pass_min, pass_max)
  select id, v.ord, v.prompt, v.itype, v.req, v.pmin, v.pmax from tpl, (values
    (1,'Fridges/cellar stocked and organised','yes_no',true,null::numeric,null::numeric),
    (2,'Cellar/bar fridge temperature (°C)','temperature',true,null::numeric,8),
    (3,'Ice wells clean and filled','yes_no',true,null::numeric,null::numeric),
    (4,'Ice machine clean — no mould or build-up','yes_no',true,null::numeric,null::numeric),
    (5,'Glass washer clean, refilled and running','yes_no',true,null::numeric,null::numeric),
    (6,'Bar top, back bar and optics clean','yes_no',true,null::numeric,null::numeric),
    (7,'Bins empty with fresh liners','yes_no',true,null::numeric,null::numeric),
    (8,'Till float counted and correct (£)','number',true,null::numeric,null::numeric),
    (9,'Till / POS system working','yes_no',true,null::numeric,null::numeric),
    (10,'Cellar checked — no leaks, gas pressure correct','yes_no',true,null::numeric,null::numeric),
    (11,'Beer lines clean (per line-cleaning schedule)','yes_no',true,null::numeric,null::numeric),
    (12,'Music system on, correct playlist/volume','yes_no',true,null::numeric,null::numeric),
    (13,'Anything to flag (describe, or leave blank)','text',false,null::numeric,null::numeric)
  ) as v(ord, prompt, itype, req, pmin, pmax);
end if;

if not exists (select 1 from public.checklist_templates where name='Bar Closing Checks') then
  with tpl as (
    insert into public.checklist_templates (category, area, name, frequency, due_time, sort_order)
    values ('shift','Bar','Bar Closing Checks','daily','23:59',21)
    returning id)
  insert into public.checklist_items (template_id, sort_order, prompt, input_type, required)
  select id, v.ord, v.prompt, v.itype, true from tpl, (values
    (1,'All spirits and optics secured','yes_no'),
    (2,'Fridges restocked for tomorrow','yes_no'),
    (3,'Ice wells emptied and cleaned','yes_no'),
    (4,'Glass washer drained and cleaned','yes_no'),
    (5,'Surfaces wiped and sanitised','yes_no'),
    (6,'Bins emptied, area free of rubbish','yes_no'),
    (7,'Till reconciled / Z-read completed, float removed and secured','yes_no'),
    (8,'Cellar/gas turned off as required','yes_no'),
    (9,'All equipment switched off (except fridges/freezers)','yes_no'),
    (10,'Doors and windows locked, alarm set','yes_no')
  ) as v(ord, prompt, itype);
end if;

-- ---------------- SHIFT: KITCHEN ----------------
if not exists (select 1 from public.checklist_templates where name='Kitchen Opening Checks') then
  with tpl as (
    insert into public.checklist_templates (category, area, name, frequency, due_time, sort_order)
    values ('shift','Kitchen','Kitchen Opening Checks','daily','12:00',30)
    returning id)
  insert into public.checklist_items (template_id, sort_order, prompt, input_type, required, pass_min, pass_max)
  select id, v.ord, v.prompt, v.itype, v.req, v.pmin, v.pmax from tpl, (values
    (1,'Fridge 1 temperature (°C) — must be 5°C or below','temperature',true,null::numeric,5),
    (2,'Fridge 2 temperature (°C) — must be 5°C or below','temperature',false,null::numeric,5),
    (3,'Freezer temperature (°C) — must be -18°C or below','temperature',true,null::numeric,-18),
    (4,'Food stock rotated and date-labelled (FIFO)','yes_no',true,null::numeric,null::numeric),
    (5,'Prep areas clean and sanitised','yes_no',true,null::numeric,null::numeric),
    (6,'Handwash stations stocked (soap, towels, sanitiser)','yes_no',true,null::numeric,null::numeric),
    (7,'Cleaning schedule up to date','yes_no',true,null::numeric,null::numeric),
    (8,'Ovens, fryers and extraction working correctly','yes_no',true,null::numeric,null::numeric),
    (9,'First aid kit present and stocked','yes_no',true,null::numeric,null::numeric),
    (10,'Anything to flag (describe, or leave blank)','text',false,null::numeric,null::numeric)
  ) as v(ord, prompt, itype, req, pmin, pmax);
end if;

if not exists (select 1 from public.checklist_templates where name='Kitchen Closing Checks') then
  with tpl as (
    insert into public.checklist_templates (category, area, name, frequency, due_time, sort_order)
    values ('shift','Kitchen','Kitchen Closing Checks','daily','23:59',31)
    returning id)
  insert into public.checklist_items (template_id, sort_order, prompt, input_type, required, pass_min, pass_max)
  select id, v.ord, v.prompt, v.itype, v.req, v.pmin, v.pmax from tpl, (values
    (1,'Fridge temperature at close (°C) — must be 5°C or below','temperature',true,null::numeric,5),
    (2,'Freezer temperature at close (°C) — must be -18°C or below','temperature',true,null::numeric,-18),
    (3,'All food covered, labelled, dated and stored correctly','yes_no',true,null::numeric,null::numeric),
    (4,'Surfaces and equipment cleaned and sanitised','yes_no',true,null::numeric,null::numeric),
    (5,'Floors swept and mopped','yes_no',true,null::numeric,null::numeric),
    (6,'Waste removed, bins emptied','yes_no',true,null::numeric,null::numeric),
    (7,'Extraction filters checked/cleaned per schedule','yes_no',true,null::numeric,null::numeric),
    (8,'Gas and equipment turned off','yes_no',true,null::numeric,null::numeric),
    (9,'Kitchen secured','yes_no',true,null::numeric,null::numeric)
  ) as v(ord, prompt, itype, req, pmin, pmax);
end if;

-- ---------------- SHIFT: FRONT OF HOUSE ----------------
if not exists (select 1 from public.checklist_templates where name='Front of House Opening Checks') then
  with tpl as (
    insert into public.checklist_templates (category, area, name, frequency, due_time, sort_order)
    values ('shift','Front of House','Front of House Opening Checks','daily','12:00',40)
    returning id)
  insert into public.checklist_items (template_id, sort_order, prompt, input_type, required)
  select id, v.ord, v.prompt, v.itype, true from tpl, (values
    (1,'Dining area clean, tables and chairs set','yes_no'),
    (2,'Toilets checked, stocked and clean','yes_no'),
    (3,'Signage and menus up to date and clean','yes_no'),
    (4,'Fire exits clear and unlocked for trading','yes_no'),
    (5,'Heating/air conditioning set to a comfortable level','yes_no'),
    (6,'Reception/host area tidy','yes_no')
  ) as v(ord, prompt, itype);
end if;

if not exists (select 1 from public.checklist_templates where name='Front of House Closing Checks') then
  with tpl as (
    insert into public.checklist_templates (category, area, name, frequency, due_time, sort_order)
    values ('shift','Front of House','Front of House Closing Checks','daily','23:59',41)
    returning id)
  insert into public.checklist_items (template_id, sort_order, prompt, input_type, required)
  select id, v.ord, v.prompt, v.itype, true from tpl, (values
    (1,'Dining area cleared and reset','yes_no'),
    (2,'Toilets checked and cleaned','yes_no'),
    (3,'Rubbish and recycling removed','yes_no'),
    (4,'Fire exits checked clear','yes_no'),
    (5,'Lights and heating turned off as appropriate','yes_no'),
    (6,'Building secured','yes_no')
  ) as v(ord, prompt, itype);
end if;

-- ---------------- HEALTH & SAFETY ----------------
if not exists (select 1 from public.checklist_templates where name='Fire Alarm Weekly Test') then
  with tpl as (
    insert into public.checklist_templates (category, area, name, frequency, due_time, sort_order)
    values ('health_safety','Fire Safety','Fire Alarm Weekly Test','weekly','18:00',50)
    returning id)
  insert into public.checklist_items (template_id, sort_order, prompt, input_type, required)
  select id, v.ord, v.prompt, v.itype, v.req from tpl, (values
    (1,'Call point tested this week (location/number)','text',true),
    (2,'Alarm sounded correctly and was audible throughout the premises','yes_no',true),
    (3,'Any faults found','yes_no',true),
    (4,'Fault details, if any (describe, or leave blank)','text',false)
  ) as v(ord, prompt, itype, req);
end if;

if not exists (select 1 from public.checklist_templates where name='Fire Extinguisher Check') then
  with tpl as (
    insert into public.checklist_templates (category, area, name, frequency, due_time, sort_order)
    values ('health_safety','Fire Safety','Fire Extinguisher Check','monthly','18:00',51)
    returning id)
  insert into public.checklist_items (template_id, sort_order, prompt, input_type, required)
  select id, v.ord, v.prompt, v.itype, true from tpl, (values
    (1,'All extinguishers in their correct locations','yes_no'),
    (2,'No visible damage, corrosion or discharge','yes_no'),
    (3,'Pin and tamper seal intact on all units','yes_no'),
    (4,'Pressure gauges in the green / correct range','yes_no'),
    (5,'Signage visible and access not obstructed','yes_no'),
    (6,'Any extinguisher needing attention (describe, or leave blank)','text')
  ) as v(ord, prompt, itype);
end if;

if not exists (select 1 from public.checklist_templates where name='Fire Door Check') then
  with tpl as (
    insert into public.checklist_templates (category, area, name, frequency, due_time, sort_order)
    values ('health_safety','Fire Safety','Fire Door Check','weekly','18:00',52)
    returning id)
  insert into public.checklist_items (template_id, sort_order, prompt, input_type, required)
  select id, v.ord, v.prompt, v.itype, true from tpl, (values
    (1,'All fire doors close fully and latch on their own','yes_no'),
    (2,'No damage to doors, frames or seals','yes_no'),
    (3,'Hinges and self-closers working freely','yes_no'),
    (4,'No fire doors wedged or propped open','yes_no'),
    (5,'Vision panels intact where fitted','yes_no'),
    (6,'Any fire door needing attention (describe, or leave blank)','text')
  ) as v(ord, prompt, itype);
end if;

if not exists (select 1 from public.checklist_templates where name='Emergency Lighting Test') then
  with tpl as (
    insert into public.checklist_templates (category, area, name, frequency, due_time, sort_order)
    values ('health_safety','Fire Safety','Emergency Lighting Test','monthly','18:00',53)
    returning id)
  insert into public.checklist_items (template_id, sort_order, prompt, input_type, required)
  select id, v.ord, v.prompt, v.itype, v.req from tpl, (values
    (1,'All emergency light units tested (brief function test)','yes_no',true),
    (2,'All units illuminated correctly','yes_no',true),
    (3,'Any unit not working (describe, or leave blank)','text',false)
  ) as v(ord, prompt, itype, req);
end if;

if not exists (select 1 from public.checklist_templates where name='Fire Escape Routes & Exits') then
  with tpl as (
    insert into public.checklist_templates (category, area, name, frequency, due_time, sort_order)
    values ('health_safety','Fire Safety','Fire Escape Routes & Exits','weekly','18:00',54)
    returning id)
  insert into public.checklist_items (template_id, sort_order, prompt, input_type, required)
  select id, v.ord, v.prompt, v.itype, true from tpl, (values
    (1,'All escape routes clear and unobstructed','yes_no'),
    (2,'Exit signage visible / illuminated','yes_no'),
    (3,'All fire exit doors open freely','yes_no'),
    (4,'Assembly point sign visible and accessible','yes_no')
  ) as v(ord, prompt, itype);
end if;

if not exists (select 1 from public.checklist_templates where name='First Aid & Accident Book Check') then
  with tpl as (
    insert into public.checklist_templates (category, area, name, frequency, due_time, sort_order)
    values ('health_safety','Health & Safety','First Aid & Accident Book Check','monthly','18:00',55)
    returning id)
  insert into public.checklist_items (template_id, sort_order, prompt, input_type, required)
  select id, v.ord, v.prompt, v.itype, v.req from tpl, (values
    (1,'First aid kit(s) fully stocked and in date','yes_no',true),
    (2,'Accident book / reporting system accessible','yes_no',true),
    (3,'Nominated first aiders list up to date and displayed','yes_no',true),
    (4,'Items needing restocking (describe, or leave blank)','text',false)
  ) as v(ord, prompt, itype, req);
end if;

if not exists (select 1 from public.checklist_templates where name='COSHH / Chemical Storage Check') then
  with tpl as (
    insert into public.checklist_templates (category, area, name, frequency, due_time, sort_order)
    values ('health_safety','Health & Safety','COSHH / Chemical Storage Check','monthly','18:00',56)
    returning id)
  insert into public.checklist_items (template_id, sort_order, prompt, input_type, required)
  select id, v.ord, v.prompt, v.itype, true from tpl, (values
    (1,'All chemicals stored correctly and labelled','yes_no'),
    (2,'Safety data sheets (COSHH) available and up to date','yes_no'),
    (3,'Chemicals locked / restricted where required','yes_no'),
    (4,'PPE available for handling chemicals','yes_no')
  ) as v(ord, prompt, itype);
end if;

if not exists (select 1 from public.checklist_templates where name='Boiler Service Log') then
  with tpl as (
    insert into public.checklist_templates (category, area, name, frequency, due_time, sort_order)
    values ('health_safety','Health & Safety','Boiler Service Log','annual','18:00',57)
    returning id)
  insert into public.checklist_items (template_id, sort_order, prompt, input_type, required)
  select id, v.ord, v.prompt, v.itype, v.req from tpl, (values
    (1,'Annual boiler service completed by a qualified engineer','yes_no',true),
    (2,'Service certificate uploaded to Documents','yes_no',true),
    (3,'Any faults or remedial work identified (describe, or leave blank)','text',false)
  ) as v(ord, prompt, itype, req);
end if;

if not exists (select 1 from public.checklist_templates where name='Kitchen Extract Cleaning Log') then
  with tpl as (
    insert into public.checklist_templates (category, area, name, frequency, due_time, sort_order)
    values ('health_safety','Kitchen','Kitchen Extract Cleaning Log','six_monthly','18:00',58)
    returning id)
  insert into public.checklist_items (template_id, sort_order, prompt, input_type, required)
  select id, v.ord, v.prompt, v.itype, v.req from tpl, (values
    (1,'Kitchen extract system professionally cleaned (TR19-compliant)','yes_no',true),
    (2,'Cleaning certificate uploaded to Documents','yes_no',true),
    (3,'Any issues identified (describe, or leave blank)','text',false)
  ) as v(ord, prompt, itype, req);
end if;

end
$seed$;
