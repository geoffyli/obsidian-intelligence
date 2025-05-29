<script lang="ts">
	import { cn } from "$lib/utils.js";

	export let type: "text" | "email" | "password" | "number" | "search" | "url" | "tel" = "text";
	export let value: string = "";
	export let placeholder: string = "";
	export let disabled: boolean = false;
	export let readonly: boolean = false;
	export let required: boolean = false;
	
	let className = "";
	export { className as class };

	function handleInput(event: Event) {
		const target = event.target as HTMLInputElement;
		value = target.value;
	}
</script>

{#if type === "text"}
<input
	type="text"
	class={cn(
		"flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
		className
	)}
	{placeholder}
	{disabled}
	{readonly}
	{required}
	bind:value
	on:blur
	on:change
	on:click
	on:focus
	on:input
	on:keydown
	on:keypress
	on:keyup
	on:mouseover
	on:mouseenter
	on:mouseleave
	on:paste
	{...$$restProps}
/>
{:else if type === "password"}
<input
	type="password"
	class={cn(
		"flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
		className
	)}
	{placeholder}
	{disabled}
	{readonly}
	{required}
	bind:value
	on:blur
	on:change
	on:click
	on:focus
	on:input
	on:keydown
	on:keypress
	on:keyup
	on:mouseover
	on:mouseenter
	on:mouseleave
	on:paste
	{...$$restProps}
/>
{:else}
<input
	{type}
	class={cn(
		"flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
		className
	)}
	{placeholder}
	{disabled}
	{readonly}
	{required}
	{value}
	on:blur
	on:change
	on:click
	on:focus
	on:input={handleInput}
	on:keydown
	on:keypress
	on:keyup
	on:mouseover
	on:mouseenter
	on:mouseleave
	on:paste
	{...$$restProps}
/>
{/if}