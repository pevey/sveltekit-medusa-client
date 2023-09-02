# sveltekit-medusa-client

A client library for communicating with a Medusa ecommerce backend in SvelteKit

[Documentation](https://pevey.com/sveltekit-medusa-client)

If you are not familiar with Medusa, you can learn more on [the project web site](https://www.medusajs.com/).

> Medusa is a set of commerce modules and tools that allow you to build rich, reliable, and performant commerce applications without reinventing core commerce logic. The modules can be customized and used to build advanced ecommerce stores, marketplaces, or any product that needs foundational commerce primitives. All modules are open-source and freely available on npm.

This client is designed to be used on the server.  It cannot be exported to the browser.  This means you must make your calls to your Medusa backend from your storefront server, not from the client browser.  Calls to the library can be made from:

* A handler in `hooks.server.js/ts`
* A page load function in `+page.server.js/ts`
* A form action in `+page.server.js/ts`, or
* An API endpoint, aka `+server.js/ts`

One of the benefits of newer frameworks like SvelteKit is that they combine the fluid user experience of client-side reactivity with the ability to handle logic on the server when you choose to.  Keeping your Medusa backend firewalled and accessible only to your storefront application server provides an additional layer of security versus having your backend directly exposed.  This type of deployment also allows us to use tools like Turnstile or reCAPTCHA to provide some protection against bots and brute force attacks.  Without firewalling your backend, it would not be of much use to implement turnstile protection on your frontend.  It could easily be bypassed.

## Example Project

You can view an example project using this client library [here](https://github.com/pevey/sveltekit-medusa-starter).

## Installation

Create a new SvelteKit app if needed.  Then, install this package.

```bash

yarn add sveltekit-medusa-client

```

You should set the location of your Medusa server as an environment variable.  For example:

`.env`

```bash
MEDUSA_BACKEND_URL="http://localhost:9000"
```

## Basic Usage

To create a new client, invoke the MedusaClient constructor, passsing the location of your Medusa server as an argument.  For example:

`+page.server.js`

```js
import { MedusaClient } from 'sveltekit-medusa-client'
import { MEDUSA_BACKEND_URL } from '$env/static/private'

export const load = async function () {
   const medusa = new MedusaClient(MEDUSA_BACKEND_URL)
   return {
      products: medusa.getProducts()
   }
}
```

Then, on the corresponding `+page.svelte`, you can use the products data you exported:
(For more information on the data returned, refer to the [Medusa API Documentation](https://docs.medusajs.com/api/store#tag/Products/operation/GetProducts))

```svelte
<script>
   export let data
   const products = data.products  
</script>

<ul>
{#each products as product}
   <li>
      Product id: {product.id}<br>
      Product handle: {product.handle}<br>
      {product.title}
   </li>
{:else}
   <p>No products returned</p>
{/each}
<ul>
```

## Using the Client as a Singleton

One major drawback of the example above is that a new Medusa client is created for each page load.  
You can prevent that by adding a small library in your project that creates a single shared client that can be imported where needed.
For example:

`lib/server/medusa.js`

```js
import { MedusaClient } from 'sveltekit-medusa-client'
import { MEDUSA_BACKEND_URL } from '$env/static/private'
export default new MedusaClient(MEDUSA_BACKEND_URL)
```

Now, on our `+page.server.js` load function, we can do this:

```js
import medusa from '$lib/server/medusa'

export const load = async function () {
   return {
      products: medusa.getProducts()
   }
}
```

## Client Options

A number of options give some flexibility to the client.  The options object that can be injected in the client contructor takes this shape:

```ts
export interface ClientOptions {
   retry?: number
   timeout?: number
   headers?: {}
   persistentCart?: boolean
   logger?: Logger
   logFormat?: 'text' | 'json' | 'majel'
   logLevel?: 'verbose' | 'limited' | 'silent'
   excludedPaths?: string[]
   limitedPaths?: string[]
}
```

For example, you can create a new client instance like this:

```js
import { MedusaClient } from 'sveltekit-medusa-client'
import { MEDUSA_BACKEND_URL, CLOUDFLARE_ACCESS_ID, CLOUDFLARE_ACCESS_SECRET } from '$env/static/private'
export default new MedusaClient(MEDUSA_BACKEND_URL, { 
   timeout: 3000, // 3 seconds
   retry: 0,
   headers: {
      'CF-Access-Client-Id': CLOUDFLARE_ACCESS_ID,
      'CF-Access-Client-Secret': CLOUDFLARE_ACCESS_SECRET,
   },
   persistentCart: true,
   logger: console,
   logFormat: 'json',
   logLevel: 'verbose',
   excludedPaths: ['/store/mycustomsensitiveroute'],
   limitedPaths: ['/store/bulkyresponseroute']
})
```

- `timeout` - The default is 8000, or 8 seconds.  The length of time to wait for a response before aborting 
- `retry` - The default is 3.  The number of times to retry a timed out request
- `headers` - The default is undefined.  An object of HTTP headers, as many as you want, which will be added to all requests sent to the backend.  This can be useful in many situations.  If you would like to access a server behind a proxy with bearer auth, you can pass the auth header in this property.  You can also pass Cloudflare Access service auth credentials, as in the example above.
- `persistentCart` - The default is false.  If true, the client will expect an endpoint at `/store/customers/me/cart` that will return the customer's cart.  For now, this endpoint is not included in the Medusa core and must be added.
- `logger` - The default is `console`.  You can inject your own logger instance if you already have one configured in the application.  For example, a winston logger instance.  Any logger that implements the `info()` and `error()` methods should work.
- `logFormat` - The default is json.  You can change to 'text' if you need to for some reason.
- `excludedPaths` - The default is ['/store/auth'].  An array of strings that should be checked to exclude paths from logging.  The default can be added to, but not overridden.  Requests to URIs on your medusa backend that contain one or more of these strings will not be logged.  
- `limitedPaths` - The default is undefined.  An array of strings that should be checked to reduce the level of detail when logging.  Requests to URIs on your medusa backend that contain one or more of these strings will not log request or response content, only metadata.  The url of the request will be logged, but not query params.

## Authentication

Some methods in the library, like the `getProducts` method in the example above, need no authentication.  Other methods need more context, such as whether the requester is a logged in user, or whether they have an existing shopping cart.  The first argument passed to those methods is the special SvelteKit `locals` object.  Locals on the server work much like a page or session store in the browser.  They are a place to hold on to data related to this particular request that we may need somewhere else in the application before this request/response cycle is complete.

Use the middleware method `handleRequest` from this library to handle customer authentication on every request with very little effort.  If the user is logged in, the user object will be available at `locals.user.` Middleware is added in SvelteKit via the hooks.server.js/ts file:

`hooks.server.js`

```js
import medusa from '$lib/server/medusa'

export const handle = async ({ event, resolve }) => {
   event = await medusa.handleRequest(event)
   return await resolve(event)
}
```

Now, we can invoke methods that require information about the user and the cart.

`+page.server.js`

```js
import medusa from '$lib/server/medusa'

export const load = async function ({ locals, cookies }) {
   return {
      cart: medusa.getCart(locals, cookies)
   }
}
```

## Caching

Caching is enabled by passing a key string in the options for the functions that support caching. The key is the unique identifier for that particular query response.  Optionally, you can also pass a ttl. The ttl is the max age of the cache in milliseconds.  The default ttl is 1000.  

### Caching Example

To enable caching on a call to the getProduct function (`medusa.getProduct(handle)`), call the function like this:

```js
let product = await medusa.getProduct(handle, { key: `__${handle}__product`, ttl: 10000 })
```

Behind the scenes, the response will be cached in memory for the duration of the ttl.

### Important Notes

- Short cache times are recommended.  Even a short ttl can lead to a significant performance boost in your storefront application and reduction of load on your Medusa backend on high traffic sites.

- The cache is stored in memory.  This is ideal in some scenarios, but not in memory-constrained environments or for especially large sites.

- When deploying to a serverless platform, you will probably want to use something like Redis in your storefront application for caching and forgo the built-in cache option.

### The Cache is a Shared, Server-Side Cache

- Never attempt to cache cart or customer-specific information. Only functions that return data that can be safely shared across customers support cache options.

- The list of functions that support caching:

```js
getSearchResults(q:string, cacheOptions?:CacheOptions)
getProducts(options?:ProductRetrievalOptions, cacheOptions?:CacheOptions)
getCollections(options?:CollectionRetrievalOptions, cacheOptions?:CacheOptions)
getCollection(handle:string, cacheOptions?:CacheOptions)
getCollectionProducts(id:string, options?:ProductRetrievalOptions, cacheOptions?:CacheOptions)
getProduct(handle:string, cacheOptions?:CacheOptions)
getReviews(productId:string, options?:ReviewRetrievalOptions, cacheOptions?:CacheOptions)
```

### Make Sure Your Key is Unique

Keys all share one namespace.  If you enable caching on multiple function calls, take care to ensure your keys will always be unique.

### Cache Bypass

To bypass the cache and request fresh data, you can simply call the function again without a key.

## Cache Bust

To cause the query to pull fresh data, cache the new data, and update the ttl, include `revalidate: true` in the cache options.  Example:

```js
let product = await medusa.getProduct(handle, { 
   key: `__${handle}__product`, 
   ttl: 10000,
   revalidate: true
})
```



