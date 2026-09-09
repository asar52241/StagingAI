# Data handling — StagingAI

Updated 2026-09-10.

- No user account, name, email or phone is requested by the application. Robokassa may collect payment details on its own pages.
- Photos are re-encoded in the browser, which removes source metadata. Source photos, masks and results are held in IndexedDB for checkout recovery. Records expire after 24 hours, extended when a result is saved, and are removed on the next database access. Closing the site alone does not immediately erase IndexedDB; users can clear site data themselves.
- Application servers handle images in memory and forward them to OpenAI; they do not persist image bodies to Redis or disk. Provider retention policies are separate from application storage.
- Redis retains invoice ID, amount, count, owner nonce, confirmation/expiry and SHA-256 fingerprints/attempt state for up to seven days. No source image, mask, result, filename, bank account or full Robokassa XML is stored there.
- HttpOnly cookies bind checkout and paid processing to the browser. Paid access expires 24 hours after first confirmation. The browser cannot extend this deadline by editing a cookie.
- Yandex Metrika records page views, goals and purchase events. Campaign attribution parameters are retained; payment signatures and other non-allowlisted query values are removed from explicitly tracked page/referrer URLs. Webvisor is disabled. Analytics remains a third-party script running on the page.
- Application image logs contain request IDs, duration/status, modes, dimensions, file sizes and provider token counts. They exclude source IP, image content, filenames, full payment XML and raw provider errors. The hosting provider may independently maintain access logs; configure their retention and query redaction separately.
- API responses include `Cache-Control: no-store`; pages set `Referrer-Policy: no-referrer` so outbound requests do not disclose the payment return URL.

No claim is made that these code changes alone establish legal compliance for the hosting environment or external providers.
