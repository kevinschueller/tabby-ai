import { Injectable } from '@angular/core'
import { ConfigService, NotificationsService } from 'tabby-core'
import axios from 'axios'

const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions'

interface ChatMessage {
    role: 'user' | 'assistant' | 'system';
    content: string;
}

@Injectable()
export class AIAssistantService {
    constructor (
        private config: ConfigService,
        private notifications: NotificationsService,
    ) { }

    async sendMessage (messages: ChatMessage[]): Promise<string | null> {
        const apiKey = this.config.store.aiAssistant.apiKey
        if (!apiKey) {
            this.notifications.error('OpenRouter API key is not configured.')
            return null
        }

        const model = this.config.store.aiAssistant.model || 'gpt-3.5-turbo';

        try {
            const response = await axios.post(
                OPENROUTER_API_URL,
                {
                    model: model,
                    messages: messages,
                },
                {
                    headers: {
                        'Authorization': `Bearer ${apiKey}`,
                        'Content-Type': 'application/json',
                    },
                }
            )

            if (response.data.choices && response.data.choices.length > 0 && response.data.choices[0].message) {
                return response.data.choices[0].message.content.trim()
            } else {
                this.notifications.error('No response from AI assistant.')
                return null
            }
        } catch (error) {
            console.error('Error sending message to AI assistant:', error)
            this.notifications.error(`Error communicating with AI assistant: ${error.message}`)
            return null
        }
    }
}
