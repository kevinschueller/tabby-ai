import { Component, ElementRef, ViewChild, Input, Output, EventEmitter, OnInit, OnDestroy } from '@angular/core'
import { ConfigService, NotificationsService } from 'tabby-core'
import { AIAssistantService } from '../services/aiAssistant.service'
import { Observable, Subscription } from 'rxjs'

interface Message {
    role: 'user' | 'assistant' | 'system' | 'terminal'
    content: string
}

@Component({
    selector: 'ai-chat',
    template: require('./aiChat.component.pug'),
    styles: [require('./aiChat.component.scss')],
})
export class AIChatComponent implements OnInit, OnDestroy {
    messages: Message[] = []
    userInput = ''
    isLoading = false

    @Input() terminalOutput: Observable<string>;
    @Output() executeCommand = new EventEmitter<string>();

    private terminalOutputSubscription: Subscription;
    private commandRegex = /^EXECUTE:\s*(.*)/gmi; // EXECUTE: command to run

    @ViewChild('messageHistory') private messageHistoryContainer: ElementRef

    constructor (
        public config: ConfigService,
        private aiAssistantService: AIAssistantService,
        private notifications: NotificationsService,
    ) {
        this.messages.push({ role: 'system', content: 'AI Assistant initialized. Type EXECUTE: <command> or ask for help.' })
    }

    ngOnInit (): void {
        if (this.terminalOutput) {
            this.terminalOutputSubscription = this.terminalOutput.subscribe(output => {
                if (output.trim()) {
                    this.messages.push({ role: 'terminal', content: `Terminal output:\n${output}` })
                    this.scrollToBottom()
                }
            })
        }
    }

    ngOnDestroy (): void {
        if (this.terminalOutputSubscription) {
            this.terminalOutputSubscription.unsubscribe()
        }
    }

    async sendMessage (): Promise<void> {
        if (!this.userInput.trim()) {
            return
        }

        const currentInput = this.userInput
        this.userInput = '' // Clear input immediately

        const userMessage: Message = { role: 'user', content: currentInput }
        this.messages.push(userMessage)
        this.scrollToBottom()


        // Check for EXECUTE: command locally first for quick execution
        const match = this.commandRegex.exec(currentInput)
        if (match && match[1]) {
            const commandToRun = match[1].trim()
            this.messages.push({ role: 'system', content: `Executing: ${commandToRun}` })
            this.executeCommand.emit(commandToRun)
            this.scrollToBottom()
            return // Command sent, no need to call AI for this
        }

        this.isLoading = true

        // Construct messages for the AI
        const messagesToBeSent: { role: 'user' | 'assistant' | 'system', content: string }[] = []
        // System message to guide the AI
        messagesToBeSent.push({
            role: 'system',
            content: "You are a helpful AI assistant integrated into a terminal. " +
                     "You can respond to user queries and execute terminal commands. " +
                     "To execute a command, respond with 'EXECUTE: <command_to_run>'. " +
                     "Users may also type 'EXECUTE: <command>' to run commands directly. " +
                     "Be concise and helpful."
        });

        // Add recent conversation history (user/assistant messages)
        // Limit to last N messages to avoid overly long prompts
        const conversationHistory = this.messages
            .filter(m => m.role === 'user' || m.role === 'assistant')
            .slice(-6); // Example: last 6 user/assistant messages

        conversationHistory.forEach(msg => {
            messagesToBeSent.push({ role: msg.role, content: msg.content });
        });

        // Add recent terminal output if any, as part of the last user message or a system message
        const recentTerminalMessages = this.messages.filter(m => m.role === 'terminal').slice(-2);
        if (recentTerminalMessages.length > 0) {
            const terminalContext = "Recent terminal activity:\n" + recentTerminalMessages.map(m => m.content).join("\n");
            // Option 1: Append to last user message if it exists
            const lastMessage = messagesToBeSent[messagesToBeSent.length -1];
            if (lastMessage && lastMessage.role === 'user') {
                lastMessage.content += `\n\n(Context from terminal:\n${terminalContext}\n)`;
            } else {
            // Option 2: Add as a new system message before the latest user message
                messagesToBeSent.push({ role: 'system', content: terminalContext });
            }
        }

        // Add current user input as the last message
        messagesToBeSent.push({ role: 'user', content: currentInput });

        const assistantResponse = await this.aiAssistantService.sendMessage(messagesToBeSent)
        this.isLoading = false

        if (assistantResponse) {
            this.messages.push({ role: 'assistant', content: assistantResponse })
            // Check if AI wants to execute a command
            const aiCommandMatch = this.commandRegex.exec(assistantResponse)
            if (aiCommandMatch && aiCommandMatch[1]) {
                const commandToRun = aiCommandMatch[1].trim()
                this.messages.push({ role: 'system', content: `AI is executing: ${commandToRun}` })
                this.executeCommand.emit(commandToRun)
            }
        } else {
            this.messages.push({ role: 'system', content: 'Error communicating with the AI. Please check API key and network.' })
        }
        this.scrollToBottom()
    }

    private scrollToBottom (): void {
        try {
            // Using setTimeout to ensure the DOM has updated before scrolling
            setTimeout(() => {
                if (this.messageHistoryContainer?.nativeElement) {
                    this.messageHistoryContainer.nativeElement.scrollTop = this.messageHistoryContainer.nativeElement.scrollHeight
                }
            }, 0)
        } catch (err) {
            console.error('Could not scroll to bottom:', err)
        }
    }
}
