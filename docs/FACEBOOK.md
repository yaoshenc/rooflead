# Facebook Lead Ads & Messenger leads

RoofLead receives two kinds of Facebook enquiries through one webhook:

- **Lead Ads** (Instant Forms): each submission becomes a lead with the customer's name, email, phone, address and form answers.
- **Messenger**: each new conversation with your Page becomes a lead, and the customer gets an **automatic reply** (once per conversation, at most every 12 hours). Addresses written in the message are detected. You can reply from the lead page while Messenger's 24-hour reply window is open.

Leads are held in D1 (`inbound_leads`) until a signed-in browser imports them (on load, when the tab becomes visible, and every minute). Auto-replies are sent by the server, so they work while nobody has RoofLead open. The reply template lives in D1 (`workspace_settings`) and is edited in **Settings → Facebook & Messenger leads**.

## Setup (once)

You need admin access to the Facebook Page and a Meta developer account.

1. Go to https://developers.facebook.com/apps, click **Create app**, choose the **Business** type (or the use cases *Engage with customers on Messenger* and *Capture & manage ad leads*), and link your business portfolio.
2. **App secret:** App settings → Basic → *App secret* → **Show**. This becomes `FB_APP_SECRET`.
3. **Page access token:** add the **Messenger** product. Under *Access tokens*, connect your Page and **Generate token**. This becomes `FB_PAGE_ACCESS_TOKEN`. Tokens generated there for a Page don't expire unless the password or permissions change. The token needs `pages_messaging`, `pages_manage_metadata`, `pages_show_list`, `leads_retrieval` and `pages_read_engagement`.
4. **Verify token:** make up a long random string. This becomes `FB_VERIFY_TOKEN`.
5. Add the three values as **Secrets** in Cloudflare: Workers & Pages → rooflead → Settings → Variables and Secrets → Add → *Type: Secret*.
6. **Webhook:** in the Meta app, open Webhooks (or Messenger → Webhooks), choose object **Page**, set the callback URL to `https://rooflead.cindyshi688.workers.dev/api/facebook/webhook` and the verify token from step 4. Then click **Verify and save**.
7. Subscribe the Page to the **messages** and **leadgen** fields. (In Messenger settings, *Add subscriptions* for your Page.)
8. Lead Ads only: in Meta Business Suite → *Leads access* (Business settings → Integrations → Leads access), make sure the app is allowed to access leads for the Page.
9. Test: message the Page from a personal account and confirm the auto-reply arrives. For Lead Ads, use https://developers.facebook.com/tools/lead-ads-testing.

**App mode:** while the app is in *Development* mode, only people with a role on the app (admins, developers, testers) receive auto-replies and generate webhook events. To receive them from the public, switch the app to **Live**. Meta may require App Review for `pages_messaging` and `leads_retrieval` before that works for everyone.

## Behaviour and limits

- The webhook rejects any request without a valid `X-Hub-Signature-256` signature made with `FB_APP_SECRET`. It is the only route that skips the workspace password, and it never acts with the signed-in identity.
- Duplicate deliveries from Meta are ignored by message ID, so a customer never gets two auto-replies for one message.
- Messenger allows replies only within 24 hours of the customer's last message. After that, use phone or email.
- Lead Ads contacts can't be messaged on Messenger by the API. RoofLead's customer follow-up prepares an email/SMS request instead.
- New leads with an address start AI research automatically when *Research each new lead* is on.
- Graph API version defaults to `v23.0`. Set the `FB_GRAPH_VERSION` variable to change it.
