# SnapShare Scaling Plan

SnapShare is a photo-sharing app where users upload photos and scroll a feed of photos from the people they follow.

## 1. Assumptions

- 10,000,000 registered users
- 10% of them are active each day
- Each active user uploads 1 photo per day
- Each active user views 50 feed pages per day
- An average photo is 2 MB, and each photo also gets a 50 KB thumbnail
- One day has 86,400 seconds
- Peak traffic is 5 times the average
- Storage is counted in decimal units (1 TB = 1,000,000 MB)
- Photos are kept forever (nothing is deleted)

**Daily active users (DAU):** 10,000,000 × 10% = **1,000,000 users per day**

## 2. Estimates

### Uploads per second

- Uploads per day: 1,000,000 users × 1 photo = 1,000,000 photos
- Average: 1,000,000 ÷ 86,400 ≈ **12 uploads per second** (11.6)
- Peak (5×): ≈ **58 uploads per second**

### Feed views per second

- Feed views per day: 1,000,000 users × 50 views = 50,000,000 views
- Average: 50,000,000 ÷ 86,400 ≈ **579 feed views per second**
- Peak (5×): ≈ **2,900 feed views per second** (2,894)

### Photo storage per year

- Each photo uses 2 MB + 50 KB thumbnail = 2.05 MB
- Per day: 1,000,000 photos × 2.05 MB = 2.05 TB
- Per year: 2.05 TB × 365 ≈ **748 TB** (about 0.75 PB)
  - Original photos: 2 TB × 365 = 730 TB
  - Thumbnails: 0.05 TB × 365 = 18.25 TB

  ## 3. Read-heavy or write-heavy?

SnapShare is **read-heavy**. There are 50,000,000 feed views per day but only 1,000,000 uploads, so reads outnumber writes about 50 to 1.

What this means for the design:

- Most of the effort should go into making reads fast and cheap: a CDN, a cache and a read replica.
- Writes are rare (about 58 per second at peak), so a single primary database can handle them at this size.
- To grow, we add more caches and read replicas first, rather than complicating how we write data.

## 4. Why photos are not stored in the database

A database is built for small, structured records, not large files. If we stored photos in it:

- It would grow by about 730 TB per year, making backups, replication and recovery very slow.
- Database storage is much more expensive than file storage.
- Every photo view would use a database connection, taking capacity away from important queries.
- A database cannot serve files as quickly or cheaply as a CDN.

Instead, the photo files go in **object storage**, which is cheap, very durable and made for large files. The database only keeps the **metadata**: the photo id, the user id, the storage location of the file, a caption and the time it was uploaded. Photos are delivered to users through the CDN.

## 5. Architecture diagram

```
                        +----------------------------+
                        |  Users (phones, browsers)  |
                        +----------------------------+
            +--------------------------+------------+
            | photo downloads                       | feed / upload
            v                                       v
+----------------------+                 +---------------------+
|         CDN          |                 |    Load balancer    |
+----------------------+                 +---------------------+
            |                                       |
            | cache miss                  +---------+---------+
            v                             |                   |
+----------------------+                  v                   v
|    Object storage    | original +--------------+    +--------------+
| (photos, thumbnails) |<---------|  App server  |    |  App server  |
+----------------------+          +--------------+    +--------------+
            ^                             |                   |
            |                             +---------+---------+
            |                                       |
            |                  +--------------------+------------------+
            |                  |                    |                  |
            |                  v                    v                  v
            |             +---------+    +--------------------+  +----------+
            |             |  Cache  |    | Database (primary) |  |  Queue   |
            |             +---------+    +--------------------+  +----------+
            |                                       | copies data      |
            |                                       |                  | job
            |                                       v                  v
            |                            +--------------------+  +----------+
            |                            |    Read replica    |  |  Worker  |
            |                            +--------------------+  +----------+
            |                                                          |
            +----------------------------------------------------------+
                        worker saves the thumbnail
```

## 6. What each component does

- **CDN:** serves photos from servers close to the user, so feeds load quickly and photo downloads don't overload our own servers.
- **Load balancer:** spreads incoming requests across many app servers, so no single server is overwhelmed and a failed server is skipped.
- **App servers:** run SnapShare's logic (login, uploads, building the feed), and we can add more of them as traffic grows.
- **Cache:** keeps frequently requested data, such as ready-made feeds and photo details, in fast memory so most reads never reach the database.
- **Database (primary):** reliably stores users, follows and photo metadata, and handles all the writes.
- **Read replica:** a copy of the database that answers read queries, so heavy read traffic doesn't slow down the primary.
- **Object storage:** holds the large photo files cheaply and safely, so they stay out of the database.
- **Queue:** holds thumbnail jobs, so uploads can finish quickly and jobs wait safely during busy periods.
- **Worker:** takes jobs from the queue and creates the 50 KB thumbnails in the background, so slow image processing never blocks the user.

## 7. Upload flow

1. The user chooses a photo and taps upload. The request reaches the **load balancer**.
2. The load balancer sends it to a healthy **app server**.
3. The app server checks that the user is logged in and that the file is valid (a real image, within the size limit).
4. The app server saves the original photo in **object storage**, which returns its storage location.
5. The app server writes a new row to the **primary database**: photo id, user id, storage location, upload time and a "processing" status.
6. The app server puts a "create thumbnail" job, containing the photo id, on the **queue**.
7. The app server replies "upload successful" to the user straight away, without waiting for the thumbnail.
8. A **worker** takes the job from the queue, downloads the original from object storage, creates a 50 KB thumbnail and saves it back to object storage.
9. The worker updates the database row to "ready" and clears the affected feed entries in the **cache**, so followers see the new photo.
10. When followers next load their feed, it comes from the cache or the read replica, and the thumbnails are delivered through the **CDN**.

## 8. Trade-offs

- **Cache: speed versus fresh data.** The cache makes feeds fast and protects the database, but cached feeds can be a few seconds out of date, so a new photo might not appear instantly. We also have to decide when to clear cached data, which adds complexity.
- **Read replica: scale versus consistency.** A replica lets us handle many more reads, but it copies data from the primary with a small delay. A user could upload a photo and briefly not see it if their next read hits a replica that has not caught up yet.
- **Queue and worker: a fast upload versus instant thumbnails.** The user gets a quick "success" reply, but the thumbnail only appears after the worker has processed the job, so we may show a placeholder for a few seconds. It also adds another part of the system to run and monitor.
