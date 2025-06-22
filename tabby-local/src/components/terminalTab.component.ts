import { marker as _ } from '@biesbjerg/ngx-translate-extract-marker'
import { Component, Input, Injector, Inject, Optional, Output, EventEmitter } from '@angular/core'
import { BaseTabProcess, WIN_BUILD_CONPTY_SUPPORTED, isWindowsBuild, GetRecoveryTokenOptions, ConfigService, HotkeysService } from 'tabby-core'
import { BaseTerminalTabComponent, Frontend } from 'tabby-terminal'
import { LocalProfile, SessionOptions, UACService } from '../api'
import { Session } from '../session'
import { AIAssistantService } from 'tabby-ai-assistant/src/services/aiAssistant.service' // Path to actual service
import { Subject, Observable } from 'rxjs'
import { bufferTime, map } from 'rxjs/operators'


/** @hidden */
@Component({
    selector: 'terminalTab',
    template: require('./terminalTab.component.pug'),
    styles: [...BaseTerminalTabComponent.styles, require('./terminalTab.component.scss')],
    animations: BaseTerminalTabComponent.animations,
})
export class TerminalTabComponent extends BaseTerminalTabComponent<LocalProfile> {
    @Input() sessionOptions: SessionOptions // Deprecated
    session: Session|null = null
    public showAiChat = false;
    private aiChatHotkey: string // To store the configured hotkey

    // To emit output to the AI chat component
    @Output() terminalOutputToAI = new EventEmitter<string>();
    private lastOutputProcessedByAI = ''

    constructor (
        injector: Injector,
        @Optional() @Inject(UACService) private uac: UACService|undefined,
        // Inject AIAssistantService if needed for direct interaction, though AIChatComponent will have its own
        private aiAssistantService: AIAssistantService,
        private appConfig: ConfigService, // Renamed to avoid conflict with BaseTerminalTabComponent's config
        private appHotkeys: HotkeysService, // Renamed
    ) {
        super(injector)
        this.aiChatHotkey = this.appConfig.store.aiAssistant?.hotkey || 'Ctrl+Shift+A'
    }

    ngOnInit (): void {
        this.sessionOptions = this.profile.options

        this.logger = this.log.create('terminalTab')

        const isConPTY = isWindowsBuild(WIN_BUILD_CONPTY_SUPPORTED) && this.config.store.terminal.useConPTY

        this.subscribeUntilDestroyed(this.appHotkeys.hotkey$, hotkey => {
            if (!this.hasFocus) {
                return
            }
            if (hotkey === this.aiChatHotkey) {
                this.toggleAiChat()
                return // Consume the hotkey
            }
            switch (hotkey) {
                case 'home':
                    this.sendInput(isConPTY ? '\x1b[H' : '\x1bOH')
                    break
                case 'end':
                    this.sendInput(isConPTY ? '\x1b[F' : '\x1bOF')
                    break
            }
        })

        // Subscribe to config changes to update hotkey
        this.subscribeUntilDestroyed(this.appConfig.changed$, () => {
            this.aiChatHotkey = this.appConfig.store.aiAssistant?.hotkey || 'Ctrl+Shift+A'
        })

        super.ngOnInit()
    }

    toggleAiChat (): void {
        this.showAiChat = !this.showAiChat
        if (this.showAiChat) {
            // Potentially focus the AI input or perform other actions
            this.logger.info('AI Chat panel opened')
        } else {
            this.logger.info('AI Chat panel closed')
            this.frontend?.focus() // Return focus to terminal
        }
    }

    executeCommandFromAI (command: string): void {
        if (this.session && this.frontend) {
            this.logger.info(`Executing command from AI: ${command}`)
            // Ensure the command ends with a newline to execute
            const commandToSend = command.endsWith('\n') ? command : command + '\n'
            this.sendInput(Buffer.from(commandToSend))

            // Clear previous "unread" output before new command
            this.lastOutputProcessedByAI = '';

            // Focus terminal after sending command
            this.frontend.focus()
        } else {
            this.logger.warn('Cannot execute AI command: no active session or frontend.')
            this.aiAssistantService.notifications.error('No active terminal session to execute the command.')
        }
    }

    // This will be called by AIChatComponent to get new terminal output
    // It's a simplified approach. A more robust solution would be needed for complex scenarios.
    captureAndForwardOutput (): void {
        if (this.session?.output$) {
            this.subscribeUntilDestroyed(
                this.session.output$.pipe(
                    // bufferTime(500), // Buffer output for a short period to send in chunks
                    // map(chunks => chunks.join(''))
                ),
                (outputChunk: string) => {
                    if (outputChunk && outputChunk !== this.lastOutputProcessedByAI) {
                        this.terminalOutputToAI.emit(outputChunk)
                        this.lastOutputProcessedByAI = outputChunk // Mark as processed
                    }
                }
            )
        }
    }


    protected onFrontendReady (): void {
        this.initializeSession(this.size.columns, this.size.rows)
        this.savedStateIsLive = this.profile.options.restoreFromPTYID === this.session?.getID()
        super.onFrontendReady()
        // Moved captureAndForwardOutput to setSession to ensure session exists
    }

    initializeSession (columns: number, rows: number): void {

        const session = new Session(this.injector)

        if (this.profile.options.runAsAdministrator && this.uac?.isAvailable) {
            this.profile = {
                ...this.profile,
                options: this.uac.patchSessionOptionsForUAC(this.profile.options),
            }
        }

        session.start({
            ...this.profile.options,
            width: columns,
            height: rows,
        })

        this.setSession(session)
        this.recoveryStateChangedHint.next()
    }

    async getRecoveryToken (options?: GetRecoveryTokenOptions): Promise<any> {
        const cwd = this.session ? await this.session.getWorkingDirectory() : null
        return {
            type: 'app:local-tab',
            profile: {
                ...this.profile,
                options: {
                    ...this.profile.options,
                    cwd: cwd ?? this.profile.options.cwd,
                    restoreFromPTYID: options?.includeState && this.session?.getID(),
                },
            },
            savedState: options?.includeState && this.frontend?.saveState(),
        }
    }

    override setSession (session: Session|null, destroyOnSessionClose = false): void {
        super.setSession(session, destroyOnSessionClose)
        if (session) {
            // Start capturing output for AI once session is fully set up
            this.captureAndForwardOutput()
        }
    }

    async getCurrentProcess (): Promise<BaseTabProcess|null> {
        const children = await this.session?.getChildProcesses()
        if (!children?.length) {
            return null
        }
        return {
            name: children[0].command,
        }
    }

    async canClose (): Promise<boolean> {
        const children = await this.session?.getChildProcesses()
        if (!children?.length) {
            return true
        }
        return (await this.platform.showMessageBox(
            {
                type: 'warning',
                message: this.translate.instant(
                    _('"{command}" is still running. Close?'),
                    children[0],
                ),
                buttons: [
                    this.translate.instant(_('Kill')),
                    this.translate.instant(_('Cancel')),
                ],
                defaultId: 0,
                cancelId: 1,
            },
        )).response === 0
    }

    ngOnDestroy (): void {
        super.ngOnDestroy()
        this.session?.destroy()
    }

    /**
     * Return true if the user explicitly exit the session.
     * Always return true for terminalTab as the session can only be ended by the user
     */
    protected isSessionExplicitlyTerminated (): boolean {
        return true
    }
}
