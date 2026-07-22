# Privacy inventory

`store/privacy-declarations.json` is the source of truth for App Store, Google Play, and in-app privacy declarations. CI verifies that tracking, advertising, and behavioral analytics remain disabled, that every processed field has a purpose and retention rule, and that the deletion endpoint and iOS Privacy Manifest remain present.

## Processing summary

| Data | Purpose | Public | Retention |
| --- | --- | --- | --- |
| Display name, score, mode, island scope | Public leaderboard | Yes | Until the player deletes their data |
| SHA-256 player-token hash | Ranking ownership, history, deletion | No | Until the player deletes their data |
| Salted network-abuse hash | Submission rate limiting | No | At most 15 minutes |
| Verified game session | Reject replayed or implausible submissions | No | Until expiry, then the next scheduled cleanup |

The raw player token remains in SecureStore on native platforms or local storage on the web. The API stores only its SHA-256 owner hash. The rate-limit hash uses a deployment secret and is not reused as the ranking owner identifier. A personalized ranking response adds only `isCurrentPlayer: true` to the requesting player's own row; no owner hash or stable public identifier is returned.

## Release check

Before changing store declarations, compare them field by field with `store/privacy-declarations.json`, the in-app policy, and the current dependencies. Run `npm run verify:privacy`, exercise account deletion against production with the synthetic monitor identity, and retain the store-console review record with the release.
