/**
 * Minimal self-contained HTML pages served for the two links that must work
 * from any browser (email client "open link" action) without the mobile app
 * installed: email verification and password reset. Kept intentionally
 * simple — no external assets/fonts, inline CSS only.
 *
 * No inline event-handler attributes (onclick=...) anywhere — helmet's
 * default CSP blocks those outright (script-src-attr 'none') and there's no
 * nonce mechanism for them. All interactivity lives in one nonce'd <script>
 * block wired up via addEventListener, so the global CSP stays untouched for
 * the rest of the API and only this response gets a scoped, nonce-based
 * script-src exception (see AuthController).
 */

function page(title: string, body: string, script?: { nonce: string; code: string }): string {
  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${title} — JIMI B2B</title>
<style>
  :root { color-scheme: light; }
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #f4f5f7; margin: 0; padding: 24px; display: flex; min-height: 100vh; align-items: center; justify-content: center; }
  .card { background: #fff; border-radius: 16px; box-shadow: 0 2px 16px rgba(0,0,0,0.08); padding: 32px 28px; max-width: 380px; width: 100%; text-align: center; }
  .logo { font-size: 22px; font-weight: 700; color: #1e3a5f; margin-bottom: 4px; }
  .tagline { font-size: 13px; color: #6b7280; margin-bottom: 24px; }
  h1 { font-size: 18px; margin: 0 0 12px; color: #111827; }
  p { font-size: 14px; color: #374151; line-height: 1.5; }
  .icon { font-size: 40px; margin-bottom: 8px; }
  input { width: 100%; box-sizing: border-box; padding: 12px 14px; margin-top: 12px; border: 1px solid #d1d5db; border-radius: 10px; font-size: 15px; }
  button { width: 100%; margin-top: 16px; padding: 12px 14px; background: #1e3a5f; color: #fff; border: none; border-radius: 10px; font-size: 15px; font-weight: 600; cursor: pointer; }
  button:disabled { opacity: 0.6; }
  .error { color: #b91c1c; font-size: 13px; margin-top: 10px; min-height: 16px; }
  .eye { position: relative; }
  .eye button.toggle { position: absolute; right: 8px; top: 20px; width: auto; margin: 0; padding: 6px 10px; background: transparent; color: #6b7280; font-size: 13px; font-weight: 500; }
</style>
</head>
<body>
  <div class="card">
    <div class="logo">🏪 JIMI B2B</div>
    <div class="tagline">Vente en gros</div>
    ${body}
  </div>
  ${script ? `<script nonce="${script.nonce}">${script.code}</script>` : ''}
</body>
</html>`;
}

export function verifySuccessPage(): string {
  return page(
    'Email vérifié',
    `<div class="icon">✅</div><h1>Email vérifié !</h1><p>Votre compte est maintenant actif. Retournez dans l'application JIMI B2B pour vous connecter.</p>`,
  );
}

export function verifyErrorPage(message: string): string {
  return page(
    'Lien invalide',
    `<div class="icon">⚠️</div><h1>Lien invalide ou expiré</h1><p>${message}</p><p>Retournez dans l'application pour demander un nouveau lien.</p>`,
  );
}

export function resetPasswordFormPage(token: string, nonce: string): string {
  const body = `<h1>Choisissez un nouveau mot de passe</h1>
    <form id="f">
      <div class="eye">
        <input type="password" id="pw1" placeholder="Nouveau mot de passe" minlength="6" required />
        <button type="button" class="toggle" id="toggle1">👁</button>
      </div>
      <div class="eye">
        <input type="password" id="pw2" placeholder="Confirmer le mot de passe" minlength="6" required />
        <button type="button" class="toggle" id="toggle2">👁</button>
      </div>
      <div class="error" id="err"></div>
      <button type="submit" id="submitBtn">Réinitialiser le mot de passe</button>
    </form>`;

  const code = `
    function toggle(inputId) {
      const i = document.getElementById(inputId);
      i.type = i.type === 'password' ? 'text' : 'password';
    }
    document.getElementById('toggle1').addEventListener('click', () => toggle('pw1'));
    document.getElementById('toggle2').addEventListener('click', () => toggle('pw2'));
    document.getElementById('f').addEventListener('submit', async (e) => {
      e.preventDefault();
      const pw1 = document.getElementById('pw1').value;
      const pw2 = document.getElementById('pw2').value;
      const err = document.getElementById('err');
      const btn = document.getElementById('submitBtn');
      err.textContent = '';
      if (pw1 !== pw2) { err.textContent = 'Les mots de passe ne correspondent pas.'; return; }
      if (pw1.length < 6) { err.textContent = 'Le mot de passe doit contenir au moins 6 caractères.'; return; }
      btn.disabled = true;
      btn.textContent = 'Envoi...';
      try {
        const res = await fetch(window.location.pathname, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token: ${JSON.stringify(token)}, newPassword: pw1 }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.message || 'Erreur, réessayez.');
        }
        document.querySelector('.card').innerHTML = '<div class="icon">✅</div><h1>Mot de passe réinitialisé !</h1><p>Retournez dans l\\'application JIMI B2B pour vous connecter.</p>';
      } catch (ex) {
        err.textContent = Array.isArray(ex.message) ? ex.message.join(' ') : ex.message;
        btn.disabled = false;
        btn.textContent = 'Réinitialiser le mot de passe';
      }
    });`;

  return page('Nouveau mot de passe', body, { nonce, code });
}
