# Peter's Corner PWA — version 0.1

Working local-first prototype for a Milma shop: product/barcode registration, stock receiving by expiry batch, English/Malayalam browser speech recognition, phone camera scanning, external keyboard-emulating barcode scanner input, cart billing, automatic earliest-expiry-first stock deduction, expiry alerts, local JSON backup.

## Run

Requires Node.js 18+.

```bash
npm install
npm run dev
```

Open the local URL shown by Vite. For camera and microphone access on a phone, deploy to an HTTPS host (or use localhost). `npm run build` generates deployable `dist/` files. The PWA can be installed via the browser's Add to Home Screen/Install app menu after HTTPS deployment.

## Important limitations

- Data lives in **this browser/device only** using localStorage; it is NOT synced between devices and can be lost if browser data is cleared. Export JSON backups regularly. No backup restore is implemented yet.
- Voice recognition depends on browser support and may use a network service. Malayalam/English language is selected before speaking; mixing languages and natural language date extraction may require manual correction.
- Prices entered are *selling prices*; billing uses the latest product selling price. No GST, discounts, receipt printing, authentication, server database, or multi-device synchronization yet.
- Scan a product's barcode when receiving the first batch to register it; a barcode must uniquely identify a product.
- The app blocks checkout when there is insufficient **unexpired** stock and deducts oldest unexpired batches first.
- Local inventory corrections do not maintain an audit log. Do not treat this as production-grade accounting software without additional testing and persistent backend.

### Voice billing fallback
In Billing, choose English or Malayalam and press **Speak for bill** when a barcode cannot be scanned. Say a product name already saved in inventory and its quantity. Review the transcript and cart. When multiple products match, choose the intended item. Complete sale to deduct stock from eligible batches. Speech recognition depends on browser support, permissions and recognition service availability; Malayalam product matching works best when inventory names use the same language as spoken input.
