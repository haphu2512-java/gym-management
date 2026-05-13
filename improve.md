# Improve Plan

## Critical fixes
- Fix member create payload mapping in `memberService.createMember`:
  - Use `member_code` and `full_name` instead of `code` and `name`.
- Fix renew flow contract mismatch:
  - Update `Members.jsx` call site to match new signature `(memberId, renewalData)`.
- Fix SQL schema mismatch for payment verification:
  - Add `verified_by` and `verified_at` columns to `payment_logs` before policies/functions referencing them.

## High-priority quality fixes
- Remove duplicate log/payment writes from frontend after moving to atomic RPC.
- Fix date comparisons in renew flow by parsing DB date strings explicitly.
- Add integration validation for transaction RPC responses and error mapping.

## Cash handover improvements
- Formula now applied in Shifts:
  - `Tien ket ca du kien = TM hoi vien + TM nuoc - Chi`.
- Added `shift_expenses` persistence table and `expenseService`.
- Added `Chi` tab in Shifts page for adding and listing expense items by active shift.

## Testing checklist
- Test create member with TM and CK payment.
- Test renew member with TM and CK payment.
- Test verify payment only works for CK and unverified records.
- Test selling water with concurrent actions (2 users).
- Test cash handover formula with and without expense entries.
