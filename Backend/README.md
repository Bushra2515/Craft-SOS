# Craft-SOS — Models Reference

## Files

| File | Mongoose Model | Collection |
|---|---|---|
| `User.js` | `User` | `users` |
| `Post.js` | `Post` | `posts` |
| `Notification.js` | `Notification` | `notifications` |
| `Challenge.js` | `Challenge` | `challenges` |

---

## Relationships at a glance

```
User ──────────────────────────────────────────────────────────
  │  friends[]          → User (friendSchema: user + since)
  │  friendRequests[]   → User
  │  blockedUsers[]     → User
  │  badges[]           → String IDs matched to BADGES catalogue
  └──────────────────────────────────────────────────────────

Post ──────────────────────────────────────────────────────────
  │  author             → User
  │  saves[]            → User  (bookmarks)
  │  resolvedBy         → User
  │  replies[]          (embedded replySchema)
  │    └── author       → User
  └──────────────────────────────────────────────────────────

Notification ──────────────────────────────────────────────────
  │  recipient          → User
  │  sender             → User  (null for system notifs)
  │  relatedPost        → Post  (optional)
  └──────────────────────────────────────────────────────────

Challenge ─────────────────────────────────────────────────────
  │  participants[]     → User
  │  createdBy          → User  (null if platform-seeded)
  └──────────────────────────────────────────────────────────
```

---

## Post types

| Value | Meaning |
|---|---|
| `sos` | Distress call — user needs urgent help |
| `tut` | Tutorial — sharing knowledge |
| `com` | Community — discussion / question |
| `res` | Resource — tool, link, or template |

## Post statuses

| Value | Meaning |
|---|---|
| `active` | Open and visible |
| `resolved` | SOS marked as solved by the author |
| `closed` | Removed by admin / moderator |

## Notification types

| Value | Triggered when |
|---|---|
| `reply` | Someone replies to your post |
| `helped` | Your reply is marked helpful |
| `badge` | You earn a new badge |
| `sos` | New SOS matches your hobbies |
| `follow` | Friend request sent / accepted |
| `milestone` | Views or points milestone hit |
| `system` | Platform announcement |

## Badge IDs (stored in `User.badges[]`)

| ID | Label |
|---|---|
| `first-post` | First Post |
| `first-help` | First Helper |
| `helper-10` | Problem Solver |
| `helper-50` | Community Pillar |
| `helper-100` | Verified Expert |
| `tutorial-5` | Author |
| `tutorial-20` | Published Author |
| `streak-7` | 7-Day Streak |
| `top-responder` | Top Responder |
| `mentor` | Mentor |
| `early-adopter` | Early Adopter |
| `first-responder` | First Responder |

---

## How to import

```js
const User         = require("./models/User");
const Post         = require("./models/Post");
const Notification = require("./models/Notification");
const Challenge    = require("./models/Challenge");
```
