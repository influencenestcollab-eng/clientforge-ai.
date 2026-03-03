// ======================================================
// SUPABASE CONFIG — Replace with your actual keys
// Get these from: https://supabase.com/dashboard
// ======================================================
const SUPABASE_URL = 'https://feytuhtffaxezjvtdmxd.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZleXR1aHRmZmF4ZXpqdnRkbXhkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI1Mzg1ODAsImV4cCI6MjA4ODExNDU4MH0.6qZxMhqN49prh5gpSLBCH8ylU3fMdi4gOCUIh82qA50';

// Razorpay Key — Get from: https://dashboard.razorpay.com
const RAZORPAY_KEY_ID = 'rzp_live_RQYexCso4IsMw2';

// Prices (Razorpay accepts amounts in smallest currency unit)
const PRICE_INR = 49900; // ₹499 in paise
const PRICE_USD = 699;   // $6.99 in cents

// Initialize Supabase client
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
