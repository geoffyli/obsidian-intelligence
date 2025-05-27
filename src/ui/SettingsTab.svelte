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
<div class="obsidian-rag-settings-container">
  <h2>Obsidian RAG Settings</h2>

  <div class="setting-item">
    <div class="setting-item-info">
      <div class="setting-item-name">OpenAI API Key</div>
      <div class="setting-item-description">
        Enter your OpenAI API key. Changes are saved when you click away (on blur).
      </div>
    </div>
    <div class="setting-item-control">
      <input
        type="password" placeholder="sk-..."
        bind:value={openAIApiKeyValue}
        onblur={handleApiKeyBlur}
      />
      <!-- 
        Note on bind:value for openAIApiKeyValue:
        Svelte's bind:value provides two-way data binding.
        When the input changes, openAIApiKeyValue updates.
        We then explicitly update plugin.settings.openAIApiKey on blur.
      -->
    </div>
  </div>

  <div class="setting-item">
    <div class="setting-item-info">
      <div class="setting-item-name">My Original Setting</div>
      <div class="setting-item-description">
        It's a secret (original setting example). Saved on change.
      </div>
    </div>
    <div class="setting-item-control">
      <input
        type="text"
        placeholder="Enter your secret"
        value={mySettingValue} 
        oninput={handleMySettingChange} 
        aria-label="My Original Setting Value"
      />
      <!-- 
        Using one-way binding (value={mySettingValue}) and on:input for mySettingValue
        to explicitly call plugin.saveSettings() on each input.
        Alternatively, bind:value={mySettingValue} could be used with a $: reactive statement
        to watch mySettingValue and call saveSettings, but on:input is more direct here.
      -->
    </div>
  </div>
</div>
{:else}
<div class="obsidian-rag-settings-container">
  <p>Loading settings...</p>
</div>
{/if}

<style lang="scss">
  // Import global variables or mixins if needed
  // @import "../styles/_variables.scss"; 

  .obsidian-rag-settings-container {
    padding: 10px; // Basic padding
  }

  h2 {
    margin-bottom: var(--size-4-4); // Using Obsidian's variables for spacing
    border-bottom: 1px solid var(--background-modifier-border);
    padding-bottom: var(--size-4-2);
  }

  // Styles similar to Obsidian's settings UI
  .setting-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: var(--size-4-4);
    padding-bottom: var(--size-4-4);
    border-bottom: 1px solid var(--background-modifier-border-hover);

    &:last-child {
      border-bottom: none;
      margin-bottom: 0;
      padding-bottom: 0;
    }
  }

  .setting-item-info {
    flex-grow: 1;
    margin-right: var(--size-4-4);
  }

  .setting-item-name {
    font-weight: bold;
    color: var(--text-normal);
    margin-bottom: var(--size-4-1);
  }

  .setting-item-description {
    font-size: var(--font-ui-small);
    color: var(--text-muted);
    line-height: 1.4;
  }

  .setting-item-control {
    // Basic styling for input, can be enhanced
    input[type="text"],
    input[type="password"] {
      width: 250px; // Adjust as needed
      padding: var(--size-2-2) var(--size-2-3);
      border-radius: var(--radius-s);
      border: 1px solid var(--background-modifier-border);
      background-color: var(--background-primary);
      color: var(--text-normal);

      &:focus {
        border-color: var(--interactive-accent);
        box-shadow: 0 0 0 1px var(--interactive-accent);
      }
    }
  }
</style>
