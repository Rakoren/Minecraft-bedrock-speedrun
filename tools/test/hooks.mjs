const map = { "@minecraft/server": "./mock-server.mjs", "@minecraft/server-ui": "./mock-ui.mjs" };
export async function resolve(spec, ctx, next) {
  if (map[spec]) return { url: new URL(map[spec], import.meta.url).href, shortCircuit: true };
  return next(spec, ctx);
}
