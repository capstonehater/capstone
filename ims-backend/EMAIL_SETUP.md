# Brevo account emails

Add these settings to the backend's ignored `.env` file:

```dotenv
SMTP_HOST=smtp-relay.brevo.com
SMTP_PORT=587
SMTP_USER=your-login-from-brevo
SMTP_PASSWORD=your-brevo-smtp-key
SMTP_FROM_EMAIL=your-verified-sender@example.com
SMTP_FROM_NAME=Cafe Salvacion
```

Use the SMTP login and SMTP key from Brevo Settings > SMTP & API, and the
verified sender address from Settings > Senders, Domains & IPs > Senders.
The SMTP login is not the sender address. Transactional sending must be
activated in Brevo. Keep credentials out of source control.

Set the existing `FRONTEND_APP_URL` to the frontend URL recipients can access.
A localhost URL only works when opened on the computer running the frontend.
Restart the backend after changing environment settings.

Creating a user or clicking Send Setup sends a single-use password setup link.
Existing account password resets use the same SMTP connection. The expiration
is controlled by `PASSWORD_RESET_TTL_MINUTES` (30 minutes by default).
SMTP acceptance does not guarantee inbox delivery; check Brevo transactional
logs for delivery, bounces, or queued messages.

If sending fails after creating an account, the pending account remains saved.
After correcting email configuration, use Send Setup on that existing account.

Automated tests do not send email. Development without any SMTP configuration
retains the terminal-link behavior. Partial SMTP configuration and missing
production configuration return errors instead of claiming an email was sent.
