import { Page, Locator, expect } from '@playwright/test';
import path from 'path';
import { BasePage } from './BasePage';
import { StudentData } from '../utils/db';
import { toInputFormat, toModalFormat } from '../utils/dateUtils';

const GENDER_INDEX: Record<string, number> = { Male: 1, Female: 2, Other: 3 };
const HOBBY_INDEX: Record<string, number> = { Sports: 1, Reading: 2, Music: 3 };
const split = (s: string) => s.split(',').map(x => x.trim()).filter(Boolean);

export class PracticeFormPage extends BasePage {
  readonly firstName: Locator;
  readonly lastName: Locator;
  readonly email: Locator;
  readonly mobile: Locator;
  readonly dob: Locator;
  readonly subjectsInput: Locator;
  readonly picture: Locator;
  readonly address: Locator;
  readonly stateInput: Locator;
  readonly cityInput: Locator;
  readonly submitBtn: Locator;
  readonly modal: Locator;
  readonly modalTitle: Locator;
  readonly closeBtn: Locator;

  constructor(page: Page) {
    super(page);
    this.firstName = page.locator('#firstName');
    this.lastName = page.locator('#lastName');
    this.email = page.locator('#userEmail');
    this.mobile = page.locator('#userNumber');
    this.dob = page.locator('#dateOfBirthInput');
    this.subjectsInput = page.locator('#subjectsInput');
    this.picture = page.locator('#uploadPicture');
    this.address = page.locator('#currentAddress');
    this.stateInput = page.locator('#state input');
    this.cityInput = page.locator('#city input');
    this.submitBtn = page.locator('#submit');
    this.modal = page.locator('.modal-content');
    this.modalTitle = page.locator('#example-modal-sizes-title-lg');
    this.closeBtn = page.locator('#closeLargeModal');
  }

  async open() {
    await this.goto('/automation-practice-form');
    await expect(this.firstName).toBeVisible();
  }

  private genderLabel(g: string) { return this.page.locator(`label[for="gender-radio-${GENDER_INDEX[g]}"]`); }
  private hobbyLabel(h: string) { return this.page.locator(`label[for="hobbies-checkbox-${HOBBY_INDEX[h]}"]`); }

  async fillForm(d: StudentData) {
    await this.firstName.fill(d.first_name);
    await this.lastName.fill(d.last_name);
    await this.email.fill(d.email);
    await this.safeClick(this.genderLabel(d.gender));
    await this.mobile.fill(d.mobile);

    await this.dob.click();
    await this.dob.press('Control+A');
    await this.dob.pressSequentially(toInputFormat(d.dob));
    await this.dob.press('Enter');

    for (const s of split(d.subjects)) {
      await this.subjectsInput.fill(s);
      await this.page.locator('.subjects-auto-complete__option', { hasText: s }).first().click();
    }
    for (const h of split(d.hobbies)) {
      await this.safeClick(this.hobbyLabel(h));
    }
    await this.picture.setInputFiles(path.resolve(d.picture));
    await this.address.fill(d.address);

    await this.pickReactSelect(this.stateInput, d.state);
    await this.pickReactSelect(this.cityInput, d.city);
  }

  private async pickReactSelect(input: Locator, value: string) {
    await input.fill(value, { force: true });
    await input.press('Enter');
  }

  /** Verify what is currently on the form BEFORE submitting. */
  async verifyFilledForm(d: StudentData) {
    await expect(this.firstName).toHaveValue(d.first_name);
    await expect(this.lastName).toHaveValue(d.last_name);
    await expect(this.email).toHaveValue(d.email);
    await expect(this.mobile).toHaveValue(d.mobile);
    await expect(this.dob).toHaveValue(toInputFormat(d.dob));
    await expect(this.address).toHaveValue(d.address);
    await expect(this.page.locator(`#gender-radio-${GENDER_INDEX[d.gender]}`)).toBeChecked();
    for (const h of split(d.hobbies)) {
      await expect(this.page.locator(`#hobbies-checkbox-${HOBBY_INDEX[h]}`)).toBeChecked();
    }
    for (const s of split(d.subjects)) {
      await expect(this.page.locator('.subjects-auto-complete__multi-value__label', { hasText: s })).toBeVisible();
    }
    await expect(this.page.locator('#state')).toContainText(d.state);
    await expect(this.page.locator('#city')).toContainText(d.city);
  }

  async submit() {
    await this.safeClick(this.submitBtn);
    await expect(this.modalTitle).toHaveText('Thanks for submitting the form');
  }

  /** Reads the result modal into a { label: value } map. */
  async readResultTable(): Promise<Record<string, string>> {
    const rows = this.modal.locator('tbody tr');
    // pehle intezar karein ke saari 10 rows aa jayen (Student Name ... State and City)
    await expect(rows).toHaveCount(10);
    // phir saari rows ek hi dafa mein parh lein, beech mein table badalne ka masla nahi
    const data = await rows.evaluateAll(trs =>
      trs.map(tr => Array.from(tr.querySelectorAll('td')).map(td => (td.textContent ?? '').trim()))
    );
    const out: Record<string, string> = {};
    for (const [label, value] of data) out[label] = value ?? '';
    return out;
  }

  /** Verify the confirmation popup against the DB record. */
  async verifySubmittedData(d: StudentData) {
    const t = await this.readResultTable();
    expect(t['Student Name']).toBe(`${d.first_name} ${d.last_name}`);
    expect(t['Student Email']).toBe(d.email);
    expect(t['Gender']).toBe(d.gender);
    expect(t['Mobile']).toBe(d.mobile);
    expect(t['Date of Birth']).toBe(toModalFormat(d.dob));
    expect(t['Subjects']).toBe(split(d.subjects).join(', '));
    expect(t['Hobbies']).toBe(split(d.hobbies).join(', '));
    expect(t['Picture']).toBe(path.basename(d.picture));
    expect(t['Address']).toBe(d.address);
    expect(t['State and City']).toBe(`${d.state} ${d.city}`);
  }

  async closeModal() {
    await this.closeBtn.scrollIntoViewIfNeeded();

    const closeStrategies: Array<() => Promise<unknown>> = [
      () => this.closeBtn.click({ force: true }),
      () => this.page.keyboard.press('Escape'),
      () => this.page.evaluate(() => (document.getElementById('closeLargeModal') as HTMLElement | null)?.click()),
    ];

    for (const close of closeStrategies) {
      await close();
      try {
        await expect(this.modalTitle).toBeHidden({ timeout: 3000 });
        return;
      } catch {
        // agli strategy try karein
      }
    }
    await expect(this.modalTitle).toBeHidden(); // aakhri check
  }
}