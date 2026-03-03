// Supabase Edge Function: create-razorpay-order (v2)
// Handles Starter and Pro plan pricing for INR/USD

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const RAZORPAY_KEY_ID = Deno.env.get('RAZORPAY_KEY_ID') || '';
const RAZORPAY_KEY_SECRET = Deno.env.get('RAZORPAY_KEY_SECRET') || '';

const PRICES: Record<string, Record<string, { amount: number; currency: string }>> = {
  inr: {
    starter: { amount: 49900, currency: 'INR' },  // ₹499
    pro:     { amount: 99900, currency: 'INR' },  // ₹999
  },
  usd: {
    starter: { amount: 699,  currency: 'USD' },   // $6.99
    pro:     { amount: 1499, currency: 'USD' },   // $14.99
  },
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization') || '';
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user }, error } = await supabaseClient.auth.getUser();
    if (error || !user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders });

    const { currency = 'inr', plan = 'starter' } = await req.json();

    const priceInfo = PRICES[currency]?.[plan];
    if (!priceInfo) return new Response(JSON.stringify({ error: 'Invalid plan or currency' }), { status: 400, headers: corsHeaders });

    const auth = btoa(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`);
    const orderRes = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: { 'Authorization': `Basic ${auth}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        amount: priceInfo.amount,
        currency: priceInfo.currency,
        receipt: `${plan}_${user.id.slice(0, 8)}_${Date.now()}`,
        notes: { user_id: user.id, plan }
      }),
    });

    const order = await orderRes.json();
    if (!orderRes.ok) throw new Error(order.error?.description || 'Razorpay error');
    return new Response(JSON.stringify({ ...order, plan }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
