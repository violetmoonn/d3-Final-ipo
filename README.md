# d3-composure.com

The D3COMPOSURE storefront. Plain HTML, no build step, no dependencies.

```
index.html      the whole site
photos/         product images
```

Deployed on Vercel. Any push to `main` redeploys automatically.

## Editing

Search `index.html` for these tags:

| Tag         | Controls                        |
|-------------|---------------------------------|
| `[STRIPE]`  | payment link                    |
| `[CATALOG]` | products, prices, sizes, photos |
| `[GALLERY]` | gallery photos                  |
| `[LEGAL]`   | policy pages                    |
| `[EMAIL]`   | contact address                 |
| `[SOCIAL]`  | Instagram, LinkedIn             |

## Adding a new piece

Every piece shares the same price ($350), sizes, description and Stripe link.
Only the photos change.

1. Drop the photos in photos/ (e.g. d3-02-front.jpg, d3-02-back.jpg).
2. In index.html, find the [CATALOG] slots and fill in that piece's line:

   piece("D3 02", ["photos/d3-02-front.jpg", "photos/d3-02-back.jpg"]),

A slot with no photos stays hidden, so empty slots never show on the site.
Slots D3 02 to D3 06 are ready; copy a line to add more.

Adding a gallery photo

Drop the file in `photos/`, then add a line under `[GALLERY]`:

```js
{src: "photos/look-03.jpg", caption: "Lookbook 03"},
```
