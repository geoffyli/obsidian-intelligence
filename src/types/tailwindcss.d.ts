declare module 'tailwindcss/lib/util/flattenColorPalette' {
	type ColorValue = string | Record<string, string>;
	type ColorPalette = Record<string, ColorValue>;
	
	function flattenColorPalette(colors: ColorPalette): Record<string, string>;
	
	export default flattenColorPalette;
}