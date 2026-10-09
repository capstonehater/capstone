# Cafe Salvacion: recovery and outside access

## VS Code dev tunnel (port 3000)

Forward port 3000 and open its HTTPS tunnel URL. The frontend now proxies
`/backend/*` to the local API, so port 4000 does not need a separate tunnel.
Use these frontend settings:

```dotenv
NEXT_PUBLIC_API_BASE_URL=/backend
API_UPSTREAM_URL=http://127.0.0.1:4000
API_BROWSER_ORIGIN=https://YOUR-3000-TUNNEL.asse.devtunnels.ms
```

Set backend `FRONTEND_ORIGIN` and `FRONTEND_APP_URL` to the exact HTTPS
port-3000 tunnel origin (without a trailing slash). Keep
`AUTH_COOKIE_SAME_SITE=lax` and leave `COOKIE_DOMAIN` unset. Restart the
backend after changing its environment. Rebuild and restart the frontend
after changing its public API URL. When the tunnel hostname changes, update
the backend origin settings and restart it again.
Also update frontend `API_BROWSER_ORIGIN` to that same origin and rebuild
and restart the frontend. This enables the narrowly scoped repair for Dev
Tunnels rewriting the browser's Origin header to localhost.

Browser requests should target `https://YOUR-3000-TUNNEL/backend/auth/login`.
If they still target `localhost:4000`, an old frontend build is running;
rebuild, restart, and refresh the page.

## Working local settings

The app has two services. Port 3000 serves the website; port 4000 serves the API.

`ims-frontend/.env.local`:
```dotenv
NEXT_PUBLIC_API_BASE_URL=http://localhost:4000
```

`ims-backend/.env` (leave database URLs and secrets unchanged):
```dotenv
PORT=4000
FRONTEND_ORIGIN=http://localhost:3000
FRONTEND_APP_URL=http://localhost:3000
AUTH_COOKIE_SECURE=false
```

Open http://localhost:3000/login on this PC. Start Project.cmd and Stop Project.cmd now support the installed Node.js and PostgreSQL service. PostgreSQL must be running. The frontend listens on all network interfaces, so the router can reach it.

After any NEXT_PUBLIC_API_BASE_URL change, stop the app, run `npm.cmd run build` in ims-frontend, then start the app. Next.js embeds this value during the build: https://nextjs.org/docs/app/guides/environment-variables

## First check whether outside forwarding is possible

1. Open http://192.168.18.1 and sign in to your router.
2. Find its Internet/WAN IPv4 address. This is different from this PC's current LAN address, 192.168.18.94.
3. Compare the WAN address with your public IPv4 shown by an IP lookup website. A WAN address starting with 10., 192.168., 172.16 through 172.31, or in 100.64.0.0 through 100.127.255.255 is not directly public. A mismatch needs investigation for upstream NAT.
4. If Dasca controls the upstream NAT, ask: "Can you provide a public IPv4 address that supports inbound port forwarding? Is my connection behind CGNAT, and are inbound ports blocked?" A static public IP is convenient but a dynamic public IP can also work with DDNS.
5. If you have two routers, forwarding may be required on both, or your upstream router can be put in bridge mode by whoever manages it.

Public WAN access is required for ordinary IPv4 port forwarding. Router menu names vary by model: https://www.tp-link.com/us/support/faq/1379/

## Recommended outside access: HTTPS

This inventory system carries login credentials and business data. Use HTTPS for actual login over the Internet.

1. In the router's DHCP/address reservation screen, reserve 192.168.18.94 for this PC's Wi-Fi adapter. Confirm the PC still has that address using `ipconfig`.
2. Obtain a domain or DDNS hostname you control and point its IPv4 DNS record at your public WAN address. Keep it updated if the WAN IP changes. Do not publish an IPv6 record unless IPv6 routing and firewall access are also configured.
3. Download Caddy for Windows from https://caddyserver.com/download. Save caddy.exe and a file named `Caddyfile` together in a folder on this PC. Replace `ims.example.com` below with your real hostname:

```caddyfile
ims.example.com {
    handle_path /backend/* {
        reverse_proxy 127.0.0.1:4000
    }
    handle {
        reverse_proxy 127.0.0.1:3000
    }
}
```

The /backend prefix is stripped before forwarding to the API. The frontend's own /api/geolocation route continues to go to the frontend. Reference: https://caddyserver.com/docs/caddyfile/patterns

4. Set these values, replacing the hostname with the same real hostname:

`ims-frontend/.env.local`:
```dotenv
NEXT_PUBLIC_API_BASE_URL=https://ims.example.com/backend
```

`ims-backend/.env`:
```dotenv
PORT=4000
FRONTEND_ORIGIN=https://ims.example.com
FRONTEND_APP_URL=https://ims.example.com
AUTH_COOKIE_SECURE=true
AUTH_COOKIE_SAME_SITE=lax
TRUST_PROXY=loopback
```

FRONTEND_ORIGIN must exactly match the browser's origin, without a path or trailing slash. Leave COOKIE_DOMAIN unset unless you have a specific need for it. Keep database settings and secrets unchanged.

5. Run Stop Project.cmd. In ims-frontend run `npm.cmd run build`, then run Start Project.cmd.
6. In Windows Defender Firewall > Advanced Settings > Inbound Rules, create a TCP rule for local ports 80 and 443, restricted to the caddy.exe program and the active network profile. Leave the firewall enabled.
7. In the router's NAT/Port Forwarding/Virtual Server menu, enable these rules:

| Protocol | External port | Internal IP | Internal port |
| --- | --- | --- | --- |
| TCP | 80 | 192.168.18.94 | 80 |
| TCP | 443 | 192.168.18.94 | 443 |

Remove obsolete app forwarding rules once this setup works. Do not forward database port 5432, or directly expose 3000/4000 for this HTTPS setup.

8. From the folder containing Caddy, run `caddy.exe validate --config Caddyfile`, then `caddy.exe run --config Caddyfile`. Keep Caddy running along with the app. Caddy obtains and renews HTTPS certificates when DNS and inbound reachability are correct: https://caddyserver.com/docs/quick-starts/https
9. Turn Wi-Fi off on your phone and open `https://YOUR-HOSTNAME/login` using mobile data. Use this HTTPS hostname for login on the PC too; localhost no longer matches the configured allowed origin. Inside Wi-Fi, your router may need NAT loopback or local DNS to resolve the same hostname to this PC.

## If you specifically want to test ports 3000 and 4000 directly

This is an HTTP connectivity test, not the recommended Internet login setup.

1. Reserve the PC address and verify a public WAN IP as above.
2. Allow inbound TCP 3000 and 4000 for the app's node.exe in Windows Firewall on the active profile.
3. Forward TCP external 3000 to 192.168.18.94:3000, and TCP external 4000 to 192.168.18.94:4000.
4. Change NEXT_PUBLIC_API_BASE_URL to `http://YOUR-PUBLIC-IP:4000`. Set backend FRONTEND_ORIGIN and FRONTEND_APP_URL to `http://YOUR-PUBLIC-IP:3000`. Keep backend PORT=4000. Rebuild the frontend and restart both services.
5. From mobile data open `http://YOUR-PUBLIC-IP:3000/login`. Visiting `http://YOUR-PUBLIC-IP:4000/auth/me` should return an authentication-required 401 JSON response, which confirms API connectivity.
6. Do not submit real credentials over this unencrypted connection. Switch to the HTTPS setup for use, or remove these forwarding rules and restore local settings.

## Troubleshooting

- Website opens but login fails: check API URL, exact FRONTEND_ORIGIN, rebuild, and restart. A remote browser's localhost refers to the remote device, not this PC.
- 403 Cross-site request blocked: the browser origin differs from FRONTEND_ORIGIN.
- HTTP works but HTTPS does not: HTTPS requires a TLS server such as Caddy; changing http to https in .env alone does not enable it.
- Local access works but mobile data times out: check WAN/CGNAT, router destination IP, Windows Firewall, service listeners, and ISP inbound restrictions.
- Mobile data works but the public hostname fails inside Wi-Fi: check router NAT loopback or local DNS.
- Logs: .local/backend.log, .local/backend-error.log, .local/frontend.log, .local/frontend-error.log.

Router settings, public WAN status, external connectivity, and the future HTTPS configuration have not been verified or changed during the local repair.
