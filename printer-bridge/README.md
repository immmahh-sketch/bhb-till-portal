# Kitchen printer bridge

Prints real room-service/outside-table orders to the physical Bixolon
SRP-275IIIC kitchen printer (192.168.100.134:9100 on the pub's LAN).

Browsers can't open raw TCP sockets, so the guest app and portal can't print
directly — this small script fills that gap by running on any PC on the same
network as the printer, polling Supabase for new kitchen `print_jobs`, and
sending each one to the printer as ESC/POS bytes.

## Run it

```
node kitchen-printer.js
```

Needs Node 18+ (uses the built-in `fetch`). Leave it running in a terminal
window on a PC that's always on the pub's WiFi/LAN — closing the window stops
printing. Ctrl+C to stop.

## What it does

Every 4 seconds it checks for `print_jobs` rows where
`destination = 'kitchen'` and `status = 'pending'`, prints each one, then
marks it `printed` — the same status the portal's virtual-printer "Mark
printed" button sets, so the two stay in sync and a job never prints twice.

The bar destination still only shows on the portal's virtual printer screen —
this script only touches `destination = 'kitchen'` jobs. Point a second copy
at the bar printer's IP (and filter on `destination=eq.bar`) once there's a
physical bar printer to wire up.

## Bar tickets: logo + guest sign-off

Only bar tickets get the Black Horse Beamish logo at the top and a
Room Number / Name / Signed sign-off section at the bottom (kitchen tickets
stay plain) — see `ticket.js`'s `buildTicket(job, opts)`. Until there's a
dedicated bar printer, `print-bar-test.js` sends a sample bar-formatted
ticket straight to the one printer we have, without touching the live
`print_jobs` queue.

The logo itself is pre-rendered to raw ESC/POS bytes at
`assets/bar-logo-escstar.bin` — regenerate it with
`python3 generate-logo-assets.py` if `app/logo-dark.png` ever changes. It
uses the older `ESC *` bit-image command rather than the more common
`GS v 0` (unsupported on this printer) or Bixolon's own NV bit image
commands `FS q`/`FS p` (supported, but produced corrupted output on this
unit for reasons that didn't match the documented byte layout) — see
`generate-logo-assets.py`'s docstring and `manual_extract.txt` for the full
story. Keep the logo narrow (180 dots here) — wider was confirmed working
data-wise but visibly overflowed the receipt.

## If the printer's IP changes

Bixolon SRP-275III: hold the Feed button while powering on to print a
self-test page with the current IP/MAC. Update `PRINTER_IP` at the top of
`kitchen-printer.js` if it changes (e.g. after a DHCP lease renewal — ask
whoever manages the network to give it a static/reserved IP to avoid this).
