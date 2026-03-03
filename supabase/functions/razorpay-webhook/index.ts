// Supabase Edge Function: razorpay-webhook (v2)
// Verifies payment and activates correct plan (starter or pro)

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { crypto } from 'https://deno.land/std@0.177.0/crypto/mod.ts';

const RAZORPAY_KEY_SECRET = Deno.env.get('RAZORPAY_KEY_SECRET') || '';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization') || '';
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );
    const supabaseUser = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error } = await supabaseUser.auth.getUser();
    if (error || !user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders });

    const { razorpay_payment_id, razorpay_order_id, razorpay_signature, plan } = await req.json();

    // Verify HMAC signature
    const body = razorpay_order_id + '|' + razorpay_payment_id;
    const key = await crypto.subtle.importKey(
      'raw', new TextEncoder().encode(RAZORPAY_KEY_SECRET),
      { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
    );
    const sigBytes = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(body));
    const hexSig = Array.from(new Uint8Array(sigBytes)).map(b => b.toString(16).padStart(2, '0')).join('');

    if (hexSig !== razorpay_signature) {
      return new Response(JSON.stringify({ error: 'Invalid payment signature' }), { status: 400, headers: corsHeaders });
    }

    // Activate correct plan
    const status = plan === 'pro' ? 'pro' : 'active'; // 'pro' is unlimited plan
    await supabaseAdmin
      .from('profiles')
      .upsert({
        id: user.id,
        subscription_status: status,
        subscription_plan: plan,
        subscription_start: new Date().toISOString(),
        billing_period_start: new Date().toISOString(),
        campaigns_used_this_month: 0,
        razorpay_payment_id,
      });

    return new Response(JSON.stringify({ success: true, plan }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
