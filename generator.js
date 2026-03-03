// generator.js — AI Generation Logic (v2)
// Handles 100-campaign limit display and upgrade prompt

const STARTER_LIMIT = 100;

document.addEventListener('DOMContentLoaded', async () => {

  // ─── Auth Guard ───
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) { window.location.href = 'auth.html'; return; }

  // ─── Check subscription ───
  const { data: profile } = await supabase
    .from('profiles')
    .select('subscription_status, subscription_plan, campaigns_used_this_month')
    .eq('id', session.user.id)
    .single();

  const isSubscribed = profile?.subscription_status === 'active' || profile?.subscription_status === 'pro';
  const isPro = profile?.subscription_status === 'pro';
  const used = profile?.campaigns_used_this_month || 0;

  if (!isSubscribed) {
    document.getElementById('paywallOverlay').style.display = 'flex';
  } else {
    // Show plan badge
    const badge = document.getElementById('subBadge');
    badge.textContent = isPro ? 'PRO — Unlimited' : `STARTER — ${used}/${STARTER_LIMIT} used`;

    // Show usage bar
    renderUsageBar(used, isPro);
  }

  // ─── Logout ───
  document.getElementById('logoutBtn').addEventListener('click', async (e) => {
    e.preventDefault();
    await supabase.auth.signOut();
    window.location.href = 'index.html';
  });

  // ─── Output Tabs ───
  const outputTabs = document.querySelectorAll('.output-tab');
  outputTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      outputTabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      ['emailsTab','dmsTab','followupsTab'].forEach(id => document.getElementById(id).style.display = 'none');
      document.getElementById(tab.dataset.tab + 'Tab').style.display = 'block';
    });
  });

  // ─── Copy buttons ───
  document.querySelectorAll('.copy-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const bodyEl = document.getElementById(btn.dataset.target + '-body');
      navigator.clipboard.writeText(bodyEl.innerText).then(() => {
        btn.textContent = '✓ Copied!'; btn.classList.add('copied');
        setTimeout(() => { btn.textContent = 'Copy'; btn.classList.remove('copied'); }, 2000);
      });
    });
  });

  // ─── Copy All ───
  document.getElementById('copyAllBtn')?.addEventListener('click', () => {
    const allText = ['email1','email2','email3','dm1','dm2','dm3','fu1','fu2','fu3','fu4']
      .map(id => document.getElementById(id + '-body')?.innerText || '')
      .join('\n\n---\n\n');
    navigator.clipboard.writeText(allText);
  });

  // ─── Form Submit ───
  document.getElementById('outreachForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!isSubscribed) { document.getElementById('paywallOverlay').style.display = 'flex'; return; }

    // Local limit check for starter before hitting server
    if (!isPro && used >= STARTER_LIMIT) {
      showLimitReached(used);
      return;
    }

    const btn = document.getElementById('generateBtn');
    const label = document.getElementById('btnLabel');
    const spinner = document.getElementById('btnSpinner');
    label.style.display = 'none'; spinner.style.display = 'inline-block'; btn.disabled = true;

    const formData = {
      yourName: document.getElementById('yourName').value,
      yourCompany: document.getElementById('yourCompany').value || 'my company',
      niche: document.getElementById('niche').value,
      websiteUrl: document.getElementById('websiteUrl').value,
      offerDesc: document.getElementById('offerDesc').value,
      receiverName: document.getElementById('receiverName').value,
      channel: document.getElementById('channel').value,
      prospectDesc: document.getElementById('prospectDesc').value,
      tone: document.getElementById('tone').value,
    };

    try {
      const result = await callGenerateAPI(formData, session.access_token);
      if (result.error) {
        if (result.code === 'LIMIT_REACHED') { showLimitReached(result.used); return; }
        throw new Error(result.error);
      }

      // Update usage in UI
      if (result._meta) {
        const newUsed = result._meta.used;
        badge.textContent = isPro ? 'PRO — Unlimited' : `STARTER — ${newUsed}/${STARTER_LIMIT} used`;
        renderUsageBar(newUsed, isPro);
      }

      renderOutputs(result);
      document.getElementById('emptyState').style.display = 'none';
      document.getElementById('results').style.display = 'block';
      document.getElementById('results').scrollIntoView({ behavior: 'smooth' });
    } catch (err) {
      alert('Generation failed: ' + err.message);
    } finally {
      label.style.display = 'inline'; spinner.style.display = 'none'; btn.disabled = false;
    }
  });

});

// ─── API Call ───
async function callGenerateAPI(data, token) {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/generate-outreach`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify(data)
  });
  return await res.json();
}

// ─── Render ───
function renderOutputs(json) {
  const keys = ['email1','email2','email3','dm1','dm2','dm3','fu1','fu2','fu3','fu4'];
  keys.forEach(k => setOutput(k + '-body', json[k]));
}
function setOutput(id, text) {
  const el = document.getElementById(id);
  if (el) el.innerText = text || 'No output generated.';
}

// ─── Usage bar ───
function renderUsageBar(used, isPro) {
  const existing = document.getElementById('usageBarWrap');
  if (existing) existing.remove();
  if (isPro) return;

  const pct = Math.min((used / STARTER_LIMIT) * 100, 100);
  const color = pct >= 90 ? '#ff6b6b' : pct >= 70 ? '#ffb347' : '#00d4ff';
  const bar = document.createElement('div');
  bar.id = 'usageBarWrap';
  bar.innerHTML = `
    <div style="padding:0.75rem 1rem;border-bottom:1px solid var(--glass-border);font-size:0.8rem;color:var(--text-muted);">
      Monthly usage: <strong style="color:${color}">${used} / ${STARTER_LIMIT}</strong>
      <div style="margin-top:0.4rem;height:4px;background:rgba(255,255,255,0.06);border-radius:4px;overflow:hidden;">
        <div style="height:100%;width:${pct}%;background:${color};border-radius:4px;transition:width 0.4s;"></div>
      </div>
      ${pct >= 90 ? `<a href="checkout.html?plan=pro" style="color:#00d4ff;font-size:0.8rem;">Upgrade to Pro for unlimited →</a>` : ''}
    </div>`;
  document.querySelector('.form-panel').prepend(bar);
}

// ─── Limit reached UI ───
function showLimitReached(used) {
  document.getElementById('emptyState').innerHTML = `
    <div class="empty-icon">🚫</div>
    <h3>Monthly limit reached</h3>
    <p>You've used ${used} of ${STARTER_LIMIT} campaigns this month on the Starter plan.</p>
    <a href="checkout.html?plan=pro" class="btn-primary" style="margin-top:1rem;">Upgrade to Pro — Unlimited Campaigns →</a>`;
  document.getElementById('emptyState').style.display = 'flex';
  document.getElementById('results').style.display = 'none';
}
