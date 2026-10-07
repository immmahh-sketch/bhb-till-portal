# Wedding app: messages and photos with the events team (API contract)

## The couple's app (`wedding/index.html`): calls `wedding-api`
Use the app's existing `callFn("wedding-api", { token: S.token, action, payload })`. Errors: HTTP 400 `{ error }` with a sentence safe to show.
A back-office "view as the couple" session can read, but the server refuses writes (the error text is safe to show): hide the composer and the upload buttons in that mode.

* `chat.list` { markRead?: bool } -> `{ messages: [{ id, side:'couple'|'team', body, sender_name, source:'app'|'portal'|'whatsapp', created_at, read }], unread }`. `markRead:true` marks the team's messages read (send it when the chat is open and visible).
* `chat.unread` {} -> `{ unread: n }` (team messages the couple has not opened; for a dot on the menu and the home page, poll about once a minute).
* `chat.send` { body } -> `{ message }` (1 to 2000 characters; at most 30 an hour).
* `teamphotos.list` {} -> `{ photos: [{ id, from_side:'couple'|'team', caption, url, added_by_name, created_at, mine }] }` (`url` is a signed link valid for an hour; newest first; `mine` = added by the couple).
* `teamphotos.start` { mime, bytes } -> `{ id, path, mime, upload_url }`. Then `PUT` the picture bytes to `upload_url` (the same way the app's photo album uploads do), then
* `teamphotos.save` { id, path, mime, bytes, caption } -> `{ photo }` (send back the `id` and `path` from start). JPEG/PNG/WebP only, 12 MB at most: shrink phone photos first (longest side 1600px, JPEG 0.85).
* `teamphotos.caption` { id, caption } and `teamphotos.delete` { id } work on the couple's own photos only.

## The back office (`wedding-admin.html`): calls `wedding-admin` with the page's existing `call(action, payload)` (shared password)
Include `staff_email` (the portal login, `sessionStorage.bhb_staff_email`) in the payload of anything that writes, so replies carry the person's first name. `id` below is always the WEDDING id.
* `chat.unread` {} -> `{ unread: [{ wedding_id, count, last_at, last_body }] }` (couple messages nobody on the team has opened; for badges in the wedding list).
* `chat.thread` { id } -> `{ messages, unread }` and marks the couple's messages as read by the team (call it when the thread is opened).
* `chat.reply` { id, body, staff_email } -> `{ message }` (the couple sees it in their app, and is emailed if they have not been emailed in the last 30 minutes; the staff WhatsApp phones are told too).
* `teamphotos.list` { id } -> `{ photos }` (same shape; `mine` = added by the team).
* `teamphotos.start` { id, mime, bytes } -> `{ id: photoId, path, mime, upload_url }`; PUT the bytes; then `teamphotos.save` { id, photo_id: <the id from start>, path, mime, bytes, caption, staff_email } -> `{ photo }` (the couple is emailed, at most every 30 minutes).
* `teamphotos.caption` { id, photo_id, caption }, `teamphotos.delete` { id, photo_id } (the team can change or remove any photo).
* `wa.get` {} -> `{ settings:{ enabled, phone_number_id, template_name, template_lang, relay_numbers:[{number,name}] }, token_set, verify_set, secret_set, webhook_url }` and `wa.save` { enabled, phone_number_id, template_name, template_lang, relay_numbers, staff_email } -> `{ settings }`: the WhatsApp link settings (see below).

## How the WhatsApp link works (for the settings panel text)
A couple's message is saved, emailed to events@ (at most every 10 minutes per wedding) and sent by WhatsApp from the venue's WhatsApp Business number to each team phone listed in the settings. A member of the team answers by swiping to reply to that WhatsApp message; their reply appears in the couple's app (and in the back office) as a team message from them. Someone who did not swipe can start the message with the end of the event reference, like `2071: Thank you!`. Replies typed in the back office are shown in the app and also sent to the team phones so everyone sees them. WhatsApp only lets a business start a free-text chat with someone who has messaged the number in the last 24 hours, so each team member should send "hi" to the number now and then; otherwise the approved template is used.
Setup, in order: (1) in Meta Business Suite add a WhatsApp Business Platform phone number that is not already used in the WhatsApp app (a new SIM or a landline) and note its **Phone number ID**; (2) create and get approved a Utility message template (suggested name `wedding_message`, English UK, body `New message from {{1}}: {{2}}`); (3) in Supabase secrets set `WHATSAPP_VERIFY_TOKEN` (any long phrase) and `WHATSAPP_APP_SECRET` (the Meta app secret), plus `WHATSAPP_TOKEN` if the existing Meta token has no WhatsApp permission; (4) in the Meta app, WhatsApp > Configuration: Callback URL = `webhook_url` from `wa.get`, Verify token = the phrase from step 3, and subscribe to the `messages` field; (5) fill in the panel and switch it on.
