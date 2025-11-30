// public/app.js

function makeItemRow(item = {}) {
  const tr = document.createElement("tr");

  const nameTd = document.createElement("td");
  const descTd = document.createElement("td");
  const imageTd = document.createElement("td");
  const priceTd = document.createElement("td");
  const qtyTd = document.createElement("td");
  const removeTd = document.createElement("td");

  const nameInput = document.createElement("input");
  nameInput.type = "text";
  nameInput.value = item.name || "";
  nameTd.appendChild(nameInput);

  const descInput = document.createElement("input");
  descInput.type = "text";
  descInput.value = item.description || "";
  descTd.appendChild(descInput);

  const imageInput = document.createElement("input");
  imageInput.type = "text";
  imageInput.value = item.imageUrl || "";
  imageTd.appendChild(imageInput);

  const priceInput = document.createElement("input");
  priceInput.type = "number";
  priceInput.step = "0.01";
  priceInput.min = "0";
  priceInput.value = item.priceAud != null ? item.priceAud : "";
  priceTd.appendChild(priceInput);

  const qtyInput = document.createElement("input");
  qtyInput.type = "number";
  qtyInput.min = "1";
  qtyInput.value = item.quantity || 1;
  qtyTd.appendChild(qtyInput);

  const removeBtn = document.createElement("button");
  removeBtn.type = "button";
  removeBtn.textContent = "X";
  removeBtn.className = "secondary";
  removeBtn.addEventListener("click", () => {
    tr.remove();
  });
  removeTd.appendChild(removeBtn);

  tr.appendChild(nameTd);
  tr.appendChild(descTd);
  tr.appendChild(imageTd);
  tr.appendChild(priceTd);
  tr.appendChild(qtyTd);
  tr.appendChild(removeTd);

  return tr;
}

function getItemsFromTable() {
  const rows = document.querySelectorAll("#itemsBody tr");
  const items = [];

  rows.forEach((tr) => {
    const inputs = tr.querySelectorAll("input");
    const [nameInput, descInput, imageInput, priceInput, qtyInput] = inputs;

    const name = nameInput.value.trim();
    const description = descInput.value.trim();
    const imageUrl = imageInput.value.trim();
    const priceAud = parseFloat(priceInput.value);
    const quantity = parseInt(qtyInput.value, 10) || 1;

    if (!name || isNaN(priceAud)) {
      return;
    }

    items.push({
      name,
      description,
      imageUrl,
      priceAud,
      quantity,
    });
  });

  return items;
}

async function createHold() {
  const errorMsg = document.getElementById("errorMsg");
  const resultWrapper = document.getElementById("resultWrapper");
  const holdLinkEl = document.getElementById("holdLink");
  const notesBox = document.getElementById("notesBox");
  const piIdText = document.getElementById("piIdText");
  const piAmountText = document.getElementById("piAmountText");

  errorMsg.classList.add("hidden");
  errorMsg.textContent = "";
  resultWrapper.classList.add("hidden");
  holdLinkEl.textContent = "";
  notesBox.classList.add("hidden");
  piIdText.textContent = "";
  piAmountText.textContent = "";

  const customerEmail = document.getElementById("customerEmail").value.trim();
  const internalNote = document.getElementById("internalNote").value.trim();
  const items = getItemsFromTable();

  if (items.length === 0) {
    errorMsg.textContent = "Please add at least one item with name and price.";
    errorMsg.classList.remove("hidden");
    return;
  }

  try {
    const response = await fetch("/create-hold", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        customerEmail,
        internalNote,
        items,
      }),
    });

    if (!response.ok) {
      throw new Error("Server returned " + response.status);
    }

    const data = await response.json();

    if (!data.url) {
      throw new Error("Server did not send back a link.");
    }

    // Show link
    holdLinkEl.textContent = data.url;
    resultWrapper.classList.remove("hidden");

    // Show notes block if we have a PaymentIntent id
    if (data.paymentIntentId) {
      piIdText.textContent = data.paymentIntentId;
      if (typeof data.amountTotal === "number") {
        const aud = (data.amountTotal / 100).toFixed(2);
        piAmountText.textContent = `A$${aud} AUD`;
      } else {
        piAmountText.textContent = "Unknown";
      }
      notesBox.classList.remove("hidden");
    }
  } catch (err) {
    console.error(err);
    errorMsg.textContent =
      "Could not create hold link. Please check console for details.";
    errorMsg.classList.remove("hidden");
  }
}

// Copy only the link text to clipboard
async function copyLinkToClipboard() {
  const holdLinkEl = document.getElementById("holdLink");
  const linkText = holdLinkEl.textContent.trim();
  if (!linkText) {
    return;
  }

  try {
    await navigator.clipboard.writeText(linkText);
    const originalText = document.getElementById("copyLinkBtn").textContent;
    document.getElementById("copyLinkBtn").textContent = "Copied";
    setTimeout(() => {
      document.getElementById("copyLinkBtn").textContent = originalText;
    }, 1200);
  } catch (err) {
    console.error("Clipboard copy failed", err);
    alert("Could not copy. Please copy manually.");
  }
}

document.addEventListener("DOMContentLoaded", () => {
  const itemsBody = document.getElementById("itemsBody");
  const addItemBtn = document.getElementById("addItemBtn");
  const createHoldBtn = document.getElementById("createHoldBtn");
  const copyLinkBtn = document.getElementById("copyLinkBtn");

  // Start with one empty row
  itemsBody.appendChild(makeItemRow());

  addItemBtn.addEventListener("click", () => {
    itemsBody.appendChild(makeItemRow());
  });

  createHoldBtn.addEventListener("click", createHold);
  copyLinkBtn.addEventListener("click", copyLinkToClipboard);
});
