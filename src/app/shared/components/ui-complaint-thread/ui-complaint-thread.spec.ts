import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import type { ComplaintMessage } from '@core/models/complaint';
import { UiComplaintThread } from './ui-complaint-thread';

function message(overrides: Partial<ComplaintMessage> = {}): ComplaintMessage {
  return {
    id: 'm-1',
    senderType: 'RENTER',
    body: 'المساحة ضيقة',
    isInternal: false,
    attachments: [],
    createdAt: '2026-08-31T07:11:21.888Z',
    ...overrides,
  } as ComplaintMessage;
}

describe('UiComplaintThread', () => {
  let fixture: ComponentFixture<UiComplaintThread>;
  let el: HTMLElement;

  function render(messages: ComplaintMessage[]) {
    fixture.componentRef.setInput('messages', messages);
    fixture.detectChanges();
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [UiComplaintThread] }).compileComponents();
    fixture = TestBed.createComponent(UiComplaintThread);
    el = fixture.nativeElement as HTMLElement;
  });

  /**
   * The regression this was written for: `createdAt` went straight into the
   * template, so every line of a conversation was headed
   * `2026-08-31T07:11:21.888Z` — a machine's timestamp on the one screen
   * somebody reads back during a dispute.
   */
  it('writes the time the way a person writes one', () => {
    render([message()]);

    const time = el.querySelector('.msg__time')!;
    expect(time.textContent).not.toContain('T07:11:21.888Z');
    expect(time.textContent?.trim().length).toBeGreaterThan(0);
    // The machine-readable form stays, where machines read it.
    expect(time.getAttribute('datetime')).toBe('2026-08-31T07:11:21.888Z');
  });

  /**
   * The one asymmetry worth drawing. Every message rendered as the same grey
   * card, so the reader had to check the author label on each line to tell
   * their own words from an answer to them.
   */
  it('marks the platform’s side of the conversation', () => {
    render([message(), message({ id: 'm-2', senderType: 'ADMIN', body: 'نراجع الشكوى' })]);

    const cards = el.querySelectorAll('.msg');
    expect(cards[0].classList).not.toContain('msg--support');
    expect(cards[1].classList).toContain('msg--support');
  });

  /**
   * An internal note is filtered server-side and must never reach a user's
   * screen. If one does, it says so rather than being quietly dropped — a leak
   * that renders as an ordinary message is a leak nobody reports.
   */
  it('flags an internal note that should never have arrived', () => {
    render([message({ isInternal: true })]);
    expect(el.querySelector('.msg--stray')).not.toBeNull();
  });

  it('says there is nothing rather than rendering an empty list', () => {
    render([]);
    expect(el.querySelector('.empty')).not.toBeNull();
  });
});
