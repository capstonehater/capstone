import { PASSWORD_RESET_TTL_MS } from './auth.constants';

function escapeHtml(value: string): string {
  return value.replace(
    /[&<>"']/g,
    (character) =>
      ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
      })[character]!,
  );
}

export function buildAccountEmail(resetUrl: string, isSetup = false) {
  const action = isSetup ? 'Set up your account' : 'Reset your password';
  const welcome = isSetup
    ? 'Welcome to Cafe Salvacion Team!'
    : 'Cafe Salvacion';
  const security = `This link expires in ${PASSWORD_RESET_TTL_MS / 60000} minutes and can only be opened once. Complete your password change in the first tab you open.`;
  const introduction =
    'Open the link below to choose your Cafe Salvacion password.';
  const disclaimer = 'If you did not expect this email, you can ignore it.';
  return {
    subject: `Cafe Salvacion - ${action}`,
    text: `${welcome}\n\n${action}\n\n${introduction}\n\n${resetUrl}\n\n${security}\n\n${disclaimer}`,
    html: `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${action}</title></head>
<body style="margin:0;padding:0;background:#ffffff;color:#000000;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;background:#ffffff;"><tr><td style="padding:8px 18px 24px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;border-collapse:collapse;"><tr><td style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:22px;">
<h1 style="margin:0 0 24px;font-family:Arial,Helvetica,sans-serif;font-size:26px;line-height:32px;font-weight:700;">${welcome}</h1>
<h2 style="margin:0 0 10px;font-family:Georgia,'Times New Roman',serif;font-size:34px;line-height:40px;font-weight:400;">${action}</h2>
<p style="margin:0;">${introduction}</p>
<p style="margin:48px 0;"><a href="${escapeHtml(resetUrl)}" style="color:#232d46;text-decoration:underline;">${action}</a></p>
<p style="margin:0 0 16px;">${security}</p>
<p style="margin:0;">${disclaimer}</p>
</td></tr></table></td></tr></table></body></html>`,
  };
}
