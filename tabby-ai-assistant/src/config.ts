import { ConfigProvider } from 'tabby-core'

export class AIAssistantConfigProvider extends ConfigProvider {
    defaults = {
        aiAssistant: {
            apiKey: '',
            hotkey: 'Ctrl+Shift+A',
            model: 'gpt-3.5-turbo', // Default model
        },
    }

    platformDefaults = {}
}
