// auth.js — Email OTP Login (no password, no Google)

document.addEventListener('DOMContentLoaded', () => {

  let userEmail = '';

  // ─── STEP 1: Send OTP ───
  document.getElementById('emailForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('sendOtpBtn');
    const errEl = document.getElementById('emailErr');
    errEl.textContent = '';
    userEmail = document.getElementById('emailInput').value.trim();

    btn.textContent = 'Sending…'; btn.disabled = true;
    console.log('Attempting to send OTP to:', userEmail);

    try {
      const { error } = await supabaseClient.auth.signInWithOtp({
        email: userEmail,
        options: { shouldCreateUser: true }
      });

      console.log('Supabase response received:', { error });

      if (error) {
        errEl.textContent = error.message;
        btn.textContent = 'Send Code →'; btn.disabled = false;
      } else {
        // Show OTP step
        document.getElementById('stepEmail').style.display = 'none';
        document.getElementById('stepOtp').style.display = 'block';
        document.getElementById('otpSentTo').textContent =
          `We sent a code to ${userEmail}`;
        document.getElementById('otpInput').focus();
      }
    } catch (err) {
      console.error('Unexpected error during signInWithOtp:', err);
      errEl.textContent = 'Connection error. Please check your internet and try again.';
      btn.textContent = 'Send Code →'; btn.disabled = false;
    }
  });

  // ─── STEP 2: Verify OTP ───
  document.getElementById('otpForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('verifyOtpBtn');
    const errEl = document.getElementById('otpErr');
    const otp = document.getElementById('otpInput').value.trim();
    errEl.textContent = '';

    if (!/^\d{6,8}$/.test(otp)) {
      errEl.textContent = 'Please enter the valid code from your email (6-8 digits).';
      return;
    }

    btn.textContent = 'Verifying…'; btn.disabled = true;

    const { data, error } = await supabaseClient.auth.verifyOtp({
      email: userEmail,
      token: otp,
      type: 'email'
    });

    if (error) {
      errEl.textContent = 'Invalid or expired code. Please try again.';
      btn.textContent = 'Verify & Continue →'; btn.disabled = false;
    } else {
      // Check if user has active subscription
      const { data: profile } = await supabase
        .from('profiles')
        .select('subscription_status')
        .eq('id', data.user.id)
        .single();

      if (profile?.subscription_status === 'active' || profile?.subscription_status === 'pro') {
        window.location.href = 'generator.html';
      } else {
        window.location.href = 'checkout.html';
      }
    }
  });

  // ─── Resend OTP ───
  document.getElementById('resendBtn').addEventListener('click', async () => {
    const btn = document.getElementById('resendBtn');
    btn.textContent = 'Sending…'; btn.disabled = true;
    await supabase.auth.signInWithOtp({ email: userEmail });
    setTimeout(() => { btn.textContent = 'Resend code'; btn.disabled = false; }, 3000);
  });

});
