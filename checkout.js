// checkout.js — Two-plan checkout with Razorpay

document.addEventListener('DOMContentLoaded', async () => {

  // Prices in smallest currency unit
  const PRICES = {
    inr: { starter: { amount: 49900, label: '₹499', display: '₹499' }, pro: { amount: 99900, label: '₹999', display: '₹999' } },
    usd: { starter: { amount: 699, label: '$6.99', display: '$6.99' }, pro: { amount: 1499, label: '$14.99', display: '$14.99' } },
  };

  let currency = 'inr';

  const inrBtn = document.getElementById('inrBtn');
  const usdBtn = document.getElementById('usdBtn');

  function setCurrency(cur) {
    currency = cur;
    inrBtn.classList.toggle('active', cur === 'inr');
    usdBtn.classList.toggle('active', cur === 'usd');
    const p = PRICES[cur];
    document.getElementById('starterPrice').innerHTML = `${p.starter.display}<span>/mo</span>`;
    document.getElementById('proPrice').innerHTML = `${p.pro.display}<span>/mo</span>`;
    document.getElementById('starterPayBtn').textContent = `Get Starter — ${p.starter.display}/mo`;
    document.getElementById('proPayBtn').textContent = `Get Pro — ${p.pro.display}/mo`;
  }

  inrBtn.addEventListener('click', () => setCurrency('inr'));
  usdBtn.addEventListener('click', () => setCurrency('usd'));
  setCurrency('inr'); // default

  // ─── Pay buttons ───
  document.querySelectorAll('.plan-pay-btn').forEach(btn => {
    btn.addEventListener('click', () => initiatePayment(btn.dataset.plan));
  });

  async function initiatePayment(plan) {
    const statusEl = document.getElementById('paymentStatus');
    statusEl.textContent = '';

    const { data: { session }, error: sessionErr } = await supabaseClient.auth.getSession();
    
    // If no session or error, redirect to login
    if (sessionErr || !session) {
      console.error('Session error or missing:', sessionErr);
      alert('Your session has expired. Please log in again.');
      window.location.href = 'auth.html';
      return;
    }

    // DEBUG: Log token payload
    try {
      const base64Url = session.access_token.split('.')[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const payload = JSON.parse(atob(base64));
      console.log('JWT Payload:', payload);
      alert('🔒 JWT DEBUG\nToken Project: ' + payload.ref + '\nUser: ' + payload.email + '\n\nIf project is NOT feytuhtffaxezjvtdmxd, that is the issue!');
    } catch (e) {
      console.error('Failed to decode token:', e);
      alert('Error decoding token. See console.');
    }

    const planBtn = document.getElementById(plan + 'PayBtn');
    const originalText = planBtn.textContent;
    planBtn.textContent = 'Creating order…'; planBtn.disabled = true;

    try {
      const orderRes = await fetch(`${SUPABASE_URL}/functions/v1/create-razorpay-order`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ currency, plan })
      });

      if (!orderRes.ok) {
        const errData = await orderRes.json().catch(() => ({}));
        console.error('Order creation failed:', errData);
        alert('Server Error: ' + (errData.details || errData.error || 'Check console'));
        throw new Error(errData.details || 'Could not create payment order.');
      }
      const order = await orderRes.json();

      const rzp = new Razorpay({
        key: RAZORPAY_KEY_ID,
        amount: order.amount,
        currency: order.currency,
        name: 'ClientForge AI',
        description: plan === 'pro' ? 'Pro Plan — Unlimited Campaigns' : 'Starter Plan — 100 Campaigns/mo',
        order_id: order.id,
        prefill: { email: session.user.email || '' },
        theme: { color: '#00d4ff' },
        handler: async (response) => {
          statusEl.style.color = '#00c37f';
          statusEl.textContent = '✅ Payment successful! Activating your plan…';

          await fetch(`${SUPABASE_URL}/functions/v1/razorpay-webhook`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${session.access_token}`
            },
            body: JSON.stringify({
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_order_id: response.razorpay_order_id,
              razorpay_signature: response.razorpay_signature,
              currency, plan
            })
          });

          setTimeout(() => { window.location.href = 'generator.html'; }, 1800);
        },
        modal: {
          ondismiss: () => { planBtn.textContent = originalText; planBtn.disabled = false; }
        }
      });
      rzp.on('payment.failed', (r) => {
        statusEl.style.color = '#ff6b6b';
        statusEl.textContent = '❌ ' + r.error.description;
        planBtn.textContent = originalText; planBtn.disabled = false;
      });
      rzp.open();

    } catch (err) {
      statusEl.style.color = '#ff6b6b';
      statusEl.textContent = '❌ ' + err.message;
      planBtn.textContent = originalText; planBtn.disabled = false;
    }
  }

});
