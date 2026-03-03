// Supabase Edge Function: razorpay-webhook (v3)
// Verifies payment and activates correct plan (starter or pro)
// Supports both client-side verification and official server-to-server dashboard webhooks.

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { crypto } from 'https://deno.land/std@0.177.0/crypto/mod.ts';

const RAZORPAY_KEY_SECRET = Deno.env.get('RAZORPAY_KEY_SECRET') || '';
const RAZORPAY_WEBHOOK_SECRET = Deno.env.get('RAZORPAY_WEBHOOK_SECRET') || RAZORPAY_KEY_SECRET;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-razorpay-signature',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const rzpSignature = req.headers.get('x-razorpay-signature');
    const authHeader = req.headers.get('Authorization');

    // ─── CASE 1: Client-Side Verification (Auth Header present) ───
    if (authHeader && !rzpSignature) {
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

      await activateSub(supabaseAdmin, user.id, plan, razorpay_payment_id);
      return new Response(JSON.stringify({ success: true, plan }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // ─── CASE 2: Official Razorpay Dashboard Webhook (Signature present) ───
    if (rzpSignature) {
      const rawBody = await req.text();
      const key = await crypto.subtle.importKey(
        'raw', new TextEncoder().encode(RAZORPAY_WEBHOOK_SECRET),
        { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
      );
      const sigBytes = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(rawBody));
      const hexSig = Array.from(new Uint8Array(sigBytes)).map(b => b.toString(16).padStart(2, '0')).join('');

      if (hexSig !== rzpSignature) {
        return new Response(JSON.stringify({ error: 'Invalid webhook signature' }), { status: 400, headers: corsHeaders });
      }

      const event = JSON.parse(rawBody);
      
      // Handle 'order.paid' or 'payment.captured'
      if (event.event === 'order.paid' || event.event === 'payment.captured') {
        const payment = event.payload.payment.entity;
        const notes = event.payload.order?.entity?.notes || payment.notes;
        const userId = notes.user_id;
        const plan = notes.plan || 'starter';

        if (userId) {
          await activateSub(supabaseAdmin, userId, plan, payment.id);
        }
      }

      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    throw new Error('Invalid request source');

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

async function activateSub(supabaseAdmin, userId, plan, paymentId) {
  const status = plan === 'pro' ? 'pro' : 'active';
  await supabaseAdmin
    .from('profiles')
    .upsert({
      id: userId,
      subscription_status: status,
      subscription_plan: plan,
      subscription_start: new Date().toISOString(),
      billing_period_start: new Date().toISOString(),
      campaigns_used_this_month: 0,
      razorpay_payment_id: paymentId,
    });
}
