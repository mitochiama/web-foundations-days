# Library API Design

A REST API for a library's **books** resource. Every response is JSON.

## Book fields

- `id` (number): unique identifier, set by the server
- `title` (string): required
- `author` (string): required
- `isbn` (string): the book's ISBN
- `publishedYear` (number): year of publication
- `copiesAvailable` (number): copies currently on the shelf

## Endpoints

### 1. List all books

- **Method:** GET
- **Path:** `/books`
- **Description:** Returns every book in the library.
- **Request body:** none
- **Success status:** 200 OK

### 2. Get one book

- **Method:** GET
- **Path:** `/books/{id}`
- **Description:** Returns the single book with the given id.
- **Request body:** none
- **Success status:** 200 OK

### 3. Create a book

- **Method:** POST
- **Path:** `/books`
- **Description:** Adds a new book to the library.
- **Example request body:**

```json
{
  "title": "Things Fall Apart",
  "author": "Chinua Achebe",
  "isbn": "978-0-385-47454-2",
  "publishedYear": 1958,
  "copiesAvailable": 3
}
```

- **Success status:** 201 Created

### 4. Update a book

- **Method:** PUT
- **Path:** `/books/{id}`
- **Description:** Replaces the details of an existing book.
- **Example request body:**

```json
{
  "title": "Things Fall Apart",
  "author": "Chinua Achebe",
  "isbn": "978-0-385-47454-2",
  "publishedYear": 1958,
  "copiesAvailable": 2
}
```

- **Success status:** 200 OK

### 5. Delete a book

- **Method:** DELETE
- **Path:** `/books/{id}`
- **Description:** Removes the book with the given id.
- **Request body:** none
- **Success status:** 204 No Content

### 6. List books by an author

- **Method:** GET
- **Path:** `/books?author={name}`, for example `/books?author=Chinua%20Achebe`
- **Description:** Returns only the books written by the given author.
- **Request body:** none
- **Success status:** 200 OK

## Error codes

### 400 Bad Request

The request is invalid or incomplete.

- **Example:** `POST /books` with no `title`, or with `publishedYear` sent as the text "nineteen fifty-eight" instead of a number.
- **Example response:** `{ "error": "title is required" }`

### 404 Not Found

The requested book does not exist.

- **Example:** `GET /books/9999` when no book has the id 9999. The same applies to `PUT` and `DELETE` on an id that doesn't exist.
- **Example response:** `{ "error": "Book with id 9999 not found" }`
