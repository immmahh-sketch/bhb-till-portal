# Team Training: what we train, who, and why

**The 78 BHB 10-minute trainers** (BHB-10MT-01 to 78, from `Z:\Office\H&S minute trainers`) are now the modules in the Team Training tile. Each trainer is one module of 10 to 15 minutes on the phone: a few slides teaching what the trainer says, then the trainer's own 10 questions (pass mark 8 of 10, repeat if less). The "For:" line on each trainer decides which roles get it: about 30 are for everyone and the rest go to kitchen, bar, front of house, housekeeping, maintenance, weddings and events, office, or managers. The original source (parsed) is in `source/trainers.json`; the answer check is `fidelity.py`; `CHECKS-FOR-GM.md` lists everything that should be confirmed; `SITE-NOTES.md` lists the venue facts the modules leave to "your manager".

The earlier 20 general modules are kept in `sessions/archive/` (with their legal review notes) but are not in the tile, as the trainers cover the same topics.

**Rollout.** Issue modules about one at a time rather than all at once, as the paper programme did (one trainer a week). In Training record > Settings, "Spread the rollout" plans every unissued module in order so no role gets more than one at a time (about 58 steps at a week each), and each module has an "issue on" date you can set by hand. A module is due 7 days after it goes out.

## How the record works
- **Roles, not choices.** Each person is given one or more **roles** by a manager (Training record > tap their name): front of house, bar, kitchen, housekeeping, maintenance, weddings and events, office and admin, managers. Staff are never asked what they do; they simply see their list. A person with no role set sees only the modules everyone does, and the page tells them their role has not been set.
- **Which modules a role does** is set in Training record > Settings (a tick grid, with an "Everyone" column). The defaults are the audiences in the table above, and managers also get the food, allergen, licensing and conflict modules.
- **Issue** a module in Settings. From that day everyone it applies to has **7 days** to pass it (a new starter has 7 days from their start date). The number of days can be changed per module.
- **A completed module leaves the person's list.** It comes back as **Due** two weeks before its renewal date, and becomes **Overdue** on that date. The renewal date is the last pass plus the module's renewal months (12 by default, changeable per module in Settings).
- **Re-issue** makes everyone do a module again (use it when the content changes). A pass made before a module was re-issued does not count.
- **Overdue** is filterable in the record, and **Overdue report** gives a printable list grouped by role to hand to the managers.
- An email goes to anyone overdue every morning, at most once a week each, with a summary to the admins. The switch is in Settings.
- Every attempt is stored, pass or fail, with the score and time taken.
