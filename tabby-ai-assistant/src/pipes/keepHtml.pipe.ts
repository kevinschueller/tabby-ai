import { Pipe, PipeTransform } from '@angular/core'
import { DomSanitizer, SafeHtml } from '@angular/platform-browser'

@Pipe({ name: 'keepHtml', pure: false })
export class KeepHtmlPipe implements PipeTransform {
    constructor (private sanitizer: DomSanitizer) { }

    transform (content: string): SafeHtml {
        // In a real application, ensure that the HTML content is trusted or properly sanitized.
        // For now, we are trusting the AI's output or assuming it's plain text.
        // If the AI can generate arbitrary HTML, this needs to be more robust.
        // For example, you might want to use a library like DOMPurify here
        // or configure the AI to only output markdown and then render it safely.
        return this.sanitizer.bypassSecurityTrustHtml(content)
    }
}
