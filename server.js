// server.js
require("dotenv").config();
const express = require("express");
const path = require("path");
const bodyParser = require("body-parser");
const Stripe = require("stripe");

const app = express();
const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, "public")));

app.post("/create-hold", async (req, res) => {
  try {
    const { customerEmail, internalNote, items } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: "At least one item is required" });
    }

    // Convert our cart items into Stripe line items
    const lineItems = items.map((item) => ({
      price_data: {
        currency: "aud",
        product_data: {
          name: item.name,
          description: item.description,
          images: item.imageUrl ? [item.imageUrl] : [],
        },
        unit_amount: Math.round(item.priceAud * 100), // dollars to cents
      },
      quantity: item.quantity,
    }));

    const metadata = {
      internal_note: internalNote || "",
    };

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      customer_email: customerEmail || undefined,
      line_items: lineItems,
      payment_intent_data: {
        capture_method: "manual", // this makes it an auth only
        metadata,
      },
      metadata,
      success_url: "https://yodi.com.au/",
      cancel_url: "https://yodi.com.au/?payment=cancelled",
    });

    // `amount_total` is in cents
    const amountTotal = session.amount_total || null;
    const paymentIntentId = session.payment_intent || null;

    res.json({
      url: session.url,
      paymentIntentId,
      amountTotal, // cents
    });
  } catch (error) {
    console.error("Error creating Stripe Checkout session", error);
    res.status(500).json({ error: "Failed to create hold link" });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Yodi hold tool listening on port ${PORT}`);
});
