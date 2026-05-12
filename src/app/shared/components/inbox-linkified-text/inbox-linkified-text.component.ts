import { Component, Input, OnChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LinkifySegment, linkifyToSegments } from '../../../core/utils/linkify-text';

/**
 * Renders plain text with http(s) and www. URLs as external links.
 * Parent supplies typography / layout classes (e.g. whitespace-pre-wrap).
 */
@Component({
  selector: 'app-inbox-linkified-text',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './inbox-linkified-text.component.html',
  styleUrls: ['./inbox-linkified-text.component.scss']
})
export class InboxLinkifiedTextComponent implements OnChanges {
  @Input({ required: true }) text = '';
  /** Classes on the outer wrapper (e.g. text-sm text-gray-500). */
  @Input() hostClass = '';
  /** Extra classes for anchors (defaults suit light + dark inbox). */
  @Input() linkClass = '';

  segments: LinkifySegment[] = [];

  private readonly defaultLinkClass =
    'font-medium text-blue-600 hover:text-blue-800 dark:text-sky-400 dark:hover:text-sky-300 underline underline-offset-2 break-all';

  ngOnChanges(): void {
    this.segments = linkifyToSegments(this.text ?? '');
  }

  resolvedLinkClass(): string {
    const extra = (this.linkClass || '').trim();
    return extra ? `${this.defaultLinkClass} ${extra}` : this.defaultLinkClass;
  }
}
