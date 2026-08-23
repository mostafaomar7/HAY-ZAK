import { ChangeDetectionStrategy, Component, booleanAttribute, input } from '@angular/core';

export interface AccordionItem {
  id: string;
  question: string;
  answer: string;
}

/**
 * Collapsible question list — the FAQ page (FR-CMS-01).
 *
 * `<details>`/`<summary>` rather than buttons plus a signal: the browser already
 * gives the open/closed semantics, keyboard handling and screen-reader
 * announcement for free, and — the part a JavaScript version cannot match —
 * in-page find still matches text inside a collapsed answer and opens it.
 *
 * `name` groups them into an exclusive accordion, which is what the design
 * shows: one answer open at a time.
 */
@Component({
  selector: 'app-ui-accordion',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="accordion">
      @for (item of items(); track item.id) {
        <details
          class="item"
          [attr.name]="exclusive() ? group() : null"
          [open]="item.id === openId()"
        >
          <summary class="item__q">
            <span class="item__text">{{ item.question }}</span>
            <span class="item__sign" aria-hidden="true"></span>
          </summary>
          <p class="item__a">{{ item.answer }}</p>
        </details>
      }
    </div>
  `,
  styleUrl: './ui-accordion.scss',
})
export class UiAccordion {
  readonly items = input.required<readonly AccordionItem[]>();
  /** Which item starts expanded — the design opens the first of each group. */
  readonly openId = input<string>();
  /** Distinguishes one accordion from another on the same page. */
  readonly group = input('faq');
  readonly exclusive = input(true, { transform: booleanAttribute });
}
