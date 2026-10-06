const noteText = document.getElementById("note-text");
const charCount = document.getElementById("char-count");
const wordCount = document.getElementById("word-count");
const clearBtn = document.getElementById("clear-btn");
const themeToggle = document.getElementById("theme-toggle");

const DRAFT_KEY = "quicknotes-draft";
const THEME_KEY = "quicknotes-theme";
const MAX_CHARS = 200;
const WARNING_AT = 180;

function updateCounts() {
    const text = noteText.value;
    const length = text.length;
    const trimmed = text.trim();
    const words = trimmed === "" ? 0 : trimmed.split(/\s+/).length;

    charCount.textContent = `${length} / ${MAX_CHARS} characters`;
    wordCount.textContent = `${words} words`;

    charCount.classList.toggle("warning", length > WARNING_AT);
    charCount.classList.toggle("over", length > MAX_CHARS);
}
function saveDraft() {
    localStorage.setItem(DRAFT_KEY, noteText.value);
}

noteText.addEventListener("input", function () {
    updateCounts();
    saveDraft();
});
function updateThemeLabel() {
    const isDark = document.body.classList.contains("dark");
    themeToggle.textContent = isDark ? "Light mode" : "Dark mode";
}

const savedDraft = localStorage.getItem(DRAFT_KEY);
if (savedDraft !== null) {
    noteText.value = savedDraft;
}

if (localStorage.getItem(THEME_KEY) === "dark") {
    document.body.classList.add("dark");
}

updateThemeLabel();
updateCounts();
function clearNote() {
    noteText.value = "";
    localStorage.removeItem(DRAFT_KEY);
    updateCounts();
    noteText.focus();
}

clearBtn.addEventListener("click", clearNote);

noteText.addEventListener("keydown", function (event) {
    if (event.key === "Escape") {
        clearNote();
    }
});
themeToggle.addEventListener("click", function () {
    document.body.classList.toggle("dark");

    const isDark = document.body.classList.contains("dark");
    localStorage.setItem(THEME_KEY, isDark ? "dark" : "light");
    updateThemeLabel();
});

