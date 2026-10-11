const API_URL = "https://jsonplaceholder.typicode.com/users";

const loadButton = document.getElementById("load-users");
const filterInput = document.getElementById("filter-input");
const statusMessage = document.getElementById("status");
const usersList = document.getElementById("users-list");

let allUsers = [];

async function loadUsers() {
  statusMessage.textContent = "Loading users...";
  loadButton.disabled = true;

  try {
    const response = await fetch(API_URL);

    if (!response.ok) {
      throw new Error(`Request failed with status ${response.status}`);
    }

    allUsers = await response.json();
    applyFilter();
    statusMessage.textContent = `Loaded ${allUsers.length} users.`;
  } catch (error) {
    statusMessage.textContent = `Could not load users: ${error.message}`;
  } finally {
    loadButton.disabled = false;
  }
}
function addDetail(parent, label, value) {
  const line = document.createElement("p");
  line.textContent = `${label}: ${value}`;
  parent.append(line);
}

function renderUsers(list) {
  usersList.replaceChildren();

  if (list.length === 0) {
    const message = document.createElement("li");
    message.textContent = "No users match your filter.";
    usersList.append(message);
    return;
  }

  for (const user of list) {
    const item = document.createElement("li");

    const name = document.createElement("h3");
    name.textContent = user.name;
    item.append(name);

    addDetail(item, "Email", user.email);
    addDetail(item, "City", user.address.city);
    addDetail(item, "Company", user.company.name);

    usersList.append(item);
  }
}
function applyFilter() {
  if (allUsers.length === 0) {
    return;
  }

  const query = filterInput.value.trim().toLowerCase();
  const matches = allUsers.filter((user) =>
    user.name.toLowerCase().includes(query),
  );
  renderUsers(matches);
}

loadButton.addEventListener("click", loadUsers);
filterInput.addEventListener("input", applyFilter);
