import { TestBed } from '@angular/core/testing';
import { LanguageService } from './language.service';

/**
 * The switch has to turn the page around, not only translate it.
 *
 * These assert the **computed** direction, not the `dir` attribute. Setting the
 * attribute was never the part that broke: `dir` takes effect through a
 * user-agent rule, so a single `html { direction: rtl }` in the global
 * stylesheet outranked it and the whole interface stayed right-to-left while
 * every string turned into English — full stops rendered at the start of the
 * line, and the three "how it works" cards counting backwards.
 *
 * An attribute assertion passes happily against that bug. A computed one does
 * not, and `src/styles.scss` is in the test bundle so this sees the real
 * cascade.
 */
describe('LanguageService direction', () => {
  let service: LanguageService;

  function computedDirection(): string {
    return getComputedStyle(document.documentElement).direction;
  }

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({});
    service = TestBed.inject(LanguageService);
    TestBed.tick();
  });

  afterEach(() => {
    localStorage.clear();
    document.documentElement.setAttribute('dir', 'rtl');
    document.documentElement.setAttribute('lang', 'ar');
  });

  it('starts in Arabic, laid out right to left', () => {
    expect(document.documentElement.getAttribute('lang')).toBe('ar');
    expect(computedDirection()).toBe('rtl');
  });

  it('lays the page out left to right in English', () => {
    service.set('en');
    TestBed.tick();

    expect(document.documentElement.getAttribute('lang')).toBe('en');
    expect(computedDirection()).toBe('ltr');
  });

  it('turns back when the language does', () => {
    service.set('en');
    TestBed.tick();
    service.set('ar');
    TestBed.tick();

    expect(computedDirection()).toBe('rtl');
  });

  it('lets a child element inherit the direction rather than pinning its own', () => {
    // Every logical property in the stylesheets resolves against this. A rule
    // that pinned direction anywhere up the tree would strand the subtree the
    // same way the html rule stranded the page.
    const child = document.createElement('div');
    document.body.appendChild(child);

    service.set('en');
    TestBed.tick();
    expect(getComputedStyle(child).direction).toBe('ltr');

    child.remove();
  });
});
