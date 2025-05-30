<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import type ObsidianRAGPlugin from '../main';
  import { Notice } from 'obsidian';
  import { Input } from '$lib/components/ui/input';
  import { Label } from '$lib/components/ui/label';
  import * as Popover from "$lib/components/ui/popover/index.js";
  import { Button } from "$lib/components/ui/button/index.js";

  // Props: The plugin instance is passed from RAGSettingsTab.ts
  export let plugin: ObsidianRAGPlugin | undefined = undefined;

  // State variables to hold settings values
  let openAIApiKeyValue = '';
  let mySettingValue = '';

  // Reactive statement to update values when plugin becomes available
  $: if (plugin && plugin.settings) {
    openAIApiKeyValue = plugin.settings.openAIApiKey || '';
    mySettingValue = plugin.settings.mySetting || '';
  }

  // Lifecycle function: onMount is called after the component is first rendered
  onMount(() => {
    // Values are now handled by the reactive statement above
  });

  // Function to handle API key changes and save on blur
  async function handleApiKeyBlur() {
    if (!plugin || !plugin.settings) return;
    if (plugin.settings.openAIApiKey !== openAIApiKeyValue.trim()) {
      plugin.settings.openAIApiKey = openAIApiKeyValue.trim();
      new Notice("OpenAI API Key updated. Saving settings...");
      await plugin.saveSettings(); // This will trigger re-initialization via main.ts
    }
  }

  // Function to handle changes to mySetting and save immediately
  async function handleMySettingChange(event: Event) {
    if (!plugin || !plugin.settings) return;
    const target = event.target as HTMLInputElement;
    mySettingValue = target.value;
    plugin.settings.mySetting = mySettingValue;
    // No separate notice here as saveSettings in main.ts will show one
    await plugin.saveSettings();
  }

  // onDestroy can be used for cleanup if needed
  onDestroy(() => {
    // console.log("SettingsTab.svelte component destroyed");
  });
</script>

{#if plugin && plugin.settings}
<div class="obsidian-rag-plugin my-plugin-root obsidian-rag-settings-container p-6 space-y-6 max-w-4xl">
  <!-- OpenAI API Key -->
      <div class="space-y-2">
        <Label for="openai-api-key">OpenAI API Key</Label>
        <Input
          id="openai-api-key"
          type="password"
          placeholder="sk-..."
          bind:value={openAIApiKeyValue}
          on:blur={handleApiKeyBlur}
        />
        <p class="text-sm text-muted-foreground">
          Enter your OpenAI API key. Changes are saved when you click away (on blur).
        </p>
      </div>

  <!-- My Original Setting Card -->
      <div class="space-y-2">
        <Label for="my-setting">My Original Setting</Label>
        <Input
          id="my-setting"
          type="text"
          placeholder="Enter your secret"
          value={mySettingValue}
          on:input={handleMySettingChange}
        />
        <p class="text-sm text-muted-foreground">
          It's a secret (original setting example). Saved on change.
        </p>
      </div>
  <div class="text-sm text-muted-foreground mt-6">
	<p>
	  These settings are saved automatically when you change them. The plugin will re-initialize with the new settings.
	</p>
  </div>
</div>
{:else}
<div class="obsidian-rag-plugin my-plugin-root obsidian-rag-settings-container p-6">
      <p class="text-center text-muted-foreground">Loading settings...</p>
</div>
{/if}

