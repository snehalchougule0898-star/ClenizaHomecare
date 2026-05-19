const navToggle = document.querySelector(".nav-toggle");
const navLinks = document.querySelector(".nav-links");

if (navToggle && navLinks) {
  navToggle.addEventListener("click", () => {
    navLinks.classList.toggle("open");
  });
}

document.querySelectorAll(".form:not([data-checkout-form])").forEach((form) => {
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const status = form.querySelector("[data-form-status]");
    if (status) {
      status.textContent = "Thank you. The CLENIZA team will contact you shortly.";
    }
    form.reset();
  });
});

const stage = document.querySelector(".hero-stage");
if (stage) {
  window.addEventListener("mousemove", (event) => {
    const x = (event.clientX / window.innerWidth - 0.5) * 18;
    const y = (event.clientY / window.innerHeight - 0.5) * 12;
    stage.style.setProperty("--tilt-x", `${x}px`);
    stage.style.setProperty("--tilt-y", `${y}px`);
  });
}

const revealItems = document.querySelectorAll(".card, .contact-tile, .refill-path article, .variant-card");
if ("IntersectionObserver" in window && revealItems.length) {
  revealItems.forEach((item) => item.classList.add("reveal"));
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.16 }
  );
  revealItems.forEach((item) => observer.observe(item));
}

const checkoutVariants = document.querySelectorAll("[data-checkout-variants] .variant-card");
if (checkoutVariants.length) {
  const minSachets = 6;
  const pricePerSachet = 50;
  const selectedTotal = document.querySelector("[data-selected-total]");
  const orderTotal = document.querySelector("[data-order-total]");
  const summaryList = document.querySelector("[data-summary-list]");
  const status = document.querySelector("[data-checkout-status]");
  const orderButton = document.querySelector("[data-place-order]");
  const checkoutForm = document.querySelector("[data-checkout-form]");
  const addComboButton = document.querySelector("[data-add-combo]");
  const quantities = new Map();

  checkoutVariants.forEach((card) => {
    quantities.set(card.dataset.variant, 0);
    card.querySelectorAll("button[data-action]").forEach((button) => {
      button.addEventListener("click", () => {
        const variant = card.dataset.variant;
        const currentQty = quantities.get(variant);

        if (button.dataset.action === "increase") {
          quantities.set(variant, currentQty + 1);
        }

        if (button.dataset.action === "decrease" && currentQty > 0) {
          quantities.set(variant, currentQty - 1);
        }

        updateCheckout();
      });
    });
    card.addEventListener("click", (event) => {
      const button = event.target.closest("button[data-action]");
      if (!button) return;
      event.stopPropagation();
    });
  });

  const updateCheckout = () => {
    const entries = [...quantities.entries()].filter(([, qty]) => qty > 0);
    const total = entries.reduce((sum, [, qty]) => sum + qty, 0);
    const totalPrice = total * pricePerSachet;
    selectedTotal.textContent = total;
    if (orderTotal) {
      orderTotal.textContent = total >= minSachets ? `Rs ${totalPrice}` : "Rs 0";
    }

    checkoutVariants.forEach((card) => {
      card.querySelector("[data-qty]").textContent = quantities.get(card.dataset.variant);
    });

    if (entries.length) {
      summaryList.innerHTML = entries
        .map(([name, qty]) => `<div><span>${name}</span><strong>${qty}</strong></div>`)
        .join("");
    } else {
      summaryList.textContent = "No sachets selected yet.";
    }

    if (total >= minSachets) {
      status.textContent = `Your CLENIZA refill pack is ready: ${total} sachets selected, total Rs ${totalPrice}.`;
      status.classList.add("ready");
      status.classList.remove("error");
      orderButton.disabled = false;
    } else {
      const remaining = minSachets - total;
      status.textContent =
        remaining > 0
          ? `Select ${remaining} more sachet${remaining === 1 ? "" : "s"} to reach the minimum order.`
          : "Minimum order reached.";
      status.classList.remove("ready");
      status.classList.remove("error");
      orderButton.disabled = true;
    }
  };

  if (addComboButton) {
    addComboButton.addEventListener("click", () => {
      checkoutVariants.forEach((card) => {
        quantities.set(card.dataset.variant, 1);
      });
      updateCheckout();
      setCheckoutMessage("Complete 6 sachet combo added. You can add more sachets if needed.", "success");
    });
  }

  const setCheckoutMessage = (message, type) => {
    status.textContent = message;
    status.classList.toggle("ready", type === "success");
    status.classList.toggle("error", type === "error");
  };

  const postJson = async (url, payload) => {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data.error || "Payment request failed. Please try again.");
    }
    return data;
  };

  checkoutForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const entries = [...quantities.entries()].filter(([, qty]) => qty > 0);
    const total = entries.reduce((sum, [, qty]) => sum + qty, 0);
    if (total < minSachets) return;
    const totalPrice = total * pricePerSachet;
    const amountInPaise = totalPrice * 100;

    const formData = new FormData(checkoutForm);
    const orderLines = entries.map(([name, qty]) => `${name}: ${qty}`).join(", ");
    const customer = {
      name: String(formData.get("name") || "").trim(),
      phone: String(formData.get("phone") || "").trim(),
      address: String(formData.get("address") || "").trim(),
    };

    if (!window.Razorpay) {
      setCheckoutMessage("Razorpay checkout could not load. Please refresh the page and try again.", "error");
      return;
    }

    orderButton.disabled = true;
    orderButton.textContent = "Opening Razorpay...";
    setCheckoutMessage("Creating a secure payment order. Please wait.", "success");

    try {
      const order = await postJson("/api/create-order", {
        amount: amountInPaise,
        currency: "INR",
        receipt: `cleniza_${Date.now()}`,
      });

      const razorpay = new Razorpay({
        key: order.key_id,
        amount: order.amount,
        currency: order.currency,
        name: "CLENIZA Home Care",
        description: `${total} sachet refill pack`,
        order_id: order.order_id,
        prefill: {
          name: customer.name,
          contact: customer.phone,
        },
        notes: {
          selection: orderLines,
          quantity: String(total),
          address: customer.address,
        },
        theme: {
          color: "#063f78",
        },
        modal: {
          ondismiss: () => {
            orderButton.disabled = false;
            orderButton.textContent = "Pay Securely with Razorpay";
            setCheckoutMessage("Payment was cancelled. Your selected pack is still ready when you want to continue.", "error");
          },
        },
        handler: async (response) => {
          try {
            setCheckoutMessage("Payment received. Verifying securely...", "success");
            await postJson("/api/verify-payment", response);
            setCheckoutMessage(
              `Payment verified. Thank you, ${customer.name}. Your CLENIZA order for ${total} sachets has been received.`,
              "success"
            );
            orderButton.textContent = "Payment Verified";
            orderButton.disabled = true;
          } catch (error) {
            orderButton.disabled = false;
            orderButton.textContent = "Pay Securely with Razorpay";
            setCheckoutMessage(error.message || "Payment verification failed. Please contact CLENIZA support.", "error");
          }
        },
      });

      razorpay.on("payment.failed", (response) => {
        orderButton.disabled = false;
        orderButton.textContent = "Pay Securely with Razorpay";
        const reason =
          response &&
          response.error &&
          (response.error.description || response.error.reason);
        setCheckoutMessage(reason || "Payment failed. Please try again or contact CLENIZA support.", "error");
      });

      razorpay.open();
    } catch (error) {
      orderButton.disabled = false;
      orderButton.textContent = "Pay Securely with Razorpay";
      setCheckoutMessage(error.message || "Unable to start payment. Please try again.", "error");
    }
  });

  const preselectedVariant = new URLSearchParams(window.location.search).get("variant");
  if (preselectedVariant && quantities.has(preselectedVariant)) {
    quantities.set(preselectedVariant, 1);
  }

  updateCheckout();
}
