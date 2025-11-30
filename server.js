require("dotenv").config();
const express = require("express");
const path = require("path");
const app = express();

const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static("public"));

app.post("/create-hold", async (req, res) => {
  try {
    const { customerEmail, internalNote, items, deliveryFeeAud } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: "Please add at least one item." });
    }

    const lineItems = [];
    let totalCents = 0;

    items.forEach((item, index) => {
      const priceAud = Number(item.priceAud || 0);
      const quantity = Number(item.quantity || 1);

      const unitAmount = Math.round(priceAud * 100);

      if (unitAmount <= 0 || quantity <= 0) {
        return; // skip invalid rows
      }

      totalCents += unitAmount * quantity;

      const productData = {
        name: item.name || `Item ${index + 1}`,
      };

      if (item.description && item.description.trim().length > 0) {
        productData.description = item.description.trim();
      }

      // only send image URL to Stripe if it looks valid and short enough
      const imageUrl = (item.imageUrl || "").trim();
      if (
        imageUrl &&
        imageUrl.length <= 2000 &&
        /^https?:\/\//i.test(imageUrl)
      ) {
        productData.images = [imageUrl];
      }

      lineItems.push({
        price_data: {
          currency: "aud",
          unit_amount: unitAmount,
          product_data: productData,
        },
        quantity,
      });
    });

    // Delivery / service fee as a separate line item
    const feeAmountCents = Math.round(Number(deliveryFeeAud || 0) * 100);
    if (feeAmountCents > 0) {
      totalCents += feeAmountCents;

      lineItems.push({
        price_data: {
          currency: "aud",
          unit_amount: feeAmountCents,
          product_data: {
            name: "Delivery & service",
            description: "Delivery and service charges",
          },
        },
        quantity: 1,
      });
    }

    if (lineItems.length === 0) {
      return res
        .status(400)
        .json({ error: "No valid items or fees to send to Stripe." });
    }

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      customer_email: customerEmail || undefined,
      line_items: lineItems,
      success_url: "https://yodi.com.au/thanks",
      cancel_url: "https://yodi.com.au/cancelled",
      payment_intent_data: {
        capture_method: "manual", // this is what makes it an auth / hold
        description: "Yodi try-before-you-buy hold",
        metadata: {
          internal_note: internalNote || "",
          delivery_fee_aud: (Number(deliveryFeeAud || 0) || 0).toString(),
        },
      },
    });

    const responsePayload = {
      checkoutUrl: session.url,
      paymentIntentId: session.payment_intent,
      totalAmountAud: (totalCents / 100).toFixed(2),
      deliveryFeeAud: (feeAmountCents / 100).toFixed(2),
    };

    res.json(responsePayload);
  } catch (err) {
    console.error("Error creating Checkout Session", err);
    res.status(500).json({ error: err.message || "Stripe error" });
  }
});

// fallback so direct visits to the Render URL still show the tool
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(PORT, () => {
  console.log(`Yodi hold tool listening on port ${PORT}`);
});
