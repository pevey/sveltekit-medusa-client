import cookie from 'cookie'
import { SuperFetch } from 'sveltekit-superfetch'
import type { ProductDTO } from '@medusajs/types'
import type { Cookies, RequestEvent } from '@sveltejs/kit'
import { dev } from '$app/environment'

export interface CacheOptions {
   key: string
   ttl?: number
}

export interface ProductRetrievalOptions {
   limit?: number
   offset?: number
   order?: string
   expand?: string
   fields?: string
   query?: string
}

export interface CollectionRetrievalOptions {
   limit?: number
   offset?: number
}

export interface ReviewRetrievalOptions {

}

export interface Review {
   id?: string
   product_id: string
   customer_id?: string
   display_name: string
   content: string
   rating: number
   approved?: boolean
}

export interface User {
   // used in register()
   // should match this request schema:
   // https://docs.medusajs.com/api/store#tag/Customers/operation/PostCustomers
   first_name: string
   last_name: string
   email: string
   password: string
   phone?: string
}

export interface Customer {
   // used in editCustomer()
   // should match this request schema:
   // https://docs.medusajs.com/api/store#tag/Customers/operation/PostCustomersCustomer
   first_name?: string
   last_name?: string
   billing_address?: Address
   password?: string
   phone?: string
   email?: string
   metadata?: object
}

export interface Address {
   // used in Customer interface, updateCartAddress(), addAddress(), and updateShippingAddress()
   // should match this request schema:
   // https://docs.medusajs.com/api/store#tag/Customers/operation/PostCustomersCustomerAddresses
   first_name: string
   last_name: string
   phone?: string
   company?: string
   address_1: string
   address_2?: string
   city: string
   country_code: string
   province: string
   postal_code: string
   metadata?: object
}

export interface ClientOptions {
   retry?: number
   timeout?: number
   headers?: {}
   persistentCart?: boolean
   disableCache?: boolean
   logger?: Logger
   logFormat?: 'text' | 'json' | 'majel'
   logLevel?: 'verbose' | 'limited' | 'silent'
   excludedPaths?: string[]
   limitedPaths?: string[]
}

export interface QueryOptions {
   locals?: App.Locals
   path: string
   method?: string
   body?: object
   key?: string
   ttl?: number
   logLevel?: 'verbose' | 'limited' | 'silent'
}

export interface Logger {
   info: (message: string) => void
   error: (message: string) => void
}

export class MedusaClient {
   private url: string
   private timeout: number = 8000
   private retry: number = 0
   private headers: any
   private persistentCart: boolean = false
   private logger: Logger = console
   private logFormat: 'text' | 'json' | 'majel' = 'json'
   private logLevel: 'verbose' | 'limited' | 'silent' = (dev)? 'limited' : 'silent'
   private excludedPaths: string[] = ['/store/auth']
   private limitedPaths: string[] = []
   private superFetch: SuperFetch

   constructor(url: string, options?: ClientOptions) {
      this.url = url
      if (options) {
         let { timeout, retry, headers, persistentCart, logger, logFormat, logLevel, excludedPaths, limitedPaths } = options
         if (timeout) this.timeout = timeout
         if (retry) this.retry = retry
         if (headers) this.headers = headers
         if (persistentCart) this.persistentCart = persistentCart
         if (logger) this.logger = logger
         if (logFormat) this.logFormat = logFormat
         if (logLevel) this.logLevel = logLevel
         if (excludedPaths) { 
            for (const excluded of excludedPaths) {
               this.excludedPaths.push(excluded) 
            }
         }
         if (limitedPaths) {
            for (const limited of limitedPaths) {
               this.limitedPaths.push(limited)
            }
         }
      }
      this.superFetch = new SuperFetch({
         retry: this.retry,
         timeout: this.timeout,
         logger: this.logger,
         logFormat: this.logFormat,
         logLevel: this.logLevel,
         excludedPaths: this.excludedPaths,
         limitedPaths: this.limitedPaths
      })
   }

   async query(options: QueryOptions): Promise<Response|null> {
      const { locals, path, method = 'GET', body = {}, ...rest } = options
      let headers: any = {}
      if (this.headers) {
        for (const [key, value] of Object.entries(this.headers)) {
           headers[key] = value
        }
      }
      if (locals && locals.sid) {
         headers['Cookie'] = `connect.sid=${locals.sid}`
      }
      if (Object.keys(body).length != 0) {
         headers['Content-Type'] = 'application/json'
      }
      return await this.superFetch.query({
         url: `${this.url}${path}`,
         method,
         headers,
         body: (Object.keys(body).length != 0) ? JSON.stringify(body) : null,
         ...rest
      }).catch((e: Error) => {
         console.log(e)
         return null
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
      if (!setCookie) return false
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
      return await this.query({ 
         locals, 
         path: '/store/auth' 
      }).then((response:any) => {
         this.parseAuthCookie(response.headers.getSetCookie(), locals, cookies)
         return response.json().then((data:any) => data.customer)
      }).catch(() => null)
   }

   async login(locals:App.Locals, cookies:Cookies, email:string, password:string) {
      // returns true or false based on success
      const response = await this.query({
         locals, 
         path: '/store/auth', 
         method: 'POST', 
         body: { email, password },
         logLevel: 'silent'
      })
      if (!response || !response.ok) return false
      // @ts-ignore, getSetCookie() is new and not yet in the type definition for Headers, but it is valid
      return await this.parseAuthCookie(response.headers?.getSetCookie(), locals, cookies).catch(() => false)
   }

   async logout(locals:App.Locals, cookies:Cookies) {
      // returns true or false based on success
      let success = await this.query({
         locals, 
         path: '/store/auth', 
         method: 'DELETE'
      }).then((res:any) => res.ok).catch(() => false)
      if (!success) return false
      locals.sid = ''
      locals.user = {}
      cookies.delete('sid')
      return true
   }

   async register (locals:App.Locals, cookies:Cookies, user:User) {
      // returns true or false based on success
      const { email, password } = user
      return await this.query({
         locals, 
         path: '/store/customers', 
         method: 'POST', 
         body: user,
         logLevel: 'silent'
      }).then((res:any) => {
         if (res.ok) { 
            return this.login(locals, cookies, email, password).then(() => true).catch(() => false) 
         } else return false
      }).catch(() => false)
   }

   async getSearchResults(q:string, cacheOptions?:CacheOptions) {
      // returns an array of hits, if any
      if (!q) { return Array() }
      return await this.query({
         path: '/store/products/search',
         method: 'POST',
         body: { q },
         ...cacheOptions
      }).then((res:any) => res.json()).then((data:any) => data.hits).catch(() => null)
   }

   async getProducts(options?:ProductRetrievalOptions, cacheOptions?:CacheOptions): Promise<ProductDTO[]|null> {
      // returns an array of product objects
      const queryString = this.buildQuery('/store/products', options)
      return await this.query({ path: queryString, ...cacheOptions })
      .then((res:any) => res.json()).then((data:any) => data.products).catch(() => null)
   }

   async getCollections(options?:CollectionRetrievalOptions, cacheOptions?:CacheOptions) {
      // returns an array of collection objects on success
      const queryString = this.buildQuery('/store/collections', options)
      return await this.query({ path: queryString, ...cacheOptions })
      .then((res:any) => res.json()).then((data:any) => data.collections).catch(() => null)
   }

   async getCollection(handle:string, cacheOptions?:CacheOptions) {
      // returns a collection object on success
      return await this.query({ path: `/store/collections?handle[]=${handle}`, ...cacheOptions })
      .then((res:any) => res.json()).then((data:any) => data.collections[0]).catch(() => null)
   }

   async getCollectionProducts(id:string, options?:ProductRetrievalOptions, cacheOptions?:CacheOptions): Promise<ProductDTO[]|null> {
      // returns an array of product objects on success
      let base = `/store/products?collection_id[]=${id}`
      const queryString = this.buildQuery(base, options)
      return await this.query({ path: queryString, ...cacheOptions })
      .then((res:any) => res.json()).then((data:any) => data.products).catch(() => null)
   }

   async getProduct(handle:string, cacheOptions?:CacheOptions): Promise<ProductDTO|null> {
      // returns a product object on success
      let product = await this.query({ path: `/store/products?handle=${handle}`, ...cacheOptions })
      .then((res:any) => res.json()).then((data:any) => data.products[0]).catch(() => null)
      if (!product) { return null }
      for (let option of product.options) {
         option.filteredValues = this.filteredValues(option)
      }
      return product
   }

   async getReviews(productId:string, options?:ReviewRetrievalOptions, cacheOptions?:CacheOptions) {
      // returns an array of review objects on success
      // options - page = 1, limit = 10, sort = 'created_at', order = 'desc', search = null
      // TODO: handle options
      return await this.query({ path: `/store/products/${productId}/reviews`, ...cacheOptions })
      .then((res:any) => res.json()).then((data:any) => data.product_reviews).catch(() => null)
   }

   async getCustomerReviews(locals:App.Locals, options?:ReviewRetrievalOptions) {
      // returns an array of review objects on success
      // options - page = 1, limit = 10, sort = 'created_at', order = 'desc', search = null
      // TODO: handle options
      return await this.query({ locals, path: `/store/customers/me/reviews` })
      .then((res:any) => res.json()).then((data:any) => data.product_reviews).catch(() => null)
   }

   async getReview(reviewId:string) {
      // returns a review object on success
      return await this.query({ path:`/store/reviews/${reviewId}` })
      .then((res:any) => res.json()).then((data:any) => data.product_review).catch(() => null)
   }

   // CHANGE TO RETURN THE REVIEW OBJECT ON SUCCESS
   async addReview(locals:App.Locals, review:Review) {
      // returns true or false based on success
      return await this.query( {
         locals, 
         path: `/store/products/${review.product_id}/reviews`, 
         method: 'POST', 
         body: review
      })
      .then((res:any) => res.ok).catch(() => false)
   }

   async updateReview(locals:App.Locals, reviewId:string, review:Review) {
      // returns a review object on success, or null on failure
      return await this.query({ 
         locals, 
         path: `/store/reviews/${reviewId}`, 
         method: 'POST', 
         body: review
      }).then((res:any) => res.ok).catch(() => null)
   }

   async getCart(locals:App.Locals, cookies:Cookies) {
      // returns a cart array on success, otherwise null
      let cart
      if (locals.cartid) {
         cart = await this.query({ locals, path: `/store/carts/${locals.cartid}` })
         .then((res:any) => res.json()).then((data:any) => data.cart).catch(() => null)
         // if this cart was completed on another device, we don't want to use it
         if (cart && cart.completed_at) cart = null
      } else if (this.persistentCart && locals.user) {
         cart = await this.query({ locals, path: `/store/customers/me/cart` })
         .then((res:any) => res.json()).then((data:any) => data.cart).catch(() => null)
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
            const cart = await this.query({
               locals, 
               path: `/store/carts/${locals.cartid}/line-items`, 
               method: 'POST', 
               body: { variant_id: variantId, quantity: quantity }
            }).then((res:any) => res.json()).then((data:any) => data.cart)
            return cart
         } catch {}
      }

      // if no cart or add to cart fails, try to create new cart
      const cart = await this.query({
         locals, 
         path: '/store/carts', 
         method: 'POST', 
         body: { items: [{ variant_id: variantId, quantity: quantity }] }
      }).then((res:any) => res.json()).then((data:any) => data.cart).catch(() => null )
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
      return await this.query({
         locals, 
         path: `/store/carts/${locals.cartid}/line-items/${itemId}`, 
         method: 'DELETE'
      })
      .then((res:any) => res.json()).then((data:any) => data.cart).catch(() => null)
   }

   async updateCart(locals:App.Locals, itemId:string, quantity:number) {
      // returns a cart array on success, otherwise null
      if (!locals.cartid || !itemId || !quantity) { return null }
      return await this.query({
         locals, 
         path: `/store/carts/${locals.cartid}/line-items/${itemId}`, 
         method: 'POST', 
         body: { quantity: quantity }
      }).then((res:any) => res.json()).then((data:any) => data.cart).catch(() => null)
   }

   async updateCartBillingAddress(locals:App.Locals, address:Address) {
      // returns a cart array on success, otherwise null
      if (!locals.cartid) { return null }
      return await this.query({
         locals, 
         path: `/store/carts/${locals.cartid}`, 
         method: 'POST', 
         body: { billing_address: address }
      }).then((res:any) => res.json()).then((data:any) => data.cart).catch(() => null)
   }

   async updateCartShippingAddress(locals:App.Locals, address:Address) {
      // returns a cart array on success, otherwise null
      if (!locals.cartid) { return null }
      return await this.query({
         locals, 
         path: `/store/carts/${locals.cartid}`, 
         method: 'POST', 
         body: { shipping_address: address }
      }).then((res:any) => res.json()).then((data:any) => data.cart).catch(() => null)
   }

   async getShippingOptions(locals:App.Locals) {
      // returns an array of shipping option objects on success, otherwise null
      if (!locals.cartid) { return false }
      return await this.query({ locals, path: `/store/shipping-options/${locals.cartid}` })
      .then((res:any) => res.json()).then((data:any) => data.shipping_options).catch(() => null)
   }

   async selectShippingOption(locals:App.Locals, shippingOptionId:string) {
      // returns a cart array on success, otherwise null
      if (!locals.cartid || !shippingOptionId) { return null }
      return await this.query({
         locals, 
         path: `/store/carts/${locals.cartid}/shipping-methods`, 
         method: 'POST', 
         body: { option_id: shippingOptionId }
      }).then((res:any) => res.json()).then((data:any) => data.cart).catch(() => null)
   }

   async createPaymentSessions(locals:App.Locals) {
      // returns a cart array on success, otherwise null
      if (!locals.cartid) { return null }
      return await this.query({
         locals, 
         path: `/store/carts/${locals.cartid}/payment-sessions`, 
         method: 'POST'
      }).then((res:any) => res.json()).then((data:any) => data.cart).catch(() => null)
   }

   async selectPaymentSession(locals:App.Locals, providerId:string) {
      // returns a cart array on success, otherwise null
      if (!locals.cartid) { return null }
      return await this.query({
         locals, 
         path: `/store/carts/${locals.cartid}/payment-session`, 
         method: 'POST', 
         body: { provider_id: providerId }
      }).then((res:any) => res.json()).then((data:any) => data.cart).catch(() => null)
   }

   async completeCart(locals:App.Locals) {
      // returns an order object on success, otherwise null
      if (!locals.cartid) { return null }
      const reply = await this.query({
         locals, 
         path: `/store/carts/${locals.cartid}/complete`, 
         method: 'POST'
      }).then((res:any) => res.json()).catch(() => null )
      return (reply.type === 'order') ? reply.data : false
   }

   async addShippingAddress(locals:App.Locals, address:Address) {
      // returns true or false based on success
      if (!locals.user) { return false }
      return await this.query({
         locals, 
         path: `/store/customers/me/addresses`, 
         method: 'POST', 
         body: { address }
      }).then((res:any) =>  res.ok ).catch(() => false)
   }

   async updateShippingAddress(locals:App.Locals, addressId:string, address:Address) {
      // returns true or false based on success
      if (!locals.user) { return false }
      return await this.query({
         locals, 
         path: `/store/customers/me/addresses/${addressId}`, 
         method: 'POST', 
         body: address
      }).then((res:any) => res.ok).catch(() => false)
   }

   async deleteAddress(locals:App.Locals, addressId:string) {
      // returns true or false based on success
      if (!locals.user) { return false }
      return await this.query({
         locals, 
         path: `/store/customers/me/addresses/${addressId}`, 
         method: 'DELETE'
      }).then((res:any) => res.ok).catch(() => false)
   }

   async getAddresses(locals:App.Locals) {
      // returns an array of address objects on success, otherwise null
      if (!locals.user) { return null }
      return await this.query({ locals, path: `/store/customers/me/addresses` })
      .then((res:any) => res.json()).then((data:any) => data.addresses).catch(() => null)
   }

   async getOrder(locals:App.Locals, id:string) {
      // returns an order object on success, otherwise null
      return await this.query({ locals, path: `/store/orders/${id}` })
      .then((res:any) => res.json()).then((data:any) => data.order).catch(() => null)
   }

   async editCustomer(locals:App.Locals, customer:Customer) {
      // returns true or false based on success
      if (!locals.user) { return false }
      return await this.query({
         locals, 
         path: '/store/customers/me', 
         method: 'POST', 
         body: customer
      }).then((res:any) => res.ok).catch(() => false)
   }

   async requestResetPassword(email:string) {
      // returns true or false based on success
      return await this.query({ 
         path: '/store/customers/password-token', 
         method: 'POST', 
         body: { email } 
      }).then((res:any) => res.ok).catch(() => false)
   }

   async resetPassword(email:string, password:string, token:string) {
      // returns true or false based on success
      return await this.query({ 
         path: '/store/customers/password-reset', 
         method: 'POST', 
         body: { email, password, token }
      }).then((res:any) => res.ok).catch(() => false)
   }

   // @ts-ignore
   onlyUnique = (value, index, self) => self.indexOf(value) === index

   // @ts-ignore
   filteredValues = (option) => option.values.map((v) => v.value).filter(this.onlyUnique)
}