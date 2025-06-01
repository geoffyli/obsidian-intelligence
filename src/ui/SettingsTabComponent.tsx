import React, { useState, useEffect, useCallback } from "react";
import { Notice } from "obsidian";
import IntelligencePlugin from "../main";

interface SettingsTabComponentProps {
	plugin: IntelligencePlugin;
}

const SettingsTabComponent: React.FC<SettingsTabComponentProps> = ({
	plugin,
}) => {
	const [openAIApiKeyValue, setOpenAIApiKeyValue] = useState("");
	const [mySettingValue, setMySettingValue] = useState("");

	useEffect(() => {
		if (plugin && plugin.settings) {
			setOpenAIApiKeyValue(plugin.settings.openAIApiKey || "");
			setMySettingValue(plugin.settings.mySetting || "");
		}
	}, [plugin]);

	const handleApiKeyBlur = useCallback(async () => {
		if (!plugin || !plugin.settings) return;

		const trimmedKey = openAIApiKeyValue.trim();
		if (plugin.settings.openAIApiKey !== trimmedKey) {
			plugin.settings.openAIApiKey = trimmedKey;
			new Notice("OpenAI API Key updated. Saving settings...");
			await plugin.saveSettings();
		}
	}, [plugin, openAIApiKeyValue]);

	const handleMySettingChange = useCallback(
		async (e: React.ChangeEvent<HTMLInputElement>) => {
			if (!plugin || !plugin.settings) return;

			const newValue = e.target.value;
			setMySettingValue(newValue);
			plugin.settings.mySetting = newValue;
			await plugin.saveSettings();
		},
		[plugin]
	);

	if (!plugin || !plugin.settings) {
		return (
			<div className="intelligence-settings-container">
				<p className="text-center text-text-muted">
					Loading settings...
				</p>
			</div>
		);
	}

	return (
		<div className="obsidian-intelligence">
			<div className="intelligence-settings-container">
				<div className="intelligence-settings-field">
					<label
						htmlFor="openai-api-key"
						className="intelligence-settings-label"
					>
						OpenAI API Key
					</label>
					<input
						id="openai-api-key"
						type="password"
						placeholder="sk-..."
						value={openAIApiKeyValue}
						onChange={(e) => setOpenAIApiKeyValue(e.target.value)}
						onBlur={handleApiKeyBlur}
						className="intelligence-settings-input"
					/>
					<p className="intelligence-settings-description">
						Enter your OpenAI API key. Changes are saved when you
						click away (on blur).
					</p>
				</div>

				<div className="intelligence-settings-field">
					<label
						htmlFor="my-setting"
						className="intelligence-settings-label"
					>
						My Original Setting
					</label>
					<input
						id="my-setting"
						type="text"
						placeholder="Enter your secret"
						value={mySettingValue}
						onChange={handleMySettingChange}
						className="intelligence-settings-input"
					/>
					<p className="intelligence-settings-description">
						It's a secret (original setting example). Saved on
						change.
					</p>
				</div>

				<div className="mt-6">
					<p className="intelligence-settings-description">
						These settings are saved automatically when you change
						them. The plugin will re-initialize with the new
						settings.
					</p>
				</div>
			</div>
		</div>
	);
};

export default SettingsTabComponent;
