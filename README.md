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

npm i -D sveltekit-medusa-client

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
