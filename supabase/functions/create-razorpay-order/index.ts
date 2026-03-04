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
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-auth',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, PUT, DELETE',
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
          details: authError?.message || 'Invalid session'
        }), { status: 401, headers: corsHeaders });
      }
      user = data.user;
    } catch (e) {
      console.error('CRASH in auth.getUser:', e.message);
      throw new Error(`User verification crashed: ${e.message}`);
    }

    console.log('Verification Success! User:', user.email);

    // 4. Parse Request
    let body;
    try {
      body = await req.json();
    } catch (e) {
      return new Response(JSON.stringify({ error: 'Invalid JSON body' }), { status: 400, headers: corsHeaders });
    }

    const { currency = 'inr', plan = 'starter' } = body;
    const priceInfo = PRICES[currency]?.[plan];
    if (!priceInfo) return new Response(JSON.stringify({ error: 'Invalid plan or currency' }), { status: 400, headers: corsHeaders });

    // 5. Razorpay Interaction
    if (!RAZORPAY_KEY_ID || !RAZORPAY_KEY_SECRET) {
      console.error('ERROR: Missing Razorpay Keys');
      return new Response(JSON.stringify({ 
        error: 'System Configuration Error', 
        details: 'Razorpay API keys are not set in Supabase Secrets.' 
      }), { status: 500, headers: corsHeaders });
    }

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
    if (!orderRes.ok) {
        console.error('Razorpay API Error:', order);
        throw new Error(order.error?.description || 'Razorpay order creation failed');
    }

    return new Response(JSON.stringify({ ...order, plan }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (err) {
    console.error('GLOBAL FUNCTION ERROR:', err.message);
    return new Response(JSON.stringify({ 
        error: 'Edge Function Error', 
        details: err.message 
    }), { status: 500, headers: corsHeaders });
  }
});
