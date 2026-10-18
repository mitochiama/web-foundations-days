# TicketHub: Event Ticketing System Design

Status: working draft. Stages 1–2 cover the context, requirements, estimates,
API, and booking rules. Database and architecture details follow in later stages.
This is a proposed system, not an implemented or benchmarked service.

## 1. Context

TicketHub helps people discover concerts and events, select reserved seats,
pay, and access their tickets. It serves two million registered users.

The main challenge is a popular sale: 200,000 people compete for 20,000 seats
within ten minutes. The system must protect the booking database, handle
payment delays, provide a fair admission process, and prevent two people
from obtaining valid tickets for the same event seat.

## 2. Goals and non-goals

### Goals

- Let visitors browse events and inspect event-specific seat availability.
- Let authenticated users temporarily hold seats, pay, and view their tickets.
- Support one to four seats per order, retaining available seats when another
  requested seat is unavailable. Require confirmation of the final seats/price.
- Ensure each event seat has at most one valid confirmed booking.
- Keep the service responsive during normal use and control admission during
  a popular sale.
- Give clear feedback about queue position, hold expiry, payment state, and
  unavailable seats.

### Non-goals

- Ticket resale, auctions, dynamic pricing, and loyalty programmes.
- Event-organiser dashboards and venue seat-map editing.
- General-admission inventory without assigned seats.
- A complete cancellation/refund product workflow. Technical voids or refunds
  needed to resolve payment failures or late payment success remain in scope.

Event listings, seating plans, and prices are assumed to be prepared by a
trusted administrative process. All seats in an order belong to one event.
Four is a per-order limit; a separate per-account purchase quota is an open
product decision.

## 3. Requirements and estimates

### Functional requirements

1. List events and retrieve event details, including venue, start time, and price.
2. Show available, temporarily held, and sold seats for a particular event.
3. Authenticate buyers and restrict orders/tickets to their owners.
4. Hold the available subset of one to four requested seats and return the
   held seats, unavailable seats, current price, and original expiry time.
5. Start payment for an owned, valid hold and track its final outcome.
6. Confirm tickets only when payment is verified and seat ownership is durably
   committed. Browser redirects alone are not payment confirmation.
7. Release abandoned holds according to the booking/payment state rules.
8. Let buyers view their own confirmed tickets and order status.
9. Place excess sale traffic in a waiting room and admit buyers at a rate the
   booking service can safely handle.

### Non-functional requirements

All figures below are design targets that require testing.

| Concern                 | Requirement                                                                                                                                                                                                                                                                                                                      |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Speed                   | Event-browsing API p95 at most 300 ms and seat-hold API p95 at most 1 second for admitted requests under the planned load. p95 means 95% of requests complete within the target. Waiting-room delay and external payment completion are measured separately.                                                                     |
| Correctness             | Zero duplicate valid confirmed bookings for the same `(event_id, seat_id)`, including concurrent requests, retries, hold expiry, and delayed payment notifications.                                                                                                                                                              |
| Retry safety            | Repeating the same logical hold/payment operation must not create another reservation or charge; duplicate payment notifications must not issue duplicate tickets.                                                                                                                                                               |
| Fairness                | Admit buyers using a server-issued queue sequence in first-in, first-out order. Refreshing preserves position. Enforce one active queue entry and one active hold per account per event; checkout writes require valid admission. This is fairness between accounts, not proof that every account represents a different person. |
| Hold duration           | Holds last five minutes from their first successful creation, using authoritative database time. Refreshing, adding seats, and starting payment do not extend the deadline. An expired order cannot receive tickets; a late successful payment requires a void/refund.                                                           |
| Availability            | Target 99.9% monthly availability, with no planned maintenance during an advertised sale. A 30-day month allows approximately 43.2 minutes of unavailability.                                                                                                                                                                    |
| Durability and recovery | Preserve acknowledged confirmed bookings through a single database-node or availability-zone failure. Target automatic service recovery within 60 seconds; validate this with failover tests.                                                                                                                                    |
| Security                | Use HTTPS, ownership checks, and a payment provider's hosted payment collection. Store provider references rather than raw card details; protect queue and checkout endpoints against automated abuse.                                                                                                                           |
| Burst capacity          | Initial targets: 1,000 new waiting-room arrivals per second and 10,000 public page views per second, including cached pages. Limit checkout admission independently using measured database capacity. These are planning targets, not proven capacity or worst-case bounds.                                                      |

### Given workload

| Item                              | Assignment fact                            |
| --------------------------------- | ------------------------------------------ |
| Registered users                  | 2,000,000                                  |
| Normal daily visitors             | 50,000                                     |
| Page views per normal-day visitor | 10                                         |
| Normal daily ticket sales         | 5,000                                      |
| Popular-sale demand               | 200,000 people within the first 10 minutes |
| Popular event inventory           | 20,000 seats                               |

Registered-user count describes the account population, not simultaneous load.

### Normal-day estimates

```text
Seconds/day = 24 × 60 × 60 = 86,400
Daily visitors as a fraction of registered users = 50,000 / 2,000,000 = 2.5%

Page views/day = 50,000 × 10 = 500,000
Average page views/second = 500,000 / 86,400 = 5.79

Average visitor arrivals/second = 50,000 / 86,400 = 0.58
Average tickets sold/second = 5,000 / 86,400 = 0.0579
```

These are full-day averages. The assignment does not specify the busiest
normal-day hour. Page views are not individual HTTP requests: a page can
fetch several API resources and static files. Ticket counts are not order
counts unless every order contains exactly one ticket.

### Popular-sale estimates and comparison

```text
Sale window = 10 × 60 = 600 seconds
Average buyer arrivals during sale = 200,000 / 600 = 333.33 people/second
Demand per seat = 200,000 / 20,000 = 10 people per seat

If all seats sell during that window:
Ticket sales rate = 20,000 / 600 = 33.33 tickets/second
Compared with the normal-day ticket average:
(20,000 / 600) / (5,000 / 86,400) = 576 times
```

There are enough seats for at most 10% of the competing people if every
successful buyer obtains one seat. Failed attempts, retries, abandoned holds,
and unsuccessful payments still consume capacity even though they sell no
tickets.

Additional browsing assumption: popular-sale visitors also view ten pages
each. The assignment only gives that value for a normal day, so this is a
separate planning assumption:

```text
Popular-sale page views = 200,000 × 10 = 2,000,000
Average page views/second during sale = 2,000,000 / 600 = 3,333.33
Compared with the normal-day page-view average:
(2,000,000 / 600) / (500,000 / 86,400) = 576 times

Provisional short-burst factor = 3 times the sale-window average
Arrival target = (200,000 / 600) × 3 = 1,000 people/second
Public browsing target = (2,000,000 / 600) × 3 = 10,000 page views/second
```

The ten-minute averages are not instantaneous peak measurements. The 3×
factor is an explicit starting assumption, not a guarantee that traffic will
stay below it. Load tests must also include concentrated launch-time arrivals.
Seat polling, queue polling, asset requests, and retries need separate request
budgets when the architecture is defined.

These figures describe offered demand. A waiting room will limit the traffic
admitted to the booking database; it does not create more than 20,000 seats.

## 4. Proposed design

### 4.1 API conventions

- Use HTTPS and JSON. Resource IDs are server-generated positive integers;
  seat labels such as `A1` are display values scoped to an event.
- Use UTC timestamps, integer money amounts in the currency's smallest unit,
  and server-derived prices. The examples use USD cents with no added fees.
- Browsing events/seats is public. Queue, order, payment, and ticket routes
  require a verified bearer access token. Derive the user from that token;
  never accept a submitted owner ID. Other-owned orders return `404`.
- During a popular sale, creating a hold also requires a signed admission
  token bound to the account/event. Existing valid holds retain their editing
  permission until the original deadline; editing does not create a new queue place.
- Lists use cursor pagination with `limit` from 1–100, default 50. Return
  `{ "data": [], "next_cursor": null }` for an empty final page. Seat browsing
  can filter by section. Cursors are opaque and bound to the query/owner scope.
- Owner-specific responses use `Cache-Control: private, no-store`. Public seat
  maps may be briefly cached and are advisory; hold operations recheck the primary.
- One account can have one active `HOLDING` or `PAYMENT_PENDING` order per
  event. A different create request while it exists returns `409` with that
  owned order's ID; edit that hold rather than creating another one.
- Every buyer POST includes an `Idempotency-Key`: a random unique value for
  one logical operation. Reuse it when retrying that operation after a timeout.
  Authentication, input validation, and ownership checks still apply.

### 4.2 Endpoints

| Method | Path                                 | Purpose                                                                        | Success                          |
| ------ | ------------------------------------ | ------------------------------------------------------------------------------ | -------------------------------- |
| GET    | `/events`                            | Browse events using pagination.                                                | 200                              |
| GET    | `/events/{event_id}`                 | View one event's details.                                                      | 200                              |
| GET    | `/events/{event_id}/seats`           | View seats and indicative availability, optionally by section.                 | 200                              |
| POST   | `/events/{event_id}/queue-entries`   | Join the waiting room; reuse an existing active entry for this account/event.  | 201 new; 200 existing            |
| GET    | `/queue-entries/{entry_id}`          | Read an owned queue entry and obtain its admission token when admitted.        | 200                              |
| POST   | `/orders`                            | Create an order holding the available requested seats.                         | 201 if at least one seat is held |
| GET    | `/orders/{order_id}`                 | View an owned order, current seats, expiry, version, and payment state.        | 200                              |
| POST   | `/orders/{order_id}/seats`           | Add available requested seats to an owned editable hold.                       | 200                              |
| DELETE | `/orders/{order_id}/seats/{seat_id}` | Release that seat and return the updated order.                                | 200                              |
| DELETE | `/orders/{order_id}/hold`            | Cancel an editable hold and release its seats; preserve order history.         | 204                              |
| POST   | `/orders/{order_id}/payments`        | Confirm the current selection/price and start or resume its payment operation. | 202                              |
| GET    | `/me/tickets`                        | List the authenticated buyer's valid confirmed tickets.                        | 200                              |
| POST   | `/payment-webhooks`                  | Accept a signed provider notification into durable processing.                 | 200                              |

`201` includes a `Location` header for the new resource. `204` has no body.
The webhook uses provider signature verification rather than a buyer token.
Queue responses supply a polling interval; clients respect it and add jitter
so they do not all poll simultaneously.

### 4.3 Partial holds: the A1, A2, A3 example

Request headers: `Authorization: Bearer ...`, `Content-Type: application/json`,
`Admission-Token: ...` during the sale, and `Idempotency-Key: hold-example-01`.

`POST /orders` request:

```json
{
  "event_id": 101,
  "seat_ids": [601, 602, 603]
}
```

Suppose seats 601 and 602 are A1/A2 and available, while 603 is A3 and occupied.
Return `201 Created` with `Location: /orders/9001` after the partial hold commits:

```json
{
  "order_id": 9001,
  "event_id": 101,
  "status": "HOLDING",
  "version": 1,
  "outcome": "partial",
  "held_seats": [
    { "seat_id": 601, "label": "A1", "unit_price_minor": 7500 },
    { "seat_id": 602, "label": "A2", "unit_price_minor": 7500 }
  ],
  "unavailable_seats": [
    { "seat_id": 603, "label": "A3", "reason": "unavailable" }
  ],
  "currency": "USD",
  "total_minor": 15000,
  "expires_at": "2026-10-18T17:05:00Z"
}
```

The hold was first created at 17:00 UTC. The interface explains that A1/A2
are held, A3 is unavailable, and payment has not started. It offers adding a
replacement, explicitly continuing with two tickets, or cancelling.
`outcome` and `unavailable_seats` describe this request; `held_seats`, total,
version, and expiry describe the current order.

To add A4, send a new logical request with a new idempotency key to
`POST /orders/9001/seats`:

```json
{
  "seat_ids": [604]
}
```

If available, A4 joins A1/A2, the total becomes 22500 cents, and `version`
increments to 2. The expiry remains 17:05 UTC. If A4 is unavailable, return
`409` without changing A1/A2 or their deadline. The buyer can try another seat.

Hold rules:

- Validate the entire input before changing anything: one to four distinct,
  well-formed seat IDs, all belonging to the stated event. Invalid input is
  rejected; unavailable seats are handled as a normal business outcome.
- On initial creation, hold every available requested seat in a short database
  transaction. If all are available, `outcome` is `full`; if some are available,
  it is `partial`; if none are available, return `409` without creating an order.
- An addition preserves existing holds and adds the available requested seats.
  Return the complete current selection and the unavailable requested seats.
  If none can be added and none were already held by this order, return `409`
  with the original order unchanged. Already-held requested seats are harmless.
- Reject an addition whose union of existing/requested seat IDs exceeds four;
  do not silently choose which seats fit. Only explicit removal or cancellation
  releases the buyer's existing seats before expiry.
- Removing the final seat cancels the hold. Repeating an already-completed
  removal/cancellation is harmless. Mutations of paid or payment-pending orders
  return `409`; expired holds return `410`. GET still returns the order's state.
- Hold changes increment `version`. Payment confirms that exact version and
  total, protecting against a stale browser tab or another device's edits.

Database transactions will make each selected subset durable as one operation.
Partial business success does not mean that half of a database transaction
commits. Exact locking and constraints are specified in the next stage.

### 4.4 Payment confirmation and expiry

After displaying A1/A2/A4 and the total, the buyer explicitly confirms payment.
`POST /orders/9001/payments` includes a new idempotency key and:

```json
{
  "order_version": 2,
  "confirmed_total_minor": 22500,
  "currency": "USD"
}
```

1. Check the owner, unexpired hold, exact version, server-calculated amount,
   currency, and ownership of every held seat. Reject mismatches with `409`.
   Store the payment operation and change the order to `PAYMENT_PENDING` in a
   short transaction, freezing the selection and price.
2. Contact the provider outside the database transaction using the stored
   operation's stable provider idempotency key. Use hosted payment collection.
   Return `202` with `Location: /orders/9001`; the owned order exposes its hosted
   `checkout_url` when available. The buyer polls with server-supplied backoff.
3. A network timeout leaves the provider outcome unknown. Reconcile that same
   operation; do not start another payment or assume it failed. A duplicate
   payment request for the frozen order refers to its existing operation.
4. Verify webhook signatures using the raw body and the provider's verification
   library. Durably record the provider event ID before acknowledging receipt.
   Processing verifies the payment reference, amount, currency, and order;
   duplicate or out-of-order notifications cannot repeat or reverse a completed
   effect. Browser redirects do not prove payment success.
5. While the order is still eligible, confirmed payment changes it to `PAID`
   and confirms all seats in the frozen selection atomically. Issue one ticket
   per seat only after that transaction commits. If any seat cannot be confirmed,
   issue no tickets and arrange a full void/refund rather than silently selling
   a smaller selection.

The five-minute deadline also applies during payment. Expiry releases the
seats. A successful payment processed after expiry cannot reclaim seats:
record `REFUND_PENDING`, durably schedule a full void/refund, and transition to
`REFUNDED` after provider confirmation. The worker retries with a stable key.
This strict deadline can require a refund even if the charge happened just
before expiry but its confirmation arrived late; the interface must explain
the time limit. Unknown outcomes require reconciliation, not another charge.

Main order transitions:

```text
HOLDING -> PAYMENT_PENDING -> PAID
HOLDING -> CANCELLED or EXPIRED
PAYMENT_PENDING -> EXPIRED, or CANCELLED after confirmed terminal failure
EXPIRED or CANCELLED -> REFUND_PENDING -> REFUNDED (if a late charge succeeds)
```

Paid orders keep their seats. Buyers can edit/cancel only in `HOLDING`; a
terminally failed/expired order needs a new hold and, during the sale, a new
admission. A card retry within the provider's existing hosted flow may continue
before expiry; it does not create a new TicketHub payment operation.

### 4.5 Retry handling and errors

Persist idempotency results for at least 24 hours, scoped to user, method,
path, and key. The same key/body returns the recorded result; reusing a key
with different input gives `409`. Serialize concurrent uses of a key. An
operation still being processed returns `409` with code `operation_in_progress`
and `Retry-After`; retry using the same key. Accepted payment operations use
the documented `202` and order-status URL. Completed hold results are
historical receipts: replay never extends/recreates a hold; GET
the order for its current expiry and state. Record executed availability
conflicts too; a new selection attempt uses a new key.

Payment-operation references survive for the order's lifetime. Expired retry
records do not authorize a new provider operation for an uncertain or already
paid order. Durable retry/event records will be included in the data design.

| Status    | Meaning                                                                                                                                                              |
| --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 400       | Malformed input, duplicate seat IDs, wrong event, or more than four requested/current seats.                                                                         |
| 401       | Missing or invalid authentication.                                                                                                                                   |
| 403       | Sale admission is missing, invalid, or not yet granted.                                                                                                              |
| 404       | Resource does not exist or an order/queue entry belongs to another user.                                                                                             |
| 409       | No requested seats can be held, an active order already exists, stale confirmation, changed key input, an operation still running, or an incompatible order state.   |
| 410       | The hold has expired; retrieve its order status and start a new admitted hold if desired.                                                                            |
| 429       | Request limit exceeded; respect `Retry-After`.                                                                                                                       |
| 500 / 503 | Unexpected failure or temporary unavailability; never expose internal details. An already-started payment with an unknown outcome remains pending and is reconciled. |

Errors use `{ "error": { "code": "seats_unavailable", "message": "No requested seats are available.", "request_id": "example-request-id" } }`.
Availability conflicts may include unavailable seat IDs, but never another
buyer's identity. Structural/authentication failures do not create partial holds.

### 4.6 Remaining design work

- Define users, events, seats, orders, their multi-seat relationship, and
  durable operation/event records with the transaction and constraint rules.
- Draw the architecture and explain admission control, queues/workers,
  caches, payment reconciliation, and failure recovery.

API references: [HTTP semantics](https://www.rfc-editor.org/rfc/rfc9110.html),
[provider idempotency example](https://docs.stripe.com/api/idempotent_requests),
and [signed/duplicate webhook handling](https://docs.stripe.com/webhooks).
Stripe illustrates these integration patterns; provider selection is not final.

## 5. Alternatives considered

To be completed after the API, booking rules, and architecture are chosen.
Compare at least two meaningful alternatives and explain their costs.

## 6. Risks and open questions

- The whole crowd may arrive near the opening second; the assumed 3× burst
  allowance could be too small.
- Bots and multiple accounts can weaken account-based fairness.
- A seat map can become stale between viewing a seat and requesting a hold;
  the booking operation must make the authoritative availability decision.
- A payment notification can arrive late, twice, or out of order. Implement
  durable receipt processing and the specified expiry/refund policy correctly.
- Partial holds can leave separated seats. The buyer must see the exact seats
  and explicitly accept them; adjacency is not guaranteed by a group order.
- Decide the per-account event purchase quota, separately from the four-seat
  order limit, and monitor attempts to bypass fairness with multiple accounts.
- Confirm payment-provider capabilities and define recovery when a payment's
  outcome is temporarily unknown.
