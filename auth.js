// auth.js — Email/Password Authentication (v4)

document.addEventListener('DOMContentLoaded', () => {

  let isLogin = true;

  const authForm = document.getElementById('authForm');
  const authTitle = document.getElementById('authTitle');
  const authSubtitle = document.getElementById('authSubtitle');
  const authSubmitBtn = document.getElementById('authSubmitBtn');
  const authErr = document.getElementById('authErr');
  const toggleAuthMode = document.getElementById('toggleAuthMode');
  const toggleText = document.getElementById('toggleText');

  // ─── Toggle between Login and Signup ───
  toggleAuthMode.addEventListener('click', (e) => {
    e.preventDefault();
    isLogin = !isLogin;
    
    if (isLogin) {
      authTitle.textContent = 'Sign In';
      authSubtitle.textContent = 'Enter your credentials to access your account.';
      authSubmitBtn.textContent = 'Sign In →';
      toggleText.innerHTML = `Don't have an account? <a href="#" id="toggleAuthMode">Create one</a>`;
    } else {
      authTitle.textContent = 'Create Account';
      authSubtitle.textContent = 'Start your journey with ClientForge AI today.';
      authSubmitBtn.textContent = 'Create Account →';
      toggleText.innerHTML = `Already have an account? <a href="#" id="toggleAuthMode">Sign in</a>`;
    }
    
    // Re-attach event listener to the new link
    document.getElementById('toggleAuthMode').addEventListener('click', arguments.callee);
  });

  // ─── Handle Form Submission ───
  authForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('emailInput').value.trim();
    const password = document.getElementById('passwordInput').value;
    
    authErr.textContent = '';
    authSubmitBtn.textContent = isLogin ? 'Signing in...' : 'Creating account...';
    authSubmitBtn.disabled = true;

    try {
      if (isLogin) {
        // LOGIN
        const { data, error } = await supabaseClient.auth.signInWithPassword({
          email: email,
          password: password,
        });
        if (error) throw error;
        await handleAuthSuccess(data.user);
      } else {
        // SIGNUP
        const { data, error } = await supabaseClient.auth.signUp({
          email: email,
          password: password,
        });
        if (error) throw error;
        
        // If email confirmation is ON, notify user. Otherwise, log them in.
        if (data.session) {
          await handleAuthSuccess(data.user);
        } else {
          authErr.style.color = '#00c37f';
          authErr.textContent = 'Account created! Please check your email to confirm your signup.';
          authSubmitBtn.textContent = 'Account Created ✅';
        }
      }
    } catch (err) {
      authErr.style.color = '#ff6b6b';
      authErr.textContent = err.message;
      authSubmitBtn.textContent = isLogin ? 'Sign In →' : 'Create Account →';
      authSubmitBtn.disabled = false;
    }
  });

  async function handleAuthSuccess(user) {
    // Check if user has active subscription
    const { data: profile } = await supabaseClient
      .from('profiles')
      .select('subscription_status')
      .eq('id', user.id)
      .single();

    if (profile?.subscription_status === 'active' || profile?.subscription_status === 'pro') {
      window.location.href = 'generator.html';
    } else {
      window.location.href = 'checkout.html';
    }
  }

});
