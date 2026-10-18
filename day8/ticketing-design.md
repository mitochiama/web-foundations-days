# TicketHub: Event Ticketing System Design

Status: working draft. Stage 1 completes the context, scope, requirements,
and estimates. The remaining design sections will be completed in later stages.
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
trusted administrative process. The order-size limit will be chosen before
the API and data model are finalised.

## 3. Requirements and estimates

### Functional requirements

1. List events and retrieve event details, including venue, start time, and price.
2. Show available, temporarily held, and sold seats for a particular event.
3. Authenticate buyers and restrict orders/tickets to their owners.
4. Create a temporary seat hold and return its server-defined expiry time.
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
| Hold duration           | A provisional unpaid hold lasts five minutes, measured using authoritative server/database time. Refreshing does not extend it. Payment-in-progress and late-payment handling must be specified before the design is complete.                                                                                                   |
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

To be completed in the next stages:

- API: browsing events, viewing seats, holding seats, paying, and viewing tickets.
- Data model: at least users, events, seats, and orders, with keys and relationships.
- Booking correctness: transactions, constraints, hold expiry, payment retries,
  and delayed payment notifications.
- Architecture: diagram, component responsibilities, admission control, and
  failure handling for the popular sale.

## 5. Alternatives considered

To be completed after the API, booking rules, and architecture are chosen.
Compare at least two meaningful alternatives and explain their costs.

## 6. Risks and open questions

- The whole crowd may arrive near the opening second; the assumed 3× burst
  allowance could be too small.
- Bots and multiple accounts can weaken account-based fairness.
- A seat map can become stale between viewing a seat and requesting a hold;
  the booking operation must make the authoritative availability decision.
- A payment notification can arrive after a hold expires or be delivered more
  than once; the final design must resolve this without duplicate tickets.
- Decide whether one order contains one seat or supports a small group of seats.
- Confirm payment-provider capabilities and define recovery when a payment's
  outcome is temporarily unknown.
