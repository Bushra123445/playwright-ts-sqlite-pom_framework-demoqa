# DemoQA Form - Playwright + TypeScript (POM)

Structure:
```
src/pages/         BasePage, PracticeFormPage  (Page Object Model)
src/utils/         db.ts (SQLite reader), dateUtils.ts
src/reporters/     ExtentReporter.ts (Extent-style HTML report)
scripts/seedDb.ts  testdata.db + sample picture banata hai
tests/             practiceForm.spec.ts (data-driven)
```

Run:
```
npm install
npx playwright install chromium
npm run seed        # testdata.db create karta hai (aap apni file bhi rakh sakte hain)
npm test            # ya: npm run test:headed
npm run report      # extent-report/index.html open
```
Naya data chahiye? `testdata.db` ke `students` table mein row add karein (`run_flag=1`) - test khud ban jayega.
