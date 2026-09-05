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

## Adding a photo

Drop the file in `photos/`, then add a line under `[GALLERY]`:

```js
{src: "photos/look-03.jpg", caption: "Lookbook 03"},
```
