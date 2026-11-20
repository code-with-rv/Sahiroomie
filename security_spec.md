# Sahiroomie Firestore Security Specification

## 1. Data Invariants
1. **Owner & PII Isolation**: `users/{userId}/private/info` (phone, email, age, KYC token, saved IDs) is strictly readable and writable only by `request.auth.uid == userId` (or verified admin). Public reads on `users/{userId}/public/profile` never expose phone, email, or Aadhaar/PAN numbers.
2. **Identity Integrity**: Every created `Listing.ownerId`, `ChatThread.initiatorId`, `ChatMessage.senderId`, and `SafetyReport.reporterId` must strictly equal `request.auth.uid`.
3. **Immutable Ownership & Timestamps**: `createdAt` and `ownerId`/`userId`/`initiatorId` cannot change on update; `createdAt == request.time` on create and `updatedAt == request.time` on update.
4. **Master Gate on Chat Messages**: Messages under `/chats/{chatId}/messages/{messageId}` require reading the parent `/chats/{chatId}` document to confirm `request.auth.uid in parent.data.participantIds` and `parent.data.status != 'blocked'`.
5. **Terminal Moderation Lock**: Once a `SafetyReport.status` transitions out of `'Pending'`, non-admins cannot mutate or reopen it.
6. **Verified Auth Guard**: All client Firestore writes require `request.auth != null && request.auth.token.email_verified == true`.

## 2. Dirty Dozen Adversarial Payloads (Must Return PERMISSION_DENIED)
1. **Unauthenticated read on private info**: `get /users/u1/private/info` with `auth = null` -> DENIED.
2. **Cross-user PII snooping**: `get /users/u1/private/info` as `u2` -> DENIED.
3. **Spoofed listing ownerId**: `create /listings/lst1` as `u2` with `ownerId: 'u1'` -> DENIED.
4. **Shadow field injection**: `create /users/u1/private/info` as `u1` with extra ghost field `isAdmin: true` -> DENIED (`hasOnly` check).
5. **Fake timestamp backdating**: `create /listings/lst1` with `createdAt` != `request.time` -> DENIED.
6. **Oversized photo/bio payload**: `create /users/u1/public/profile` with `displayName.size() > 80` -> DENIED.
7. **Unverified email admin spoof**: `update /reports/r1` with `token.email == 'ravikumar2012002@gmail.com'` and `email_verified: false` -> DENIED.
8. **Chat snooping via list**: `list /chats` without `participantIds` containing `request.auth.uid` -> DENIED.
9. **Writing to another chat thread**: `create /chats/c1/messages/m1` as `u3` not in `c1.participantIds` -> DENIED.
10. **Non-owner listing update**: `update /listings/lst1` as `u2` when `ownerId == 'u1'` -> DENIED.
11. **Mutating terminal listing status**: `update /listings/lst1` after `status == 'removed'` -> DENIED.
12. **Invalid document ID injection**: `create /listings/bad$id/with/spaces` -> DENIED (`isValidId` regex guard).
