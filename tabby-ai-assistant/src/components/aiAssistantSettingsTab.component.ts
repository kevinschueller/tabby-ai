import { Component } from '@angular/core'
import { ConfigService } from 'tabby-core'

@Component({
    template: `
        <div class="form-group">
            <label class="form-label">OpenRouter API Key</label>
            <input type="password" class="form-control" [(ngModel)]="config.store.aiAssistant.apiKey">
            <small class="form-text text-muted">Your OpenRouter API key. Find it at <a href="https://openrouter.ai/keys" target="_blank">openrouter.ai/keys</a>.</small>
        </div>
        <div class="form-group">
            <label class="form-label">Chat Model</label>
            <input class="form-control" [(ngModel)]="config.store.aiAssistant.model">
            <small class="form-text text-muted">e.g., gpt-3.5-turbo, claude-2, llama-2-70b-chat. See <a href="https://openrouter.ai/models" target="_blank">OpenRouter Models</a>.</small>
        </div>
        <div class="form-group">
            <label class="form-label">Hotkey to Toggle AI Panel</label>
            <input class="form-control" [(ngModel)]="config.store.aiAssistant.hotkey">
            <small class="form-text text-muted">Default: Ctrl+Shift+A</small>
        </div>
    `,
})
export class AIAssistantSettingsTabComponent {
    constructor (public config: ConfigService) { }
}
