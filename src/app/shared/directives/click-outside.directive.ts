import { DOCUMENT } from '@angular/common';
import type { OnDestroy, OnInit } from '@angular/core';
import { Directive, ElementRef, inject, output } from '@angular/core';

/** Emits when a click lands outside the host — dropdowns, popovers, menus. */
@Directive({ selector: '[appClickOutside]' })
export class ClickOutsideDirective implements OnInit, OnDestroy {
  readonly appClickOutside = output<void>();

  private readonly host = inject(ElementRef<HTMLElement>);
  private readonly document = inject(DOCUMENT);
  private readonly onDocumentClick = (event: MouseEvent): void => {
    if (!this.host.nativeElement.contains(event.target as Node)) {
      this.appClickOutside.emit();
    }
  };

  ngOnInit(): void {
    // Deferred so the click that opened the element doesn't immediately close it.
    setTimeout(() => this.document.addEventListener('click', this.onDocumentClick));
  }

  ngOnDestroy(): void {
    this.document.removeEventListener('click', this.onDocumentClick);
  }
}
