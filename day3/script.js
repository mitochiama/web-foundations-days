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

console.log(searchNotes("JAVASCRIPT")); 
console.log(searchNotes("xyz"));        
console.log(searchNotes("the").length); 

console.log(longestNote()); 

console.log(countByCategory()); 


console.log(getSummary()); 

const savedNotes = notes;

notes = [];
console.log(longestNote());     
console.log(countByCategory()); 
console.log(getSummary());      

notes = [savedNotes[4]]; 
console.log(getSummary());    

notes = savedNotes; 

console.log(isDuplicate("call mum"));        
console.log(isDuplicate("  CALL   Mum  ")); 
console.log(isDuplicate("Walk the dog"));    
console.log(addNote("Water the plants", "personal"));     
console.log(addNote("  water   THE plants ", "work"));    
console.log(addNote("", "work"));                         
console.log(addNote("a".repeat(201), "work"));            
console.log(addNote("Plan the budget", "hobby"));         
console.log(getSummary()); 