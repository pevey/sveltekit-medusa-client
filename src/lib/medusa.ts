import superFetch from 'sveltekit-superfetch'
import cookie from 'cookie'
import type { Cookies, RequestEvent } from '@sveltejs/kit'

export interface ProductRetrievalOptions {
   limit?: number,
   offset?: number,
   order?: string,
   expand?: string,
   fields?: string,
   query?: string
}

export interface CollectionRetrievalOptions {
   limit?: number,
   offset?: number,
}

export interface ReviewRetrievalOptions {

}

export interface Review {
   id?: string,
   product_id: string,
   customer_id?: string,
   display_name: string,
   content: string,
   rating: number,
   approved?: boolean
}

export interface User {
   // used in register()
   // should match this request schema:
   // https://docs.medusajs.com/api/store#tag/Customers/operation/PostCustomers
   first_name: string,
   last_name: string,
   email: string,
   password: string,
   phone: string
}

export interface Customer {
   // used in editCustomer()
   // should match this request schema:
   // https://docs.medusajs.com/api/store#tag/Customers/operation/PostCustomersCustomer
   first_name?: string,
   last_name?: string,
   billing_address?: Address,
   password?: string,
   phone?: string,
   email?: string,
   metadata?: object
}

export interface Address {
   // used in Customer interface, updateCartAddress(), addAddress(), and updateShippingAddress()
   // should match this request schema:
   // https://docs.medusajs.com/api/store#tag/Customers/operation/PostCustomersCustomerAddresses
   first_name: string,
   last_name: string,
   phone?: string,
   company?: string,
   address_1: string,
   address_2?: string,
   city: string,
   country_code: string,
   province: string,
   postal_code: string
   metadata?: object
}

export class MedusaClient {
   private url: string
   private options: any
   private retry: number
   private timeout: number
   private headers: any
   private persistentCart: boolean = false

   constructor(url: string, options: any = {}) {
      this.url = url
      this.options = options
      this.retry = this.options?.retry || 0
      this.timeout = this.options?.timeout || 5000
      this.headers = this.options?.headers || {}
      this.persistentCart = this.options?.persistentCart || false
   }

   async query(locals:App.Locals, path:string, method:string ='GET', body:object = {}) {
      let headers: any = {}
      for (const [key, value] of Object.entries(this.headers)) {
         headers[key] = value
      }
      if (locals.sid) {
         headers['Cookie'] = `connect.sid=${locals.sid}`
      }
      if (Object.keys(body).length != 0) {
         headers['Content-Type'] = 'application/json'
      }
      return await superFetch(`${this.url}${path}`, {
         timeout: this.timeout,
         retry: this.retry,
         method,
         headers,
         body: (Object.keys(body).length != 0) ? JSON.stringify(body) : null
      })
   }

   buildQuery(base: string, options:any = {}) {
      let queryString = base
      if (Object.keys(options).length !== 0) queryString += '?'
      if (options.limit) queryString += `limit=${options.limit}&`
      if (options.offset) queryString += `offset=${options.offset}&`
      if (options.order) queryString += `order=${options.order}&`
      if (options.expand) queryString += `expand=${encodeURIComponent(options.expand)}&`
      if (options.fields) queryString += `fields=${encodeURIComponent(options.fields)}&`
      if (options.query) queryString += `${encodeURIComponent(options.query)}&`
      return queryString
   }

   async handleRequest(event:RequestEvent) {
      // this middleware function is called by src/hooks.server.ts or src/hooks.server.js

      event.locals.sid = event.cookies.get('sid')
      if (event.locals.sid) event.locals.user = await this.getCustomer(event.locals, event.cookies) 
      else event.locals.sid = ''

      event.locals.cartid = event.cookies.get('cartid')
      let cart: any = await this.getCart(event.locals, event.cookies)
      event.locals.cartid = cart?.id || ''
      event.locals.cart = cart || null

      return event
   }

   async parseAuthCookie(setCookie:[] = [], locals:App.Locals , cookies:Cookies) {
      try {
         for (let rawCookie of setCookie) {
            let parsedCookie = cookie.parse(rawCookie)
            if (parsedCookie['connect.sid']) {
               locals.sid = parsedCookie['connect.sid']
               let expires = new Date(parsedCookie['Expires'])
               let maxAge = Math.floor((expires.getTime() - Date.now()) / 1000)
               cookies.set('sid', locals.sid, {
                  path: '/',
                  maxAge: maxAge,
                  sameSite: 'strict',
                  httpOnly: true,
                  secure: true
               })
               return true
            }
         }
      } catch (e) {
         console.log(e)
         return false
      }
   }

   async getCustomer(locals:App.Locals, cookies:Cookies) {
      // returns a user object if found, or null if not
      try {
         const response = await this.query(locals, '/store/auth')
         await this.parseAuthCookie(response.headers.getSetCookie(), locals, cookies)
         return await response.json().then((data:any) => data.customer)
      } catch (e) {
         return null
      }
   }

   async login(locals:App.Locals, cookies:Cookies, email:string, password:string) {
      // returns true or false based on success
      const response = await this.query(locals, '/store/auth', 'POST', { email, password })
      if (!response.ok) return false
      return await this.parseAuthCookie(response.headers?.getSetCookie(), locals, cookies).catch(() => false)
   }

   async logout(locals:App.Locals, cookies:Cookies) {
      // returns true or false based on success
      await this.query(locals, '/store/auth', 'DELETE')
         .then((res:any) => res.ok)
         .catch(() => false)
      locals.sid = ''
      locals.user = {}
      cookies.delete('sid')
      return true
   }

   async register (locals:App.Locals, cookies:Cookies, user:User) {
      // returns true or false based on success
      const { email, password } = user
      const response = await this.query(locals, '/store/customers', 'POST', user).catch(() => { return false })
      if (response.ok) {
         return await this.login(locals, cookies, email, password).catch(() => false)
      }
   }

   async getSearchResults(q:string) {
      // returns an array of hits, if any
      if (!q) { return Array() }
      return await this.query({}, '/store/products/search', 'POST', { q })
         .then((res:any) => res.json()).then((data:any) => data.hits)
         .catch(() => null)
   }

   async getProducts(options:ProductRetrievalOptions = {}) {
      // returns an array of product objects
      const queryString = this.buildQuery('/store/products', options)
      return await this.query({}, queryString)
         .then((res:any) => res.json()).then((data:any) => data.products)
         .catch(() => null)
   }

   async getCollections(options:CollectionRetrievalOptions = {}) {
      // returns an array of collection objects on success
      const queryString = this.buildQuery('/store/collections', options)
      return await this.query({}, queryString)
         .then((res:any) => res.json()).then((data:any) => data.collections)
         .catch(() => null)
   }

   async getCollection(handle:string) {
      // returns a collection object on success
      return await this.query({}, `/store/collections?handle[]=${handle}`)
         .then((res:any) => res.json()).then((data:any) => data.collections[0])
         .catch(() => null)
   }

   async getCollectionProducts(id:string, options:ProductRetrievalOptions = {}) {
      // returns an array of product objects on success
      let base = `/store/products?collection_id[]=${id}`
      const queryString = this.buildQuery(base, options)
      return await this.query({}, queryString)
         .then((res:any) => res.json()).then((data:any) => data.products)
         .catch(() => null)
   }

   async getProduct(handle:string) {
      // returns a product object on success
      let product = await this.query({}, `/store/products?handle=${handle}`)
         .then((res:any) => res.json()).then((data:any) => data.products[0])
         .catch(() => null)
      if (!product) { return null }
      for (let option of product.options) {
         option.filteredValues = this.filteredValues(option)
      }
      return product
   }

   async getReviews(productId:string, options:ReviewRetrievalOptions = {}) {
      // returns an array of review objects on success
      // options - page = 1, limit = 10, sort = 'created_at', order = 'desc', search = null
      // TODO: handle options
      return await this.query({}, `/store/products/${productId}/reviews`)
         .then((res:any) => res.json()).then((data:any) => data.product_reviews)
         .catch(() => null)
   }

   async getCustomerReviews(locals:App.Locals, options:ReviewRetrievalOptions = {}) {
      // returns an array of review objects on success
      // options - page = 1, limit = 10, sort = 'created_at', order = 'desc', search = null
      // TODO: handle options
      return await this.query(locals, `/store/customers/me/reviews`)
         .then((res:any) => res.json()).then((data:any) => data.product_reviews)
         .catch(() => null)
   }

   async getReview(reviewId:string) {
      // returns a review object on success
      return await this.query({}, `/store/reviews/${reviewId}`)
         .then((res:any) => res.json()).then((data:any) => data.product_review)
         .catch(() => null)
   }

   // CHANGE TO RETURN THE REVIEW OBJECT ON SUCCESS
   async addReview(locals:App.Locals, review:Review) {
      // returns true or false based on success
      // @ts-ignore
      return await this.query(locals, `/store/products/${review.product_id}/reviews`, 'POST', review)
      .then((res:any) => res.ok)
      .catch(() => false)
   }

   async updateReview(locals:App.Locals, reviewId:string, review:Review) {
      // returns a review object on success, or null on failure
      return await this.query(locals, `/store/reviews/${reviewId}`, 'POST', review)
      .then((res:any) => res.ok)
      .catch(() => null)
   }

   async getCart(locals:App.Locals, cookies:Cookies) {
      // returns a cart array on success, otherwise null
      let cart
      if (locals.cartid) {
         cart = await this.query(locals, `/store/carts/${locals.cartid}`)
            .then((res:any) => res.json()).then((data:any) => data.cart)
            .catch(() => null)
      } else if (this.persistentCart && locals.user) {
         cart = await this.query(locals, `/store/customers/me/cart`)
            .then((res:any) => res.json()).then((data:any) => data.cart)
            .catch(() => null)
         if (cart) {
            cookies.set('cartid', cart.id, {
               path: '/',
               maxAge: 60 * 60 * 24 * 400,
               sameSite: 'strict',
               httpOnly: true,
               secure: true
            })
         }
      }
      if (locals.cartid && !cart) {
         locals.cartid = ''
         cookies.delete('cartid')
      }
      return cart
   }

   async addToCart(locals:App.Locals, cookies:Cookies, variantId:string, quantity:number = 1) {
      // returns a cart array on success, otherwise null
      if (!variantId) { return null }

      // try adding to existing cart
      if (locals.cartid) { 
         try {
            const cart = await this.query(locals, `/store/carts/${locals.cartid}/line-items`, 'POST', { variant_id: variantId, quantity: quantity })
               .then((res:any) => res.json()).then((data:any) => data.cart)
            return cart
         } catch {}
      }

      // if no cart or add to cart fails, try to create new cart
      const cart = await this.query(locals, '/store/carts', 'POST', { items: [{ variant_id: variantId, quantity: quantity }] })
         .then((res:any) => res.json()).then((data:any) => data.cart)
         .catch(() => null )
      cookies.set('cartid', cart.id, {
         path: '/',
         maxAge: 60 * 60 * 24 * 400,
         sameSite: 'strict',
         httpOnly: true,
         secure: true
      })
      locals.cartid = cart.id

      return cart
   }

   async removeFromCart(locals:App.Locals, itemId:string) {
      // returns a cart array on success, otherwise null
      if (!locals.cartid || !itemId) { return null }
      return await this.query(locals, `/store/carts/${locals.cartid}/line-items/${itemId}`, 'DELETE')
         .then((res:any) => res.json()).then((data:any) => data.cart)
         .catch(() => null)
   }

   async updateCart(locals:App.Locals, itemId:string, quantity:number) {
      // returns a cart array on success, otherwise null
      if (!locals.cartid || !itemId || !quantity) { return null }
      return await this.query(locals, `/store/carts/${locals.cartid}/line-items/${itemId}`, 'POST', { quantity: quantity })
         .then((res:any) => res.json()).then((data:any) => data.cart)
         .catch(() => null)
   }

   async updateCartBillingAddress(locals:App.Locals, address:Address) {
      // returns a cart array on success, otherwise null
      if (!locals.cartid) { return null }
      return await this.query(locals, `/store/carts/${locals.cartid}`, 'POST', { billing_address: address })
         .then((res:any) => res.json()).then((data:any) => data.cart)
         .catch(() => null)
   }

   async updateCartShippingAddress(locals:App.Locals, address:Address) {
      // returns a cart array on success, otherwise null
      if (!locals.cartid) { return null }
      return await this.query(locals, `/store/carts/${locals.cartid}`, 'POST', { shipping_address: address })
         .then((res:any) => res.json()).then((data:any) => data.cart)
         .catch(() => null)
   }

   async getShippingOptions(locals:App.Locals) {
      // returns an array of shipping option objects on success, otherwise null
      if (!locals.cartid) { return false }
      return await this.query(locals, `/store/shipping-options/${locals.cartid}`)
         .then((res:any) => res.json()).then((data:any) => data.shipping_options)
         .catch(() => null)
   }

   async selectShippingOption(locals:App.Locals, shippingOptionId:string) {
      // returns a cart array on success, otherwise null
      if (!locals.cartid || !shippingOptionId) { return null }
      return await this.query(locals, `/store/carts/${locals.cartid}/shipping-methods`, 'POST', { option_id: shippingOptionId })
         .then((res:any) => res.json()).then((data:any) => data.cart)
         .catch(() => null)
   }

   async createPaymentSessions(locals:App.Locals) {
      // returns a cart array on success, otherwise null
      if (!locals.cartid) { return null }
      return await this.query(locals, `/store/carts/${locals.cartid}/payment-sessions`, 'POST')
         .then((res:any) => res.json()).then((data:any) => data.cart)
         .catch(() => null)
   }

   async selectPaymentSession(locals:App.Locals, providerId:string) {
      // returns a cart array on success, otherwise null
      if (!locals.cartid) { return null }
      return await this.query(locals, `/store/carts/${locals.cartid}/payment-session`, 'POST', { provider_id: providerId })
         .then((res:any) => res.json()).then((data:any) => data.cart)
         .catch(() => null)
   }

   async completeCart(locals:App.Locals) {
      // returns an order object on success, otherwise null
      if (!locals.cartid) { return null }
      const reply = await this.query(locals, `/store/carts/${locals.cartid}/complete`, 'POST')
         .then((res:any) => res.json())
         .catch(() => null )
      return (reply.type === 'order') ? reply.data : false
   }

   async addShippingAddress(locals:App.Locals, address:Address) {
      // returns true or false based on success
      if (!locals.user) { return false }
      return await this.query(locals, `/store/customers/me/addresses`, 'POST', { address })
         .then((res:any) =>  res.ok )
         .catch(() => false)
   }

   async updateShippingAddress(locals:App.Locals, addressId:string, address:Address) {
      // returns true or false based on success
      if (!locals.user) { return false }
      return await this.query(locals, `/store/customers/me/addresses/${addressId}`, 'POST', address)
         .then((res:any) => res.ok)
         .catch(() => false)
   }

   async deleteAddress(locals:App.Locals, addressId:string) {
      // returns true or false based on success
      if (!locals.user) { return false }
      return await this.query(locals, `/store/customers/me/addresses/${addressId}`, 'DELETE')
         .then((res:any) => res.ok)
         .catch(() => false)
   }

   async getAddresses(locals:App.Locals) {
      // returns an array of address objects on success, otherwise null
      if (!locals.user) { return null }
      return await this.query(locals, `/store/customers/me/addresses`)
         .then((res:any) => res.json()).then((data:any) => data.addresses)
         .catch(() => null)
   }

   async getOrder(locals:App.Locals, id:string) {
      // returns an order object on success, otherwise null
      return await this.query(locals, `/store/orders/${id}`)
         .then((res:any) => res.json()).then((data:any) => data.order)
         .catch(() => null)
   }

   async editCustomer(locals:App.Locals, customer:Customer) {
      // returns true or false based on success
      if (!locals.user) { return false }
      return await this.query(locals, '/store/customers/me', 'POST', customer)
         .then((res:any) => res.ok)
         .catch(() => false)
   }

   async requestResetPassword(email:string) {
      // returns true or false based on success
      return await this.query({}, '/store/customers/password-token', 'POST', { email })
         .then((res:any) => res.ok)
         .catch(() => false)
   }

   async resetPassword(email:string, password:string, token:string) {
      // returns true or false based on success
      return await this.query({}, '/store/customers/password-reset', 'POST', { email, password, token })
         .then((res:any) => res.ok)
         .catch(() => false)
   }

   // @ts-ignore
   onlyUnique = (value, index, self) => self.indexOf(value) === index

   // @ts-ignore
   filteredValues = (option) => option.values.map((v) => v.value).filter(this.onlyUnique)
}