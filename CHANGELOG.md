# Change Log

## 3.1.0

### Patch Changes

- Caching API change:  Caching is no longer set at the client/class level.  Caching is now enabled by passing a key string in the options for particular functions that support caching. The key is the unique identifier for that particular query response.  Optionally, you can also pass a ttl. The ttl is the max age of the cache in milliseconds.  The default ttl is 1000.  See the latest README for more information.

The list of functions that support caching:

```js
getSearchResults(q:string, cacheOptions?:CacheOptions)
getProducts(options?:ProductRetrievalOptions, cacheOptions?:CacheOptions)
getCollections(options?:CollectionRetrievalOptions, cacheOptions?:CacheOptions)
getCollection(handle:string, cacheOptions?:CacheOptions)
getCollectionProducts(id:string, options?:ProductRetrievalOptions, cacheOptions?:CacheOptions)
getProduct(handle:string, cacheOptions?:CacheOptions)
getReviews(productId:string, options?:ReviewRetrievalOptions, cacheOptions?:CacheOptions)
```

Example: To enable caching for the getProduct function (`medusa.getProduct(handle)`), call the function like this:

```js
let product = await medusa.getProduct(handle, { key: `${params.slug}_product`, ttl: 10000 })
```

## 3.0.0

### Patch Changes

- Fix: No more ts warning about type mismatch when not using custom headers (by @ellicodan)
- Chore: Update sveltekit-superfetch dependency to ^3.0
- Feat: Enabled caching of product, collection, and search requests by default.  To disable, in options object set 'disableCache' to true.

## 2.0.2

### Patch Changes

- Fix: Bug in 2.0 that caused the login function to return 'true' even though the auth failed and the user was not logged in (session cookie not set).  This bug did not affect access but could cause UX issues in the login flow.

## 2.0.0

### Patch Changes

- Chore: Bumped sveltekit-superfetch dependency to ^2.0.  This changed the syntax slightly for sending queries, which you should only notice if you were using the public query() method directly.
- Feat: Enabled optional logging.  You can inject a winston logger or other logger instance into the MedusaClient constructor.  If 'debug' is set to true but no logger instance is passed, console will be used by default.  See updated docs.

## 1.13.2

### Patch Changes

- Fix: Update User interface to make phone property optional

## 1.13.0

### Patch Changes

- Feat: Added typing for product-related functions.  Will add typing for Users, Carts, and other return values as Medusa team moves them over to @medusajs/types package.
- Fix: Bug where getCart function could return a cart that had been completed on a different device if persistentCart was set to true in certain situations.
- Chore: Versioning changed.  Version numbers will now follow semantic versioning and no longer mirror medusa backend versioning.

## 1.12.1-c

### Patch Changes

- Chore: Compatibility with latest medusa-plugin-ratings v1.3

## 1.12.1-b

### Patch Changes

- Chore: Bump versions on all dependencies to latest

## 1.12.1

### Patch Changes

- Fix: Update method of parsing set-cookie headers to account for other headers being set other than the Medusa connect.sid session header

## 1.12.0-b

### Patch Changes

- Fix: getCustomer function: Move fetch request to get customer session back inside try block to enable smoother error handling.  It was left outside of the block by accident after debugging.
- Fix: Bug with new persistent cart feature that caused an error when user logged in and did not already have any cart sessions
- Fix: Bug in the first login after registering a user that caused register to return false even though it was successful

## 1.12.0

### Patch Changes

- Feat: Session cookie expiration now matches any custom ttl set in medusa.config.js
- Feat: Session cookie now supports rolling:true (refresh) session option in medusa.config.js
- Feat: Options object passed to constructor now supports custom timeout (in milliseconds) and retry settings.
- Feat: Options object passed to contructor can now include persistentCart (bool) which if true will attempt to load customer's existing cart across multiple browsers or devices.  This requires a custom API route to work (/store/customer/me/cart) and defaults to false.  The API route should take the general form of:
```
   router.use("/store/customers/me/cart", authenticateCustomer())
   router.get("/store/customers/me/cart", cors(storeCorsOptions), async (req, res) => {
      if (req.user && req.user.customer_id) {
         const cartService = req.scope.resolve("cartService")
         const cart = await cartService.retrieveByCustomerId(req.user.customer_id)
         return res.json({ cart })
      } else {
         return res.status(404).json({ cart: null })
      }
   })
```

## 1.11.0-b

### Patch Changes

- Feat: Added retrieval options for products and collections (limit, offset, etc.).  These match the API options available for each entity.
- Chore: getAllProducts() renamed to getProducts()

## 1.11.0

### Patch Changes

- Fix: getProduct() will return null and not throw an error if product not found
- Feat: add ability to pass a second 'options' argument to the contructor.  If present, this argument must be an object.  For now, the only handled property of options is 'headers', which can be an object of custom headers to be sent with each fetch request to the Medusa server.  These headers will be in addition to, and will not replace, the session cookie and content type headers the client already sends.  For example, if your Medusa server sits behind a cloudflared tunnel with access key security, you can now pass an additional header with the access key through the client.