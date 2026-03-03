// Supabase Edge Function: generate-outreach (v2)
// Enforces 100 campaign/month limit for 'active' (starter) plan
// Deploy: supabase functions deploy generate-outreach

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const HUGGINGFACE_API_KEY = Deno.env.get('HUGGINGFACE_API_KEY') || '';
const HF_MODEL = 'mistralai/Mistral-7B-Instruct-v0.2';
const HF_API_URL = `https://api-inference.huggingface.co/models/${HF_MODEL}`;
const STARTER_LIMIT = 100;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    // ─── Auth ───
    const authHeader = req.headers.get('Authorization') || '';
    const supabaseUser = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { data: { user }, error: authErr } = await supabaseUser.auth.getUser();
    if (authErr || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders });
    }

    // ─── Check subscription & usage ───
    const { data: profile, error: profileErr } = await supabaseAdmin
      .from('profiles')
      .select('subscription_status, subscription_plan, campaigns_used_this_month, billing_period_start')
      .eq('id', user.id)
      .single();

    if (profileErr || !profile) {
      return new Response(JSON.stringify({ error: 'Profile not found' }), { status: 404, headers: corsHeaders });
    }

    const { subscription_status, subscription_plan, campaigns_used_this_month, billing_period_start } = profile;

    // Must have active subscription
    if (subscription_status !== 'active' && subscription_status !== 'pro') {
      return new Response(JSON.stringify({ error: 'No active subscription', code: 'NO_SUB' }), { status: 403, headers: corsHeaders });
    }

    // Reset monthly counter if new billing month
    const now = new Date();
    const periodStart = billing_period_start ? new Date(billing_period_start) : null;
    const needsReset = !periodStart ||
      (now.getFullYear() !== periodStart.getFullYear() || now.getMonth() !== periodStart.getMonth());

    let currentUsage = needsReset ? 0 : (campaigns_used_this_month || 0);

    // Enforce 100 limit for starter plan
    if (subscription_plan === 'starter' && currentUsage >= STARTER_LIMIT) {
      return new Response(JSON.stringify({
        error: 'Monthly limit reached',
        code: 'LIMIT_REACHED',
        used: currentUsage,
        limit: STARTER_LIMIT
      }), { status: 429, headers: corsHeaders });
    }

    // ─── Build Prompt ───
    const body = await req.json();
    const { yourName, yourCompany, niche, offerDesc, receiverName, channel, prospectDesc, tone } = body;

    const prompt = `[INST]
You are an elite B2B cold outreach copywriter. Write all of the following in a ${tone} tone.

Sender: ${yourName} from ${yourCompany || 'their company'}, niche: ${niche}.
Offer: ${offerDesc}
Prospect: ${receiverName} — ${prospectDesc}
Primary channel: ${channel}

Generate and return ONLY a valid JSON object with these keys:
- email1: Cold email with curiosity hook (under 130 words, include subject line at top labelled "Subject:")
- email2: Cold email with authority + result angle (under 130 words, include subject line)  
- email3: Cold email with direct ROI angle (under 130 words, include subject line)
- dm1: Short ${channel} DM opener (under 80 words)
- dm2: Value-first ${channel} DM (under 80 words)
- dm3: CTA-focused ${channel} DM (under 80 words)
- fu1: Follow-up for day 3 (under 60 words)
- fu2: Follow-up for day 7 with new angle (under 60 words)
- fu3: Follow-up for day 14 (under 60 words)
- fu4: Break-up message for day 21 (under 50 words)

Rules: No generic compliments. No buzzwords. No emojis. No spam trigger words (guarantee, 100%, free money).
Return ONLY the JSON. No other text.
[/INST]`;

    // ─── Call Hugging Face ───
    const hfRes = await fetch(HF_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${HUGGINGFACE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        inputs: prompt,
        parameters: { max_new_tokens: 2000, temperature: 0.72, return_full_text: false }
      }),
    });

    const hfData = await hfRes.json();
    const rawText = hfData?.[0]?.generated_text || '';

    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('AI returned an invalid format. Please try again.');
    const parsed = JSON.parse(jsonMatch[0]);

    // ─── Increment usage counter ───
    await supabaseAdmin
      .from('profiles')
      .update({
        campaigns_used_this_month: currentUsage + 1,
        billing_period_start: needsReset ? now.toISOString() : billing_period_start,
      })
      .eq('id', user.id);

    return new Response(JSON.stringify({
      ...parsed,
      _meta: { used: currentUsage + 1, limit: subscription_plan === 'pro' ? null : STARTER_LIMIT }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
