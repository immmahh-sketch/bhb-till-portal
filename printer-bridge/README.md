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

## If the printer's IP changes

Bixolon SRP-275III: hold the Feed button while powering on to print a
self-test page with the current IP/MAC. Update `PRINTER_IP` at the top of
`kitchen-printer.js` if it changes (e.g. after a DHCP lease renewal — ask
whoever manages the network to give it a static/reserved IP to avoid this).
