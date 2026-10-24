import { test } from '@playwright/test';
import { PracticeFormPage } from '../src/pages/PracticeFormPage';
import { getStudents, DB_PATH, DB_QUERY } from '../src/utils/db';

// Data testdata.db (SQLite) se - har row ka alag test banega
const students = getStudents();

test.describe('DemoQA Practice Form - data driven from testdata.db', () => {
  for (const student of students) {
    test(`Fill, verify & submit form for ${student.first_name} ${student.last_name} (id=${student.id})`, async ({ page }, testInfo) => {
      const form = new PracticeFormPage(page);

      await test.step(`Data picked from testdata.db (students table, id=${student.id})`, async () => {
        // Report mein "Test data from database" section banane ke liye
        await testInfo.attach('db-data', {
          contentType: 'application/json',
          body: JSON.stringify({ source: DB_PATH, query: DB_QUERY, record: student }),
        });
      });

      await test.step('Open DemoQA practice form', async () => {
        await form.open();
      });

      await test.step('Fill form using DB data', async () => {
        await form.fillForm(student);
      });

      await test.step('Verify filled values before submit', async () => {
        await form.verifyFilledForm(student);
        await testInfo.attach('filled-form', { body: await page.screenshot({ fullPage: true }), contentType: 'image/png' });
      });

      await test.step('Submit form', async () => {
        await form.submit();
      });

      await test.step('Verify submitted data in confirmation popup', async () => {
        await form.verifySubmittedData(student);
        await testInfo.attach('result-modal', { body: await page.screenshot(), contentType: 'image/png' });
      });

      await test.step('Close popup', async () => {
        await form.closeModal();
      });
    });
  }
});