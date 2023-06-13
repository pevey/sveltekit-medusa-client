# Change Log

## 1.12.0

### Patch Changes

- Session cookie now expiration now matches any custom ttl set in medusa.config.js
- Session cookie now support rolling:true (refresh) session option in medusa.config.js

## 1.11.0-b

### Patch Changes

- feat: Added retrieval options for products and collections (limit, offset, etc.).  These match the API options available for each entity.
- getAllProducts() renamed to getProducts()

## 1.11.0

### Patch Changes

- fix: getProduct() will return null and not throw an error if product not found
- feat: add ability to pass a second 'options' argument to the contructor.  If present, this argument must be an object.  For now, the only handled property of options is 'headers', which can be an object of custom headers to be sent with each fetch request to the Medusa server.  These headers will be in addition to, and will not replace, the session cookie and content type headers the client already sends.  For example, if your Medusa server sits behind a cloudflared tunnel with access key security, you can now pass an additional header with the access key through the client.