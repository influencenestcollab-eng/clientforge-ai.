// Supabase Edge Function: generate-outreach (v2)
// Enforces 100 campaign/month limit for 'active' (starter) plan
// Deploy: supabase functions deploy generate-outreach

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const HUGGINGFACE_API_KEY = Deno.env.get('HUGGINGFACE_API_KEY') || '';
const HF_MODEL = 'meta-llama/Llama-3.1-8B-Instruct';
const HF_API_URL = `https://router.huggingface.co/models/${HF_MODEL}`;
const STARTER_LIMIT = 100;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-auth',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    // 1. Check for User Token
    const token = req.headers.get('X-Supabase-Auth')?.trim();
    if (!token) {
      console.error('ERROR: No X-Supabase-Auth header');
      return new Response(JSON.stringify({ error: 'Missing token', details: 'No X-Supabase-Auth header found' }), { 
        status: 401, 
        headers: corsHeaders 
      });
    }

    // 2. Initialize Supabase Admin
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !serviceRole) {
      console.error('ERROR: Missing Supabase Environment Variables');
      return new Response(JSON.stringify({ 
        error: 'System Configuration Error', 
        details: 'Server is missing SUPABASE_SERVICE_ROLE_KEY secret.' 
      }), { status: 500, headers: corsHeaders });
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRole);

    // 3. Verify User
    let user;
    try {
      const { data, error: authError } = await supabaseAdmin.auth.getUser(token);
      if (authError || !data?.user) {
        console.error('Auth Error:', authError?.message || 'No user data');
        return new Response(JSON.stringify({ 
          error: 'Unauthorized', 
          details: authError?.message || 'Invalid session - please try logging out and in again.'
        }), { status: 401, headers: corsHeaders });
      }
      user = data.user;
    } catch (e) {
      console.error('CRASH in auth.getUser:', e.message);
      throw new Error(`User verification crashed: ${e.message}`);
    }

    console.log('Verification Success! User:', user.email);

    // 4. Check for AI API Key
    if (!HUGGINGFACE_API_KEY) {
      console.error('ERROR: Missing HUGGINGFACE_API_KEY');
      return new Response(JSON.stringify({ 
        error: 'System Configuration Error', 
        details: 'HuggingFace API Key is not set in Supabase Secrets.' 
      }), { status: 500, headers: corsHeaders });
    }

    // 5. Check subscription & usage
    let profile;
    try {
      const { data, error: profileErr } = await supabaseAdmin
        .from('profiles')
        .select('subscription_status, subscription_plan, campaigns_used_this_month, billing_period_start')
        .eq('id', user.id)
        .single();

      if (profileErr || !data) {
        console.error('Profile Error:', profileErr);
        return new Response(JSON.stringify({ error: 'Profile not found', details: profileErr?.message }), { status: 404, headers: corsHeaders });
      }
      profile = data;
    } catch (e) {
      console.error('CRASH in profile check:', e.message);
      throw new Error(`Profile check crashed: ${e.message}`);
    }

    const { subscription_status, subscription_plan, campaigns_used_this_month, billing_period_start } = profile;

    // Must have active subscription
    if (subscription_status !== 'active' && subscription_status !== 'pro') {
      return new Response(JSON.stringify({ 
        error: 'No active subscription', 
        code: 'NO_SUB',
        details: 'Your account is not active. Please complete payment.' 
      }), { status: 403, headers: corsHeaders });
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

    // 6. Build Prompt & Call AI (OpenAI Compatible)
    let body;
    try {
      body = await req.json();
    } catch (e) {
      return new Response(JSON.stringify({ error: 'Invalid JSON body' }), { status: 400, headers: corsHeaders });
    }

    const { yourName, yourCompany, niche, offerDesc, receiverName, channel, prospectDesc, tone } = body;
    const prompt = `You are an elite B2B sales copywriter. Your goal is to write a high-converting 10-step outreach sequence.
TONE: ${tone}
SENDER: ${yourName} (${yourCompany}), Niche: ${niche}
OFFER: ${offerDesc}
PROSPECT: ${receiverName} (${prospectDesc})
CHANNEL: ${channel}

Write FULL, complete message bodies for every step. Do NOT just write subjects.

Return ONLY a JSON object with these EXACT keys:
- email1: FULL Cold Email (Curiosity hook). Include "Subject:" line at the very top.
- email2: FULL Cold Email (Authority/Case Study). Include "Subject:" line at the very top.
- email3: FULL Cold Email (Direct ROI). Include "Subject:" line at the very top.
- dm1: FULL ${channel} DM Opener (Short & Punchy).
- dm2: FULL ${channel} Follow-up (Value-first).
- dm3: FULL ${channel} Follow-up (Soft CTA).
- fu1: FULL Day 3 Follow-up Email (Bump).
- fu2: FULL Day 7 Follow-up Email (New angle).
- fu3: FULL Day 14 Follow-up Email (Short teaser).
- fu4: FULL Day 21 Break-up Email.

IMPORTANT: Each value must be the COMPLETE body of the message. No summaries or IDs.
Return ONLY the JSON. No other text.`;

    const hfRes = await fetch('https://router.huggingface.co/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${HUGGINGFACE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: HF_MODEL,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7,
        max_tokens: 2500,
        response_format: { type: 'json_object' }
      }),
    });

    if (!hfRes.ok) {
       const hfErr = await hfRes.json().catch(() => ({}));
       console.error('AI Provider Error:', hfErr);
       throw new Error(`AI Service Error: ${hfErr.error?.message || hfRes.statusText}`);
    }

    const hfData = await hfRes.json();
    const rawText = hfData?.choices?.[0]?.message?.content || '';

    // Extract JSON in case of extra text
    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('AI returned an invalid format. Please try again.');
    const parsed = JSON.parse(jsonMatch[0]);

    // 7. Increment usage counter
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
    console.error('GLOBAL GENERATOR ERROR:', err.message);
    return new Response(JSON.stringify({ 
      error: 'Generator Error', 
      details: err.message 
    }), { status: 500, headers: corsHeaders });
  }
});
