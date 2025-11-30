function createItemRow(initial = {}) {
  const tr = document.createElement("tr");

  tr.innerHTML = `
    <td><input type="text" class="item-name" placeholder="Jeans"></td>
    <td><input type="text" class="item-description" placeholder="Blue, size 10"></td>
    <td><input type="text" class="item-image" placeholder="https://..."></td>
    <td><input type="number" class="item-price" min="0" step="0.01" placeholder="79.95"></td>
    <td><input type="number" class="item-qty" min="1" step="1" value="1"></td>
    <td style="text-align:center;">
      <button type="button" class="btn btn-danger btn-small remove-item">X</button>
    </td>
  `;

  if (initial.name) tr.querySelector(".item-name").value = initial.name;
  if (initial.description)
    tr.querySelector(".item-description").value = initial.description;
  if (initial.imageUrl) tr.querySelector(".item-image").value = initial.imageUrl;
  if (initial.priceAud)
    tr.querySelector(".item-price").value = initial.priceAud;
  if (initial.quantity)
    tr.querySelector(".item-qty").value = initial.quantity;

  tr.querySelector(".remove-item").addEventListener("click", () => {
    tr.remove();
  });

  return tr;
}

function addInitialRowIfEmpty() {
  const tbody = document.getElementById("itemsBody");
  if (!tbody.querySelector("tr")) {
    tbody.appendChild(createItemRow());
  }
}

document.addEventListener("DOMContentLoaded", () => {
  const tbody = document.getElementById("itemsBody");
  const addItemBtn = document.getElementById("addItem");
  const createBtn = document.getElementById("createBtn");
  const statusMsg = document.getElementById("statusMsg");
  const errorMsg = document.getElementById("errorMsg");
  const resultPanel = document.getElementById("resultPanel");
  const checkoutLinkEl = document.getElementById("checkoutLink");
  const noteTextEl = document.getElementById("noteText");
  const copyLinkBtn = document.getElementById("copyLinkBtn");
  const copyNoteBtn = document.getElementById("copyNoteBtn");

  addItemBtn.addEventListener("click", () => {
    tbody.appendChild(createItemRow());
  });

  addInitialRowIfEmpty();

  async function createHold() {
    errorMsg.style.display = "none";
    errorMsg.textContent = "";
    resultPanel.style.display = "none";
    statusMsg.textContent = "Creating session with Stripe…";

    const customerEmail = document
      .getElementById("customerEmail")
      .value.trim();
    const internalNote = document.getElementById("internalNote").value.trim();
    const deliveryFeeAud = document
      .getElementById("deliveryFeeAud")
      .value.trim();

    const items = [];
    document.querySelectorAll("#itemsBody tr").forEach((tr) => {
      const name = tr.querySelector(".item-name").value.trim();
      const description = tr
        .querySelector(".item-description")
        .value.trim();
      const imageUrl = tr.querySelector(".item-image").value.trim();
      const priceAud = tr.querySelector(".item-price").value.trim();
      const quantity = tr.querySelector(".item-qty").value.trim();

      if (!name && !priceAud) {
        return; // allow blank rows
      }

      items.push({
        name,
        description,
        imageUrl,
        priceAud,
        quantity,
      });
    });

    if (items.length === 0) {
      statusMsg.textContent = "";
      errorMsg.textContent = "Please add at least one item.";
      errorMsg.style.display = "block";
      return;
    }

    try {
      const res = await fetch("/create-hold", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          customerEmail,
          internalNote,
          deliveryFeeAud,
          items,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to create Stripe session");
      }

      // Show results
      checkoutLinkEl.value = data.checkoutUrl || "";
      const deliveryLine =
        Number(data.deliveryFeeAud || 0) > 0
          ? `Delivery/service: AUD ${data.deliveryFeeAud}\n`
          : "";

      noteTextEl.value =
        `PaymentIntent: ${data.paymentIntentId}\n` +
        `Total authorized: AUD ${data.totalAmountAud}\n` +
        deliveryLine +
        (customerEmail ? `Customer email: ${customerEmail}\n` : "") +
        (internalNote ? `Internal note: ${internalNote}` : "");

      resultPanel.style.display = "block";
      statusMsg.textContent = "Hold link created.";
    } catch (err) {
      console.error(err);
      statusMsg.textContent = "";
      errorMsg.textContent = err.message || "Something went wrong.";
      errorMsg.style.display = "block";
    }
  }

  createBtn.addEventListener("click", (e) => {
    e.preventDefault();
    createHold();
  });

  copyLinkBtn.addEventListener("click", () => {
    checkoutLinkEl.select();
    checkoutLinkEl.setSelectionRange(0, 99999);
    navigator.clipboard.writeText(checkoutLinkEl.value || "").catch(() => {});
  });

  copyNoteBtn.addEventListener("click", () => {
    noteTextEl.select();
    noteTextEl.setSelectionRange(0, 99999);
    navigator.clipboard.writeText(noteTextEl.value || "").catch(() => {});
  });
});
