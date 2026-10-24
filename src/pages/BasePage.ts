import { Page, Locator } from '@playwright/test';

export abstract class BasePage {
  constructor(protected readonly page: Page) {}

  async goto(path: string) {
    await this.page.goto(path, { waitUntil: 'domcontentloaded' });
    await this.removeAds();
  }

  /** DemoQA shows ads/footers that overlap the submit button. */
  async removeAds() {
    await this.page.addStyleTag({
      content: '#fixedban, footer, iframe, [id^="google_ads"], .adsbygoogle { display:none !important; }',
    });
  }

  protected async safeClick(locator: Locator) {
    await locator.scrollIntoViewIfNeeded();
    await locator.click();
  }
}
