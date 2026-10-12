// Ambient type declarations for the WebAssembly build of RyuGraph (ryugraph-wasm), used as the
// Bun/Windows-compatible Cypher backend (see src/graph/store.ts). The package ships no .d.ts, so we
// type it loosely; the runtime contract is exercised by src/test/graph-foundation.test.ts, which
// builds a graph and runs a Cypher statement through RyuGraphStore under Bun.
declare module "ryugraph-wasm/sync" {
	const ryu: RyuWasmModule;
	export default ryu;
	export function init(): Promise<void>;
	export const Database: any;
	export const Connection: any;
	interface RyuWasmModule {
		init(): Promise<void>;
		Database: any;
		Connection: any;
		[key: string]: unknown;
	}
}
