import { NgModule } from '@angular/core'
import { CommonModule } from '@angular/common'
import { FormsModule } from '@angular/forms'
import { ConfigProvider, SettingsTabProvider } from 'tabby-core'
import { AIAssistantSettingsTabComponent } from './components/aiAssistantSettingsTab.component'
import { AIChatComponent } from './components/aiChat.component'
import { AIAssistantConfigProvider } from './config'
import { AIAssistantService } from './services/aiAssistant.service'
import { KeepHtmlPipe } from './pipes/keepHtml.pipe'

@NgModule({
    imports: [
        CommonModule,
        FormsModule,
    ],
    providers: [
        { provide: ConfigProvider, useClass: AIAssistantConfigProvider, multi: true },
        { provide: SettingsTabProvider, useClass: AIAssistantSettingsTabComponent, multi: true },
        AIAssistantService,
    ],
    declarations: [
        AIAssistantSettingsTabComponent,
        AIChatComponent,
        KeepHtmlPipe,
    ],
    exports: [
        AIChatComponent, // Export if it's used directly in other plugin templates
    ],
})
export default class AIAssistantModule { }
