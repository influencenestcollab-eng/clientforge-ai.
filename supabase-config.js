// ======================================================
// SUPABASE CONFIG — Replace with your actual keys
// Get these from: https://supabase.com/dashboard
// ======================================================
const SUPABASE_URL = 'https://feytuhtffaxezjvtdmxd.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_5obIofLu21KrXHn1mT_X_g_-u0GdsCP';

// Razorpay Key — Get from: https://dashboard.razorpay.com
const RAZORPAY_KEY_ID = 'rzp_live_RQYexCso4IsMw2';

// Prices (Razorpay accepts amounts in smallest currency unit)
const PRICE_INR = 49900; // ₹499 in paise
const PRICE_USD = 699;   // $6.99 in cents

// Initialize Supabase client
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
