-- One-time setup: placeholder "system" user used as the chat sender for
-- public Contact-us form submissions routed to the assigned escrow officer.
-- No row is ever created in "account" for this user, so there is no password
-- or OAuth credential — it cannot sign in. "banned" is set as a second,
-- belt-and-braces guard against Better Auth login. "archived" hides it from
-- the default admin Users list and the chat "New chat" directory, while
-- still resolving normally as a message sender/peer profile in chat queries
-- (which do not filter on archived).
--
-- Safe to re-run: ON CONFLICT (id) DO NOTHING.

INSERT INTO "user" (
  id, name, email, email_verified, verified, archived, banned, role,
  points, points_lifetime, points_reserved
) VALUES (
  'sys-website-contact-form',
  'Website Contact Form',
  'website-contact-form@system.gemxpremium.internal',
  true, true, true, true, 'user',
  0, 0, 0
)
ON CONFLICT (id) DO NOTHING;
