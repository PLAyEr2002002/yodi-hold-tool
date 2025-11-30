// public/app.js

function logActivity(message) {
  const container = document.getElementById("activityLines");
  const now = new Date();
  const time = now.toLocaleTimeString();
  const line = `[${time}] ${message}`;
  if (container.textContent.trim() === "" || container.textContent.includes("Waiting,")) {
    container.textContent = line;
  } else {
    container.textContent += "\n" + line;
  }
}

function createItemRow() {
  const tr = document.createElement("tr");

  const nameTd = document.createElement("td");
  const nameInput = document.createElement("input");
  nameInput.type = "text";
  nameTd.appendChild(nameInput);

  const descTd = document.createElement("td");
  const descInput = document.createElement("input");
  descInput.type = "text";
  descTd.appendChild(descInput);

  const imgTd = document.createElement("td");
  const imgInput = document.createElement("input");
  imgInput.type = "text";
  imgTd.appendChild(imgInput);

  const priceTd = document.createElement("td");
  const priceInput = document.createElement("input");
  priceInput.type = "number";
  priceInput.min = "0";
  priceInput.step = "0.01";
  priceTd.appendChild(priceInput);

  const qtyTd = document.createElement("td");
  const qtyInput = document.createElement("input");
  qtyInput.type = "number";
  qtyInput.min = "1";
  qtyInput.step = "1";
  qtyInput.value = "1";
  qtyTd.appendChild(qtyInput);

  const removeTd = document.createElement("td");
  const removeBtn = document.createElement("button");
  removeBtn.textContent = "X";
  removeBtn.className = "btn btn-danger btn-small";
  removeBtn.addEventListener("click", () => {
    tr.remove();
  });
  removeTd.appendChild(removeBtn);

  tr.appendChild(nameTd);
  tr.appendChild(descTd);
  tr.appendChild(imgTd);
  tr.appendChild(priceTd);
  tr.appendChild(qtyTd);
  tr.appendChild(removeTd);

  return tr;
}

window.addEventListener("DOMContentLoaded", () => {
  const itemsBody = document.getElementById("itemsBody");
  const addItemBtn = document.getElementById("addItem");
  const createBtn = document.getElementById("createBtn");
  const statusMsg = document.getElementById("statusMsg");
  const errorMsg = document.getElementById("errorMsg");
  const resultPanel = document.getElementById("resultPanel");
  const checkoutLinkTextarea = document.getElementById("checkoutLink");
  const noteTextTextarea = document.getElementById("noteText");
  const copyLinkBtn = document.getElementById("copyLinkBtn");
  const copyNoteBtn = document.getElementById("copyNoteBtn");

  // Start with one empty row
  itemsBody.appendChild(createItemRow());

  addItemBtn.addEventListener("click", (e) => {
    e.preventDefault();
    itemsBody.appendChild(createItemRow());
  });

  copyLinkBtn.addEventListener("click", () => {
    checkoutLinkTextarea.select();
    document.execCommand("copy");
    logActivity("Checkout link copied to clipboard.");
  });

  copyNoteBtn.addEventListener("click", () => {
    noteTextTextarea.select();
    document.execCommand("copy");
    logActivity("Notes text copied to clipboard.");
  });

  createBtn.addEventListener("click", async (e) => {
    e.preventDefault();
    errorMsg.style.display = "none";
    errorMsg.textContent = "";
    statusMsg.textContent = "";
    resultPanel.style.display = "none";

    const customerEmail = document.getElementById("customerEmail").value.trim();
    const internalNote = document.getElementById("internalNote").value.trim();
    const deliveryFeeAud = document.getElementById("deliveryFeeAud").value.trim();
    const adminPassword = document.getElementById("adminPassword").value;

    if (!adminPassword) {
      errorMsg.textContent = "Please enter the admin password.";
      errorMsg.style.display = "block";
      logActivity("Attempted to create link without admin password.");
      return;
    }

    const items = [];
    const rows = itemsBody.querySelectorAll("tr");
    rows.forEach((row) => {
      const inputs = row.querySelectorAll("input");
      const [nameInput, descInput, imgInput, priceInput, qtyInput] = inputs;

      const name = nameInput.value.trim();
      const description = descInput.value.trim();
      const imageUrl = imgInput.value.trim();
      const priceAud = priceInput.value.trim();
      const qty = qtyInput.value.trim();

      if (!name && !priceAud && !qty) {
        // completely empty row, ignore
        return;
      }

      items.push({
        name,
        description,
        imageUrl,
        priceAud,
        qty,
      });
    });

    if (items.length === 0) {
      errorMsg.textContent = "Please add at least one item.";
      errorMsg.style.display = "block";
      logActivity("Validation failed, no items added.");
      return;
    }

    logActivity("Checking password and validating data.");
    statusMsg.textContent = "Creating checkout session...";

    try {
      logActivity("Sending request to server.");
      const res = await fetch("/create-checkout-session", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          customerEmail,
          internalNote,
          deliveryFeeAud,
          items,
          adminPassword,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        const msg = data && data.error ? data.error : "Unknown error from server.";
        errorMsg.textContent = msg;
        errorMsg.style.display = "block";
        statusMsg.textContent = "";
        logActivity(`Error from server: ${msg}`);
        return;
      }

      // success
      const { url, noteText } = data;
      checkoutLinkTextarea.value = url || "";
      noteTextTextarea.value = noteText || "";
      resultPanel.style.display = "block";
      statusMsg.textContent = "Hold link created. Copy and send to customer.";
      logActivity("Checkout session created successfully.");
    } catch (err) {
      console.error(err);
      errorMsg.textContent =
        "Unexpected error while talking to server. Check console.";
      errorMsg.style.display = "block";
      statusMsg.textContent = "";
      logActivity("Network or unexpected error while creating session.");
    }
  });
});
