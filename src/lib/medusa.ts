import superFetch from 'sveltekit-superfetch'
import cookie from 'cookie'
import type { Cookies, RequestEvent } from '@sveltejs/kit'

export interface retrievalOptions {
   page?: number,
   limit?: number,
   sort?: string, //change to option set
   order?: string, //change to option set
   search?: string
}

export interface ProductRetrievalOptions extends retrievalOptions {
   // returns an array of product objects
   // options - page = 1, limit = 10, sort = 'created_at', order = 'desc', search = null
   // let url = `${MEDUSA_BACKEND_URL}/store/products?page=${page}&limit=${limit}&sort=${sort}&order=${order}`
   // if (search) { url += `&search=${search}` }
   // add expland option
   expand?: Array<string>
}

export interface CollectionRetrievalOptions extends retrievalOptions {

}

export interface ReviewRetrievalOptions extends retrievalOptions {

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
   province?: string,
   postal_code: string
   metadata?: object
}

export class MedusaClient {
   private url: string

   constructor(url: string) {
      this.url = url
   }

   async query(locals:App.Locals, path:string, method:string ='GET', body:object = {}) {
      const headers = locals.sid ? { 'Cookie': `connect.sid=${locals.sid}`, 'Content-Type': 'application/json' } : { 'Content-Type': 'application/json' }
      return await superFetch(`${this.url}${path}`, {
         timeout: 5000,
         retry: 0,
         method,
         headers,
         body: (Object.keys(body).length != 0) ? JSON.stringify(body) : null
      })
   }

   async handleRequest(event:RequestEvent) {
      // this middleware function is called by src/hooks.server.ts or src/hooks.server.js

      event.locals.sid = event.cookies.get('sid')
      if (event.locals.sid) event.locals.user = await this.getCustomer(event.locals) 
      else event.locals.sid = ''
   
      event.locals.cartid = event.cookies.get('cartid')
      if (event.locals.cartid) event.locals.cart = await this.getCart(event.locals)
      else event.locals.cartid = ''

      return event
   }

   async getSearchResults(q:string) {
      // returns an array of hits, if any
      if (!q) { return Array() }
      return await this.query({}, '/store/products/search', 'POST', { q })
         .then((res:any) => res.json()).then((data:any) => data.hits)
         .catch(() => Array())
   }

   async getAllProducts(options:ProductRetrievalOptions = {}) {
      // returns an array of product objects
      // options - page = 1, limit = 10, sort = 'created_at', order = 'desc', search = null
      // let url = `${MEDUSA_BACKEND_URL}/store/products?page=${page}&limit=${limit}&sort=${sort}&order=${order}`
      // if (search) { url += `&search=${search}` }
      // add expland option
      // TODO: handle options
      return await this.query({}, `/store/products`)
         .then((res:any) => res.json()).then((data:any) => data.products)
         .catch(() => Array())
   }

   async getCollections(options:CollectionRetrievalOptions = {}) {
      // returns an array of collection objects on success, otherwise an empty array
      // TODO: handle options
      return await this.query({}, '/store/collections')
         .then((res:any) => res.json()).then((data:any) => data.collections)
         .catch(() => Array())
   }

   async getCollection(handle:string) {
      // returns a collection object on success, otherwise false
      return await this.query({}, `/store/collections?handle[]=${handle}`)
         .then((res:any) => res.json()).then((data:any) => data.collections[0])
         .catch(() => false)
   }

   async getCollectionProducts(id:string) {
      // returns an array of product objects on success, otherwise false
      return await this.query({}, `/store/products?collection_id[]=${id}`)
         .then((res:any) => res.json()).then((data:any) => data.products)
         .catch(() => false)
   }

   async getCollectionProductsByHandle(handle:string) {
      // returns an array of product objects on success, otherwise false
      // requires a custom api route to work
      // returns ALL products in a collection, regardless of region, customer group, or stock level
      // Does NOT return full product data
      return await this.query({}, `/store/collection/${handle}`)
         .then((res:any) => res.json()).then((data:any) => data.collection).then((data:any) => data.products)
         .catch(() => false)
   }

   async getProduct(handle:string) {
      // returns a product object on success, otherwise false
      let product = await this.query({}, `/store/products?handle=${handle}`)
         .then((res:any) => res.json()).then((data:any) => data.products[0])
         .catch(() => { return false })
      for (let option of product.options) {
         option.filteredValues = this.filteredValues(option)
      }
      return product
   }

   async getReviews(productId:string, options:ReviewRetrievalOptions = {}) {
      // returns an array of review objects on success, otherwise an empty array
      // options - page = 1, limit = 10, sort = 'created_at', order = 'desc', search = null
      // TODO: handle options
      return await this.query({}, `/store/products/${productId}/reviews`)
         .then((res:any) => res.json()).then((data:any) => data.product_reviews)
         .catch(() => Array())
   }

   async getReview(reviewId:string) {
      // returns a review object on success, otherwise false
      return await this.query({}, `/store/reviews/${reviewId}`)
         .then((res:any) => res.json()).then((data:any) => data.product_review)
         .catch(() => false)
   }

   async addReview(locals:App.Locals, review:Review) {
      // @ts-ignore
      review.customer_id = locals.user.id
      return await this.query(locals, `/store/products/${review.product_id}/reviews`, 'POST', review)
      .then((res:any) => res.ok)
      .catch(() => false)
   }

   async updateReview(locals:App.Locals, reviewId:string, review:Review) {
      return await this.query(locals, `/store/reviews/${reviewId}`, 'POST', review)
      .then((res:any) => res.ok)
      .catch(() => false)
   }

   async getCustomer(locals:App.Locals) {
      // returns a user object
      return await this.query(locals, '/store/auth')
         .then((res:any) => res.json()).then((data:any) => data.customer)
         .catch(() => {})
   }

   async login(locals:App.Locals, cookies:Cookies, email:string, password:string) {
      // returns true or false based on success
      const response = await this.query(locals, '/store/auth', 'POST', { email, password })
      if (!response.ok) return false
      else {
         try {
            locals.user = await response.json().then((data:any) => data.customer)
            locals.sid = cookie.parse(response.headers.get('set-cookie'))['connect.sid']
            cookies.set('sid', locals.sid, {
               path: '/',
               maxAge: 60 * 60 * 24 * 400,
               sameSite: 'strict',
               httpOnly: true,
               secure: true
            })
            return true
         } catch { return false }
      }
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
      const response = await this.query(locals, '/store/customers', 'POST', user)
         .catch(() => { return false })
      if (response.ok) {
         return await this.login(locals, cookies, email, password)
            .then((res:any) => res.ok)
            .catch(() => false)
      }
   }

   async getCart(locals:App.Locals) {
      // returns a cart array on success, otherwise an empty array
      if (locals.cartid) {
         return await this.query(locals, `/store/carts/${locals.cartid}`)
            .then((res:any) => res.json()).then((data:any) => data.cart)
            .catch(() => Array())
      } else if (locals.user) {
         // todo: create new endpoint to get cart by user id
         return Array()
      } else return Array()
   }
   
   async addToCart(locals:App.Locals, cookies:Cookies, variantId:string, quantity:number = 1) {
      // returns a cart array on success, otherwise false
      if (!variantId) { return false }

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
         .catch(err => { return false })
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
      // returns a cart array on success, otherwise false
      if (!locals.cartid || !itemId) { return false }
      return await this.query(locals, `/store/carts/${locals.cartid}/line-items/${itemId}`, 'DELETE')
         .then((res:any) => res.json()).then((data:any) => data.cart)
         .catch(() => false)
   }

   async updateCart(locals:App.Locals, itemId:string, quantity:number) {
      // returns a cart array on success, otherwise false
      if (!locals.cartid || !itemId || !quantity) { return false }
      return await this.query(locals, `/store/carts/${locals.cartid}/line-items/${itemId}`, 'POST', { quantity: quantity })
         .then((res:any) => res.json()).then((data:any) => data.cart)
         .catch(() => false)
   }

   async updateCartAddress(locals:App.Locals, address:Address) {
      // returns a cart array on success, otherwise false
      if (!locals.cartid) { return false }
      return await this.query(locals, `/store/carts/${locals.cartid}`, 'POST', address)
         .then((res:any) => res.json()).then((data:any) => data.cart)
         .catch(() => false)
   }

   async getShippingOptions(locals:App.Locals) {
      // returns an array of shipping option objects on success, otherwise false
      if (!locals.cartid) { return false }
      return await this.query(locals, `/store/shipping-options/${locals.cartid}`)
         .then((res:any) => res.json()).then((data:any) => data.shipping_options)
         .catch(() => false)
   }

   async selectShippingOption(locals:App.Locals, shippingOptionId:string) {
      // returns a cart array on success, otherwise false
      if (!locals.cartid || !shippingOptionId) { return false }
      return await this.query(locals, `/store/carts/${locals.cartid}/shipping-methods`, 'POST', { option_id: shippingOptionId })
         .then((res:any) => res.json()).then((data:any) => data.cart)
         .catch(() => false)
   }

   async createPaymentSessions(locals:App.Locals) {
      // returns a cart array on success, otherwise false
      if (!locals.cartid) { return false }
      return await this.query(locals, `/store/carts/${locals.cartid}/payment-sessions`, 'POST')
         .then((res:any) => res.json()).then((data:any) => data.cart)
         .catch(() => false)
   }

   async selectPaymentSession(locals:App.Locals, providerId:string) {
      // returns a cart array on success, otherwise false
      if (!locals.cartid) { return false }
      return await this.query(locals, `/store/carts/${locals.cartid}/payment-session`, 'POST', { provider_id: providerId })
         .then((res:any) => res.json()).then((data:any) => data.cart)
         .catch(() => false)
   }

   async completeCart(locals:App.Locals) {
      // returns an order object on success, otherwise false
      if (!locals.cartid) { return false }
      const reply = await this.query(locals, `/store/carts/${locals.cartid}/complete`, 'POST')
         .then((res:any) => res.json())
         .catch(err => { return false })
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
      // returns an array of address objects on success, otherwise false
      if (!locals.user) { return false }
      return await this.query(locals, `/store/customers/me/addresses`)
         .then((res:any) => res.json()).then((data:any) => data.addresses)
         .catch(() => false)
   }

   async getOrder(locals:App.Locals, id:string) {
      // returns an order object on success, otherwise false
      return await this.query(locals, `/store/orders/${id}`)
         .then((res:any) => res.json()).then((data:any) => data.order)
         .catch(() => false)
   }

   async editCustomer(locals:App.Locals, customer:Customer) {
      // returns true or false based on success
      if (!locals.user) { return false }
      return await this.query(locals, '/store/customers/me', 'POST', customer)
         .then((res:any) => res.ok)
         .catch(() => false)
   }

   // @ts-ignore
   onlyUnique = (value, index, self) => self.indexOf(value) === index

   // @ts-ignore
   filteredValues = (option) => option.values.map((v) => v.value).filter(this.onlyUnique)
}