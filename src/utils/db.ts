import { DatabaseSync } from 'node:sqlite';
import path from 'path';

export interface StudentData {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
  gender: 'Male' | 'Female' | 'Other';
  mobile: string;
  dob: string;        // ISO: yyyy-mm-dd
  subjects: string;   // comma separated e.g. "Maths,Physics"
  hobbies: string;    // comma separated e.g. "Sports,Reading"
  picture: string;    // relative path
  address: string;
  state: string;
  city: string;
}

export const DB_PATH = path.resolve(__dirname, '../../testdata.db');
export const DB_QUERY = 'SELECT * FROM students WHERE run_flag = 1 ORDER BY id';

export function getStudents(): StudentData[] {
  const db = new DatabaseSync(DB_PATH, { readOnly: true });
  try {
    const rows = db.prepare(DB_QUERY).all().map(r => ({ ...r })) as unknown as StudentData[];
    console.log(`\n[DB] File : ${DB_PATH}`);
    console.log(`[DB] Query: ${DB_QUERY}`);
    console.log(`[DB] ${rows.length} record(s) loaded: ${rows.map(r => `#${r.id} ${r.first_name} ${r.last_name}`).join(' | ')}\n`);
    return rows;
  } finally {
    db.close();
  }
}