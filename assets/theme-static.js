/* ═════════════════════════════════════════════════
   ShopForge — Static Theme JavaScript
   Client-side Cart (localStorage), Variant Selection,
   PayPal Checkout, Mobile Menu, FAQ
   For GitHub Pages / static deployment (no server)
   ═════════════════════════════════════════════════ */

(function() {
  'use strict';

  // ══════════════════════════════════
  // HELPERS
  // ══════════════════════════════════
  function formatMoney(cents) {
    if (!cents && cents !== 0) return '0,00 €';
    return (cents / 100).toFixed(2).replace('.', ',') + ' €';
  }

  function formatMoneyDot(cents) {
    return (cents / 100).toFixed(2);
  }

  // ══════════════════════════════════
  // CLIENT-SIDE CART (localStorage)
  // ══════════════════════════════════
  const Cart = {
    _key: 'sf_cart',

    getItems() {
      try {
        return JSON.parse(localStorage.getItem(this._key)) || [];
      } catch { return []; }
    },

    _save(items) {
      localStorage.setItem(this._key, JSON.stringify(items));
    },

    add(item) {
      // item: { variant_id, product_title, variant_title, price_cents, quantity, image, slug }
      const items = this.getItems();
      const existing = items.find(i => i.variant_id === item.variant_id);
      if (existing) {
        existing.quantity += item.quantity;
      } else {
        items.push(item);
      }
      this._save(items);
      this.updateUI();
      this.openDrawer();
    },

    update(variantId, quantity) {
      let items = this.getItems();
      if (quantity <= 0) {
        items = items.filter(i => i.variant_id !== variantId);
      } else {
        const item = items.find(i => i.variant_id === variantId);
        if (item) item.quantity = quantity;
      }
      this._save(items);
      this.updateUI();
    },

    clear() {
      localStorage.removeItem(this._key);
      this.updateUI();
    },

    getTotalItems() {
      return this.getItems().reduce((sum, i) => sum + i.quantity, 0);
    },

    getTotalCents() {
      return this.getItems().reduce((sum, i) => sum + (i.price_cents * i.quantity), 0);
    },

    updateUI() {
      const items = this.getItems();
      const total = items.reduce((sum, i) => sum + i.quantity, 0);
      const totalCents = items.reduce((sum, i) => sum + (i.price_cents * i.quantity), 0);

      // Update cart count badge
      const countEl = document.getElementById('cart-count');
      if (countEl) countEl.textContent = total;

      // Render cart drawer
      this.renderDrawer(items, totalCents);
    },

    renderDrawer(items, totalCents) {
      const itemsEl = document.getElementById('cart-drawer-items');
      const totalEl = document.getElementById('cart-drawer-total');
      const footerEl = document.getElementById('cart-drawer-footer');
      if (!itemsEl) return;

      if (!items || items.length === 0) {
        itemsEl.innerHTML = '<div class="cart-drawer__empty"><p>Dein Warenkorb ist leer.</p></div>';
        if (totalEl) totalEl.textContent = '0,00 €';
        // Hide PayPal in empty cart
        const ppContainer = document.getElementById('cart-paypal-container');
        if (ppContainer) ppContainer.style.display = 'none';
        return;
      }

      itemsEl.innerHTML = items.map(item => `
        <div class="cart-drawer-item" style="display:flex;gap:12px;padding:12px 0;border-bottom:1px solid #eee;">
          <div style="width:64px;height:80px;background:#f5f5f5;border-radius:8px;overflow:hidden;flex-shrink:0;">
            ${item.image ? `<img src="${item.image}" alt="${item.product_title}" style="width:100%;height:100%;object-fit:cover;">` : ''}
          </div>
          <div style="flex:1;min-width:0;">
            <div style="font-weight:600;font-size:0.875rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${item.product_title}</div>
            ${item.variant_title ? `<div style="font-size:0.75rem;color:#888;margin-top:2px;">${item.variant_title}</div>` : ''}
            <div style="font-size:0.875rem;font-weight:600;margin-top:4px;">${formatMoney(item.price_cents)}</div>
            <div style="display:flex;align-items:center;gap:8px;margin-top:6px;">
              <button onclick="Cart.update('${item.variant_id}', ${item.quantity - 1})" style="width:28px;height:28px;border:1px solid #ddd;border-radius:6px;background:#fff;cursor:pointer;font-size:1rem;display:flex;align-items:center;justify-content:center;">−</button>
              <span style="font-size:0.875rem;min-width:20px;text-align:center;">${item.quantity}</span>
              <button onclick="Cart.update('${item.variant_id}', ${item.quantity + 1})" style="width:28px;height:28px;border:1px solid #ddd;border-radius:6px;background:#fff;cursor:pointer;font-size:1rem;display:flex;align-items:center;justify-content:center;">+</button>
            </div>
          </div>
          <button onclick="Cart.update('${item.variant_id}', 0)" style="color:#999;padding:4px;font-size:1.1rem;background:none;border:none;cursor:pointer;align-self:flex-start;" title="Entfernen">✕</button>
        </div>
      `).join('');

      if (totalEl) totalEl.textContent = formatMoney(totalCents);

      // Show PayPal button in cart
      const ppContainer = document.getElementById('cart-paypal-container');
      if (ppContainer) {
        ppContainer.style.display = 'block';
        // Re-render PayPal buttons if the SDK is loaded
        if (window.paypal && !ppContainer.dataset.rendered) {
          Cart.renderPayPalButton();
        }
      }
    },

    renderPayPalButton() {
      const container = document.getElementById('cart-paypal-container');
      if (!container || !window.paypal) return;
      container.innerHTML = '';
      container.dataset.rendered = 'true';

      paypal.Buttons({
        style: { layout: 'vertical', color: 'gold', shape: 'rect', label: 'paypal', tagline: false },
        createOrder: function(data, actions) {
          const items = Cart.getItems();
          if (items.length === 0) {
            alert('Dein Warenkorb ist leer.');
            return;
          }
          const purchaseItems = items.map(function(item) {
            return {
              name: item.product_title + (item.variant_title ? ' – ' + item.variant_title : ''),
              quantity: String(item.quantity),
              unit_amount: { currency_code: window.__SHOP_CURRENCY__ || 'EUR', value: formatMoneyDot(item.price_cents) },
            };
          });
          var totalValue = formatMoneyDot(Cart.getTotalCents());
          return actions.order.create({
            purchase_units: [{
              description: 'Bestellung bei ' + (window.__SHOP_NAME__ || 'Shop'),
              amount: {
                currency_code: window.__SHOP_CURRENCY__ || 'EUR',
                value: totalValue,
                breakdown: {
                  item_total: { currency_code: window.__SHOP_CURRENCY__ || 'EUR', value: totalValue }
                }
              },
              items: purchaseItems,
            }]
          });
        },
        onApprove: function(data, actions) {
          return actions.order.capture().then(function(details) {
            Cart.clear();
            Cart.closeDrawer();
            // Show success overlay
            var overlay = document.createElement('div');
            overlay.style.cssText = 'position:fixed;inset:0;z-index:10000;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;';
            overlay.innerHTML = '<div style="background:#fff;border-radius:16px;padding:40px;max-width:420px;text-align:center;box-shadow:0 20px 60px rgba(0,0,0,0.15);">' +
              '<div style="font-size:3rem;margin-bottom:12px;">✓</div>' +
              '<h2 style="font-size:1.3rem;font-weight:700;margin:0 0 8px;">Zahlung erfolgreich!</h2>' +
              '<p style="color:#666;margin:0 0 16px;">Vielen Dank, ' + (details.payer.name.given_name || '') + '! Deine Bestellung wird bearbeitet.</p>' +
              '<p style="font-size:0.8rem;color:#999;margin:0 0 20px;">Bestätigungs-E-Mail kommt von PayPal.</p>' +
              '<button onclick="this.closest(\'div[style]\').parentElement.remove()" style="padding:10px 32px;background:#000;color:#fff;border:none;border-radius:8px;cursor:pointer;font-weight:600;">Weiter einkaufen</button>' +
              '</div>';
            document.body.appendChild(overlay);
          });
        },
        onError: function(err) {
          console.error('PayPal Error:', err);
          alert('Zahlung fehlgeschlagen. Bitte versuche es erneut.');
        }
      }).render('#cart-paypal-container');
    },

    openDrawer() {
      const drawer = document.getElementById('cart-drawer');
      if (drawer) drawer.hidden = false;
      document.body.style.overflow = 'hidden';
      // Render PayPal if not yet rendered
      if (window.paypal && !document.getElementById('cart-paypal-container')?.dataset.rendered) {
        Cart.renderPayPalButton();
      }
    },

    closeDrawer() {
      const drawer = document.getElementById('cart-drawer');
      if (drawer) drawer.hidden = true;
      document.body.style.overflow = '';
    },

    init() {
      this.updateUI();
    }
  };

  // Make Cart globally accessible
  window.Cart = Cart;

  // ══════════════════════════════════
  // PRODUCT PAGE — Variant Selection
  // ══════════════════════════════════
  function initProductPage() {
    const form = document.getElementById('product-form');
    if (!form) return;

    const variants = window.__PRODUCT_VARIANTS__ || [];
    const variantInput = document.getElementById('selected-variant-id');
    const priceEl = document.getElementById('product-price');

    // Variant buttons
    document.querySelectorAll('.variant-btn').forEach(function(btn) {
      btn.addEventListener('click', function() {
        var group = btn.closest('.variant-buttons');
        group.querySelectorAll('.variant-btn').forEach(function(b) { b.classList.remove('active'); });
        btn.classList.add('active');

        var selected = {};
        document.querySelectorAll('.variant-buttons').forEach(function(g, i) {
          var activeBtn = g.querySelector('.variant-btn.active');
          if (activeBtn) selected['option' + (i + 1)] = activeBtn.dataset.value;
        });

        var match = variants.find(function(v) {
          return (!selected.option1 || v.option1 === selected.option1) &&
                 (!selected.option2 || v.option2 === selected.option2) &&
                 (!selected.option3 || v.option3 === selected.option3);
        });

        if (match) {
          variantInput.value = match.id;
          if (priceEl) {
            if (match.compare_at_price_cents) {
              priceEl.innerHTML =
                '<span class="price price--sale">' + formatMoney(match.price_cents) + '</span>' +
                '<span class="price price--compare">' + formatMoney(match.compare_at_price_cents) + '</span>' +
                '<span class="price-badge">Sale</span>';
            } else {
              priceEl.innerHTML = '<span class="price">' + formatMoney(match.price_cents) + '</span>';
            }
          }
        }
      });
    });

    // Quantity buttons
    document.querySelectorAll('.quantity-btn').forEach(function(btn) {
      btn.addEventListener('click', function() {
        var input = btn.closest('.quantity-selector').querySelector('input');
        var action = btn.dataset.action;
        var val = parseInt(input.value) || 1;
        if (action === 'increase') val = Math.min(val + 1, 99);
        if (action === 'decrease') val = Math.max(val - 1, 1);
        input.value = val;
      });
    });

    // Add to cart (client-side)
    form.addEventListener('submit', function(e) {
      e.preventDefault();
      var variantId = variantInput.value;
      var quantity = parseInt(document.getElementById('product-quantity')?.value) || 1;

      // Find current variant data
      var variant = variants.find(function(v) { return v.id === variantId; }) || variants[0];
      if (!variant) return;

      // Build variant title (e.g. "M / Schwarz")
      var variantTitle = [variant.option1, variant.option2, variant.option3].filter(Boolean).join(' / ');

      // Get product info from page
      var productTitle = document.querySelector('.product-info__title')?.textContent || 'Produkt';
      var productImage = document.getElementById('product-main-image')?.src || '';
      var slug = window.location.pathname.split('/').pop().replace('.html', '');

      Cart.add({
        variant_id: variantId,
        product_title: productTitle,
        variant_title: variantTitle,
        price_cents: variant.price_cents,
        quantity: quantity,
        image: productImage,
        slug: slug,
      });

      // Button feedback
      var btn = document.getElementById('add-to-cart');
      var originalText = btn.textContent;
      btn.textContent = '✓ Hinzugefügt!';
      btn.disabled = true;
      setTimeout(function() {
        btn.textContent = originalText;
        btn.disabled = false;
      }, 1500);
    });

    // Image gallery thumbnails
    document.querySelectorAll('.product-gallery__thumb').forEach(function(thumb) {
      thumb.addEventListener('click', function() {
        document.querySelectorAll('.product-gallery__thumb').forEach(function(t) { t.classList.remove('active'); });
        thumb.classList.add('active');
        var mainImg = document.getElementById('product-main-image');
        if (mainImg) mainImg.src = thumb.dataset.src;
      });
    });
  }

  // ══════════════════════════════════
  // MOBILE MENU
  // ══════════════════════════════════
  function initMobileMenu() {
    var toggle = document.getElementById('mobile-menu-toggle');
    var nav = document.getElementById('mobile-nav');
    if (!toggle || !nav) return;

    toggle.addEventListener('click', function() {
      var isOpen = !nav.hidden;
      nav.hidden = isOpen;
      toggle.classList.toggle('active', !isOpen);
    });
  }

  // ══════════════════════════════════
  // FAQ ACCORDION
  // ══════════════════════════════════
  function initFAQ() {
    document.querySelectorAll('.faq-item__question').forEach(function(btn) {
      btn.addEventListener('click', function() {
        var expanded = btn.getAttribute('aria-expanded') === 'true';
        btn.setAttribute('aria-expanded', !expanded);
        var answer = btn.nextElementSibling;
        if (answer) answer.hidden = expanded;
      });
    });
  }

  // ══════════════════════════════════
  // CART DRAWER EVENTS
  // ══════════════════════════════════
  function initCartDrawer() {
    var toggle = document.getElementById('cart-toggle');
    var close = document.getElementById('cart-drawer-close');
    var overlay = document.getElementById('cart-drawer-overlay');

    if (toggle) toggle.addEventListener('click', function() { Cart.openDrawer(); });
    if (close) close.addEventListener('click', function() { Cart.closeDrawer(); });
    if (overlay) overlay.addEventListener('click', function() { Cart.closeDrawer(); });

    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape') Cart.closeDrawer();
    });
  }

  // ══════════════════════════════════
  // INIT
  // ══════════════════════════════════
  document.addEventListener('DOMContentLoaded', function() {
    Cart.init();
    initProductPage();
    initMobileMenu();
    initFAQ();
    initCartDrawer();
  });

})();
