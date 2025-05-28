<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import type ObsidianRAGPlugin from '../main';
  import { Notice } from 'obsidian';

  // Props: The plugin instance is passed from RAGSettingsTab.ts
  let { plugin = $bindable() }: { plugin?: ObsidianRAGPlugin } = $props();

  // State variables to hold settings values
  let openAIApiKeyValue = $state('');
  let mySettingValue = $state('');

  // Effect to update values when plugin becomes available
  $effect(() => {
    if (plugin && plugin.settings) {
      openAIApiKeyValue = plugin.settings.openAIApiKey || '';
      mySettingValue = plugin.settings.mySetting || '';
    }
  });

  // Lifecycle function: onMount is called after the component is first rendered
  onMount(() => {
    // Values are now handled by the effect above
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

  // Debounce function to prevent saving on every keystroke for API key
  // (Alternative to on:blur if live update without immediate save is needed for API key input)
  // For simplicity, we'll stick to the on:blur behavior as in the original code.

  // onDestroy can be used for cleanup if needed
  onDestroy(() => {
    // console.log("SettingsTab.svelte component destroyed");
  });
</script>

{#if plugin && plugin.settings}
<div class="obsidian-rag-settings-container p-6 space-y-6 max-w-4xl">
  <h2 class="text-2xl font-bold text-gray-900 dark:text-white mb-6 border-b border-gray-200 dark:border-gray-700 pb-3">
    Obsidian RAG Settings
  </h2>

  <!-- OpenAI API Key Card -->
  <div class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-sm p-6">
    <div class="space-y-4">
      <div>
        <label for="openai-api-key" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          OpenAI API Key
        </label>
        <input
          id="openai-api-key"
          type="password"
          placeholder="sk-..."
          bind:value={openAIApiKeyValue}
          onblur={handleApiKeyBlur}
          class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white transition-colors"
        />
        <p class="mt-2 text-sm text-gray-500 dark:text-gray-400">
          Enter your OpenAI API key. Changes are saved when you click away (on blur).
        </p>
      </div>
    </div>
  </div>

  <!-- My Original Setting Card -->
  <div class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-sm p-6">
    <div class="space-y-4">
      <div>
        <label for="my-setting" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          My Original Setting
        </label>
        <input
          id="my-setting"
          type="text"
          placeholder="Enter your secret"
          value={mySettingValue}
          oninput={handleMySettingChange}
          class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white transition-colors"
        />
        <p class="mt-2 text-sm text-gray-500 dark:text-gray-400">
          It's a secret (original setting example). Saved on change.
        </p>
      </div>
    </div>
  </div>
</div>
{:else}
<div class="obsidian-rag-settings-container p-6">
  <div class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-sm p-6">
    <p class="text-center text-gray-700 dark:text-gray-300">Loading settings...</p>
  </div>
</div>
{/if}

<style>
  /* Tailwind-based Flowbite-style components */
  .obsidian-rag-settings-container {
    max-width: 800px;
  }
</style>
