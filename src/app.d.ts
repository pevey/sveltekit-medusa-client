// See https://kit.svelte.dev/docs/types#app
// for information about these interfaces
declare global {
   namespace App {
      // interface Error {}
      interface Locals {
         sid?: string,
         user?: object,
         cartid?: string,
         cart?: object
      }
      // interface PageData {}
      // interface Platform {}
   }
}

export {};
