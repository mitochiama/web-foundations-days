# School Database Design

This database stores students, the courses they take, and their grades.

## Tables

### students

Stores one row for each student.

- `student_id`: unique number that identifies the student (primary key)
- `name`: the student's full name (required)
- `email`: the student's email address (required and unique, so two students cannot share one)

### courses

Stores one row for each course the school offers.

- `course_id`: unique number that identifies the course (primary key)
- `title`: the name of the course (required)
- `credits`: how many credits the course is worth (required)

### enrolments

Stores one row each time a student is enrolled on a course. It links the other two tables and holds the grade.

- `enrolment_id`: unique number for the enrolment (primary key)
- `student_id`: which student (foreign key to `students`)
- `course_id`: which course (foreign key to `courses`)
- `grade`: the mark from 0 to 100, left empty until the student is graded
- A `UNIQUE (student_id, course_id)` rule stops the same student being enrolled on the same course twice.

## Relationships

- **One student to many enrolments (one-to-many):** one student can have many enrolments, but each enrolment belongs to one student.
- **One course to many enrolments (one-to-many):** one course can have many enrolments, but each enrolment belongs to one course.
- **Students to courses (many-to-many):** a student can take many courses, and a course can have many students.

A relational database cannot store a many-to-many relationship directly, because there is no sensible way to put a list of courses in a single student column. A join table solves this. The `enrolments` table has one row for each student-and-course pair, so the many-to-many relationship becomes two one-to-many relationships. It is also the natural place to store information about the pairing itself, such as the grade.

## Index

I would add an index on the `course_id` column of `enrolments`:

```sql
CREATE INDEX idx_enrolments_course_id ON enrolments (course_id);
```

Queries such as "all students on one course" and "number of students per course" look up enrolments by course. The `UNIQUE (student_id, course_id)` rule already gives fast lookups by student, but not by course. As the number of enrolments grows, an index on `course_id` lets the database jump to the right rows instead of reading the whole table.

## SQL or NoSQL?

I would choose SQL for this system. The data is structured and has clear relationships between students, courses and enrolments, and a relational database can enforce rules about it directly: unique emails, no duplicate enrolments, and foreign keys that stop an enrolment pointing at a student or course that does not exist. Questions such as "how many students are on each course" or "which students have no enrolments" are natural in SQL using joins and grouping. SQL databases also support transactions, which keeps records such as grades consistent. NoSQL would be a better fit if the data had no fixed shape, or needed to scale across huge numbers of servers, and a school system does not have those needs.
