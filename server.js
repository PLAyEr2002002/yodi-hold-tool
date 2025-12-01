// server.js
require("dotenv").config();
const express = require("express");
const path = require("path");
const bodyParser = require("body-parser");

const app = express();

// Initialise Stripe with secret key from .env
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

const PORT = process.env.PORT || 3000;

// Middleware
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, "public")));

// Simple health-check
app.get("/health", (req, res) => {
  res.json({ ok: true });
});

// Create Checkout Session route
app.post("/create-checkout-session", async (req, res) => {
  try {
    const {
      customerEmail,
      internalNote,
      deliveryFeeAud,
      items,
      adminPassword,
    } = req.body;

    // 1. Check admin password on the server
    const expectedPassword = process.env.ADMIN_PASSWORD || "";
    if (!expectedPassword) {
      return res.status(500).json({
        error: "Server misconfigured, ADMIN_PASSWORD is not set.",
      });
    }
    if (adminPassword !== expectedPassword) {
      return res.status(403).json({ error: "Invalid admin password." });
    }

    // 2. Validate items
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: "At least one item is required." });
    }

    // 3. Build Stripe line items
    const line_items = [];
    let totalAud = 0;

    for (const item of items) {
      const name = (item.name || "").toString().trim();
      const description = (item.description || "").toString().trim();
      const imageUrl = (item.imageUrl || "").toString().trim();
      const priceAudNum = parseFloat(item.priceAud);
      const qtyNum = parseInt(item.qty, 10);

      if (!name || !Number.isFinite(priceAudNum) || priceAudNum <= 0 || !qtyNum || qtyNum <= 0) {
        return res
          .status(400)
          .json({ error: "Each item needs name, positive price and quantity." });
      }

      const unit_amount = Math.round(priceAudNum * 100);
      totalAud += priceAudNum * qtyNum;

      const productData = {
        name,
        description,
      };

      // Stripe requires image URL <= 2048 chars
      if (imageUrl && imageUrl.length <= 2048) {
        productData.images = [imageUrl];
      }

      line_items.push({
        quantity: qtyNum,
        price_data: {
          currency: "aud",
          unit_amount,
          product_data: productData,
        },
      });
    }

    // 4. Delivery / service fee
    const deliveryFeeNum = parseFloat(deliveryFeeAud);
    if (Number.isFinite(deliveryFeeNum) && deliveryFeeNum > 0) {
      const deliveryUnitAmount = Math.round(deliveryFeeNum * 100);
      totalAud += deliveryFeeNum;

      line_items.push({
        quantity: 1,
        price_data: {
          currency: "aud",
          unit_amount: deliveryUnitAmount,
          product_data: {
            name: "Delivery & service fee",
            description: "Yodi delivery and service charges",
          },
        },
      });
    }

    // 5. Create Checkout Session
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_intent_data: {
        capture_method: "manual", // this makes it an authorization you capture later
        description: internalNote || "Yodi hold checkout",
        metadata: {
          internal_note: internalNote || "",
          delivery_fee_aud: deliveryFeeAud || "0",
        },
      },
      customer_email: customerEmail || undefined,
      line_items,
      success_url:
        "https://yodi.com.au/success",
      cancel_url:
        "https://checkout.stripe.com/c/pay/cancel#yodi_hold_cancel",
    });

    // 6. Build a human readable note string you can paste into Stripe notes
    let noteText = `Yodi hold creator\n`;
    noteText += `Session ID: ${session.id}\n`;
    noteText += `Customer email: ${customerEmail || "n/a"}\n`;
    noteText += `Internal note: ${internalNote || "n/a"}\n\n`;
    noteText += `Items:\n`;
    for (const item of items) {
      noteText += `- ${item.name} x${item.qty} @ AUD ${item.priceAud}\n`;
    }
    noteText += `Delivery & service fee: AUD ${
      Number.isFinite(deliveryFeeNum) && deliveryFeeNum > 0
        ? deliveryFeeNum.toFixed(2)
        : "0.00"
    }\n`;
    noteText += `Total intended authorization (approx): AUD ${totalAud.toFixed(
      2
    )}\n`;
    noteText += `When payment appears, search by this Session ID in Stripe.`;

    return res.json({
      url: session.url,
      noteText,
    });
  } catch (err) {
    console.error("Error creating Checkout Session", err);
    const message =
      (err && err.message) || "Unknown error while creating checkout session";
    return res.status(500).json({ error: message });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`Yodi hold tool listening on port ${PORT}`);
});
