/* ═════════════════════════════════════════════════
   ShopForge — Theme JavaScript
   Cart, Variant Selection, FAQ, Mobile Menu
   ═════════════════════════════════════════════════ */

(function() {
  'use strict';

  // ══════════════════════════════════
  // CART SYSTEM
  // ══════════════════════════════════
  const Cart = {
    getItems() {
      try {
        const raw = document.cookie.split(';').find(c => c.trim().startsWith('cart='));
        if (!raw) return [];
        return JSON.parse(decodeURIComponent(raw.split('=').slice(1).join('=')));
      } catch { return []; }
    },

    async add(variantId, quantity = 1) {
      const res = await fetch('/cart/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ variant_id: variantId, quantity }),
      });
      const data = await res.json();
      this.updateUI(data);
      this.openDrawer();
      return data;
    },

    async update(variantId, quantity) {
      const res = await fetch('/cart/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ variant_id: variantId, quantity }),
      });
      const data = await res.json();
      this.updateUI(data);
      return data;
    },

    updateUI(data) {
      // Update cart count
      const countEl = document.getElementById('cart-count');
      if (countEl) countEl.textContent = data.total_items || 0;

      // Update cart drawer
      this.renderDrawer(data);
    },

    renderDrawer(data) {
      const itemsEl = document.getElementById('cart-drawer-items');
      const totalEl = document.getElementById('cart-drawer-total');
      if (!itemsEl) return;

      if (!data.cart || data.cart.length === 0) {
        itemsEl.innerHTML = '<div class="cart-drawer__empty"><p>Dein Warenkorb ist leer.</p></div>';
        if (totalEl) totalEl.textContent = '0,00 €';
        return;
      }

      itemsEl.innerHTML = data.cart.map(item => `
        <div class="cart-drawer-item" style="display:flex;gap:12px;padding:12px 0;border-bottom:1px solid #eee;">
          <div style="width:64px;height:80px;background:#f5f5f5;border-radius:4px;overflow:hidden;flex-shrink:0;">
            ${item.image ? `<img src="${item.image}" style="width:100%;height:100%;object-fit:cover;">` : ''}
          </div>
          <div style="flex:1;">
            <div style="font-weight:600;font-size:0.875rem;">${item.title}</div>
            <div style="font-size:0.75rem;color:#999;">${item.variant_title}</div>
            <div style="font-size:0.875rem;margin-top:4px;">${formatMoney(item.price_cents)} × ${item.quantity}</div>
          </div>
          <button onclick="Cart.update('${item.variant_id}', 0)" style="color:#999;padding:4px;font-size:1rem;background:none;border:none;cursor:pointer;">✕</button>
        </div>
      `).join('');

      if (totalEl) totalEl.textContent = formatMoney(data.total_cents);
    },

    openDrawer() {
      const drawer = document.getElementById('cart-drawer');
      if (drawer) drawer.hidden = false;
      document.body.style.overflow = 'hidden';
    },

    closeDrawer() {
      const drawer = document.getElementById('cart-drawer');
      if (drawer) drawer.hidden = true;
      document.body.style.overflow = '';
    },

    init() {
      // Initial count from cookie
      const items = this.getItems();
      const total = items.reduce((sum, i) => sum + i.quantity, 0);
      const totalCents = items.reduce((sum, i) => sum + (i.price_cents * i.quantity), 0);
      const countEl = document.getElementById('cart-count');
      if (countEl) countEl.textContent = total;
      this.renderDrawer({ cart: items, total_items: total, total_cents: totalCents });
    }
  };

  // Make Cart globally accessible
  window.Cart = Cart;

  // ══════════════════════════════════
  // HELPERS
  // ══════════════════════════════════
  function formatMoney(cents) {
    if (!cents && cents !== 0) return '0,00 €';
    return (cents / 100).toFixed(2).replace('.', ',') + ' €';
  }

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
    document.querySelectorAll('.variant-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        // Toggle active in same group
        const group = btn.closest('.variant-buttons');
        group.querySelectorAll('.variant-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        // Find matching variant
        const selected = {};
        document.querySelectorAll('.variant-buttons').forEach((g, i) => {
          const activeBtn = g.querySelector('.variant-btn.active');
          if (activeBtn) selected['option' + (i + 1)] = activeBtn.dataset.value;
        });

        const match = variants.find(v =>
          (!selected.option1 || v.option1 === selected.option1) &&
          (!selected.option2 || v.option2 === selected.option2) &&
          (!selected.option3 || v.option3 === selected.option3)
        );

        if (match) {
          variantInput.value = match.id;
          // Update price
          if (priceEl) {
            if (match.compare_at_price_cents) {
              priceEl.innerHTML = `
                <span class="price price--sale">${formatMoney(match.price_cents)}</span>
                <span class="price price--compare">${formatMoney(match.compare_at_price_cents)}</span>
                <span class="price-badge">Sale</span>
              `;
            } else {
              priceEl.innerHTML = `<span class="price">${formatMoney(match.price_cents)}</span>`;
            }
          }
        }
      });
    });

    // Quantity buttons
    document.querySelectorAll('.quantity-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const input = btn.closest('.quantity-selector').querySelector('input');
        const action = btn.dataset.action;
        let val = parseInt(input.value) || 1;
        if (action === 'increase') val = Math.min(val + 1, 99);
        if (action === 'decrease') val = Math.max(val - 1, 1);
        input.value = val;
      });
    });

    // Add to cart form
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const variantId = variantInput.value;
      const quantity = parseInt(document.getElementById('product-quantity')?.value) || 1;
      
      const btn = document.getElementById('add-to-cart');
      const originalText = btn.textContent;
      btn.textContent = 'Wird hinzugefügt...';
      btn.disabled = true;
      
      await Cart.add(variantId, quantity);
      
      btn.textContent = '✓ Hinzugefügt!';
      setTimeout(() => {
        btn.textContent = originalText;
        btn.disabled = false;
      }, 1500);
    });

    // Image gallery thumbnails
    document.querySelectorAll('.product-gallery__thumb').forEach(thumb => {
      thumb.addEventListener('click', () => {
        document.querySelectorAll('.product-gallery__thumb').forEach(t => t.classList.remove('active'));
        thumb.classList.add('active');
        const mainImg = document.getElementById('product-main-image');
        if (mainImg) mainImg.src = thumb.dataset.src;
      });
    });
  }

  // ══════════════════════════════════
  // CART PAGE — Quantity Updates
  // ══════════════════════════════════
  function initCartPage() {
    document.querySelectorAll('.cart-qty-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const variantId = btn.dataset.variant;
        const action = btn.dataset.action;
        const item = btn.closest('.cart-item');
        const input = item?.querySelector('input[type="number"]');
        let qty = parseInt(input?.value) || 1;

        if (action === 'increase') qty++;
        if (action === 'decrease') qty = Math.max(qty - 1, 0);
        if (action === 'remove') qty = 0;

        await Cart.update(variantId, qty);
        // Reload cart page to reflect changes
        window.location.reload();
      });
    });
  }

  // ══════════════════════════════════
  // MOBILE MENU
  // ══════════════════════════════════
  function initMobileMenu() {
    const toggle = document.getElementById('mobile-menu-toggle');
    const nav = document.getElementById('mobile-nav');
    if (!toggle || !nav) return;

    toggle.addEventListener('click', () => {
      const isOpen = !nav.hidden;
      nav.hidden = isOpen;
      toggle.classList.toggle('active', !isOpen);
    });
  }

  // ══════════════════════════════════
  // FAQ ACCORDION
  // ══════════════════════════════════
  function initFAQ() {
    document.querySelectorAll('.faq-item__question').forEach(btn => {
      btn.addEventListener('click', () => {
        const expanded = btn.getAttribute('aria-expanded') === 'true';
        btn.setAttribute('aria-expanded', !expanded);
        const answer = btn.nextElementSibling;
        if (answer) answer.hidden = expanded;
      });
    });
  }

  // ══════════════════════════════════
  // CART DRAWER EVENTS
  // ══════════════════════════════════
  function initCartDrawer() {
    const toggle = document.getElementById('cart-toggle');
    const close = document.getElementById('cart-drawer-close');
    const overlay = document.getElementById('cart-drawer-overlay');

    if (toggle) toggle.addEventListener('click', () => Cart.openDrawer());
    if (close) close.addEventListener('click', () => Cart.closeDrawer());
    if (overlay) overlay.addEventListener('click', () => Cart.closeDrawer());

    // ESC key closes drawer
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') Cart.closeDrawer();
    });
  }

  // ══════════════════════════════════
  // ANALYTICS TRACKING
  // ══════════════════════════════════
  function initAnalytics() {
    // Generate/retrieve visitor ID
    let visitorId = localStorage.getItem('sf_visitor_id');
    if (!visitorId) {
      visitorId = 'v_' + Math.random().toString(36).substr(2, 9) + Date.now().toString(36);
      localStorage.setItem('sf_visitor_id', visitorId);
    }

    let sessionId = sessionStorage.getItem('sf_session_id');
    if (!sessionId) {
      sessionId = 's_' + Math.random().toString(36).substr(2, 9) + Date.now().toString(36);
      sessionStorage.setItem('sf_session_id', sessionId);
    }

    // Track page view
    fetch('/api/analytics/event', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event_type: 'page_view',
        session_id: sessionId,
        visitor_id: visitorId,
        page_url: window.location.pathname,
        referrer: document.referrer,
      }),
    }).catch(() => {}); // Silent fail
  }

  // ══════════════════════════════════
  // INIT
  // ══════════════════════════════════
  document.addEventListener('DOMContentLoaded', () => {
    Cart.init();
    initProductPage();
    initCartPage();
    initMobileMenu();
    initFAQ();
    initCartDrawer();
    initAnalytics();
  });

})();
