export function extractTempImageUrls(text: string): string[] {
	const matches = text.match(/\/assets\/\.temp\/[^)\s\\"']+/g);
	return matches ? [...new Set(matches)] : [];
}

export function replaceTempImageUrls(text: string, mapping: Record<string, string>): string {
	let result = text;
	for (const [oldUrl, newUrl] of Object.entries(mapping)) {
		result = result.replaceAll(oldUrl, newUrl);
	}
	return result;
}
