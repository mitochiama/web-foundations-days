-- School database for Day 6 (SQLite)

PRAGMA foreign_keys = ON;

-- Drop in this order so the script can be re-run safely
DROP TABLE IF EXISTS enrolments;
DROP TABLE IF EXISTS courses;
DROP TABLE IF EXISTS students;

-- 1. Tables

CREATE TABLE students (
    student_id INTEGER PRIMARY KEY AUTOINCREMENT,
    name       TEXT NOT NULL,
    email      TEXT NOT NULL UNIQUE
);

CREATE TABLE courses (
    course_id INTEGER PRIMARY KEY AUTOINCREMENT,
    title     TEXT NOT NULL,
    credits   INTEGER NOT NULL
);

CREATE TABLE enrolments (
    enrolment_id INTEGER PRIMARY KEY AUTOINCREMENT,
    student_id   INTEGER NOT NULL,
    course_id    INTEGER NOT NULL,
    grade        INTEGER CHECK (grade BETWEEN 0 AND 100),
    FOREIGN KEY (student_id) REFERENCES students (student_id),
    FOREIGN KEY (course_id) REFERENCES courses (course_id),
    UNIQUE (student_id, course_id)
);

-- 2. Sample data

INSERT INTO students (name, email) VALUES
    ('Amina Hassan', 'amina.hassan@example.com'),
    ('Brian Otieno', 'brian.otieno@example.com'),
    ('Cynthia Wanjiru', 'cynthia.wanjiru@example.com'),
    ('David Kamau', 'david.kamau@example.com');

INSERT INTO courses (title, credits) VALUES
    ('Web Foundations', 3),
    ('Databases', 4),
    ('JavaScript Basics', 3);

INSERT INTO enrolments (student_id, course_id, grade) VALUES
    (1, 1, 78),
    (1, 2, 85),
    (2, 1, 64),
    (2, 3, NULL),
    (3, 1, 90),
    (3, 3, 72);


    -- 3. Queries

-- Query 1: all courses for one student (by name)
SELECT c.title, c.credits, e.grade
FROM enrolments e
JOIN students s ON e.student_id = s.student_id
JOIN courses c ON e.course_id = c.course_id
WHERE s.name = 'Amina Hassan';

-- Query 2: all students on one course
SELECT s.name, s.email, e.grade
FROM enrolments e
JOIN students s ON e.student_id = s.student_id
JOIN courses c ON e.course_id = c.course_id
WHERE c.title = 'Web Foundations';

-- Query 3: number of students per course
SELECT c.title, COUNT(e.enrolment_id) AS student_count
FROM courses c
LEFT JOIN enrolments e ON c.course_id = e.course_id
GROUP BY c.course_id, c.title;

-- Query 4: students who have no enrolments
SELECT s.student_id, s.name, s.email
FROM students s
LEFT JOIN enrolments e ON s.student_id = e.student_id
WHERE e.enrolment_id IS NULL;

-- Query 5: update one enrolment's grade (Brian Otieno, JavaScript Basics)
UPDATE enrolments
SET grade = 88
WHERE student_id = 2 AND course_id = 3;

-- Check the update worked
SELECT s.name, c.title, e.grade
FROM enrolments e
JOIN students s ON e.student_id = s.student_id
JOIN courses c ON e.course_id = c.course_id
WHERE s.student_id = 2;