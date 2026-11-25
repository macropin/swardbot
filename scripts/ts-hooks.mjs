// Lets Node import the parts directly. They import each other as './x.js', as
// brepjs and the browser bundle expect, but the files on disk are .ts: Node
// strips the types itself, and this maps the extension.
//
//   import './ts-hooks.mjs';

import { registerHooks } from 'node:module';

registerHooks({
  resolve(specifier, context, next) {
    try {
      return next(specifier, context);
    } catch (error) {
      if (specifier.startsWith('.') && specifier.endsWith('.js')) {
        return next(`${specifier.slice(0, -3)}.ts`, context);
      }
      throw error;
    }
  },
});
