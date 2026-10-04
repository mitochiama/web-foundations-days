let notes = [
  { id: 1, text: "Buy milk and bread", category: "personal" },
  { id: 2, text: "Finish the Day 3 assignment", category: "study" },
  { id: 3, text: "Email the project report to Grace", category: "work" },
  { id: 4, text: "Revise JavaScript arrays", category: "study" },
  { id: 5, text: "Call mum", category: "personal" },
];

const CATEGORIES = ["personal", "work", "study"];
function searchNotes(word) {
  const search = word.toLowerCase();
  return notes.filter((note) => note.text.toLowerCase().includes(search));
}
function longestNote() {
  if (notes.length === 0) {
    return null;
  }

  let longest = notes[0];
  for (const note of notes) {
    if (note.text.length > longest.text.length) {
      longest = note;
    }
  }
  return longest;
}
function countByCategory() {
  const counts = {};
  for (const note of notes) {
    counts[note.category] = (counts[note.category] || 0) + 1;
  }
  return counts;
}
function getSummary() {
  const counts = countByCategory();
  const total = notes.length;
  const noun = total === 1 ? "note" : "notes";

  if (total === 0) {
    return `0 ${noun}.`;
  }

  const parts = [];
  for (const category of CATEGORIES) {
    if (counts[category]) {
      parts.push(`${counts[category]} ${category}`);
    }
  }
  return `${total} ${noun}: ${parts.join(", ")}.`;
}
function normalizeText(text) {
  return text.trim().toLowerCase().replace(/\s+/g, " ");
}

function isDuplicate(text) {
  const target = normalizeText(text);
  return notes.some((note) => normalizeText(note.text) === target);
}
function addNote(text, category) {
  if (typeof text !== "string") {
    console.log("Not added: text must be a string.");
    return false;
  }

  const cleaned = text.trim();

  if (cleaned.length < 1 || cleaned.length > 200) {
    console.log("Not added: text must be 1 to 200 characters.");
    return false;
  }

  if (isDuplicate(cleaned)) {
    console.log("Not added: a note with this text already exists.");
    return false;
  }

  if (!CATEGORIES.includes(category)) {
    console.log("Not added: category must be personal, work or study.");
    return false;
  }

  const newId = notes.length > 0 ? Math.max(...notes.map((note) => note.id)) + 1 : 1;
  notes.push({ id: newId, text: cleaned, category: category });
  return true;
}
// ---------- Tests ----------

// searchNotes
console.log(searchNotes("JAVASCRIPT")); // [ { id: 4, text: "Revise JavaScript arrays", category: "study" } ]
console.log(searchNotes("xyz"));        // [] (no matches)
console.log(searchNotes("the").length); // 2 (notes 2 and 3)

// longestNote
console.log(longestNote()); // { id: 3, text: "Email the project report to Grace", category: "work" }

// countByCategory
console.log(countByCategory()); // { personal: 2, study: 2, work: 1 }

// getSummary
console.log(getSummary()); // "5 notes: 2 personal, 1 work, 2 study."

// Edge cases using an empty list and a one-note list
const savedNotes = notes; // keep the full list safe

notes = [];
console.log(longestNote());     // null
console.log(countByCategory()); // {}
console.log(getSummary());      // "0 notes."

notes = [savedNotes[4]]; // only "Call mum"
console.log(getSummary());      // "1 note: 1 personal."

notes = savedNotes; // put the full list back

// isDuplicate
console.log(isDuplicate("call mum"));        // true (ignores case)
console.log(isDuplicate("  CALL   Mum  ")); // true (ignores extra spaces)
console.log(isDuplicate("Walk the dog"));    // false

// addNote
console.log(addNote("Water the plants", "personal"));     // true
console.log(addNote("  water   THE plants ", "work"));    // logs "Not added: a note with this text already exists." then false
console.log(addNote("", "work"));                         // logs "Not added: text must be 1 to 200 characters." then false
console.log(addNote("a".repeat(201), "work"));            // logs "Not added: text must be 1 to 200 characters." then false
console.log(addNote("Plan the budget", "hobby"));         // logs "Not added: category must be personal, work or study." then false
console.log(getSummary()); // "6 notes: 3 personal, 1 work, 2 study."