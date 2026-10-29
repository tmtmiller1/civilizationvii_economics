// _game-paths-hooks.mjs - a module resolve hook for the boot test: the game's own modules ("/core/...",
// "/base-standard/...") don't exist under Node, so each resolves to tests/_game-module-stub.mjs. Registered by the
// test with module.register before it imports the bootstrap.
const STUB = new URL("./_game-module-stub.mjs", import.meta.url).href;

export async function resolve(specifier, context, next) {
  if (specifier.startsWith("/core/") || specifier.startsWith("/base-standard/")) {
    return { url: `${STUB}?for=${encodeURIComponent(specifier)}`, shortCircuit: true };
  }
  return next(specifier, context);
}
