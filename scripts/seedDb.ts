import { DatabaseSync } from 'node:sqlite';
import fs from 'fs';
import path from 'path';

const root = path.resolve(__dirname, '..');
const dbPath = path.join(root, 'testdata.db');
if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);

// 1x1 PNG for the upload field
fs.mkdirSync(path.join(root, 'test-data'), { recursive: true });
fs.writeFileSync(
  path.join(root, 'test-data/profile.png'),
  Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64')
);

const db = new DatabaseSync(dbPath);
db.exec(`
CREATE TABLE students (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  first_name TEXT NOT NULL, last_name TEXT NOT NULL, email TEXT NOT NULL,
  gender TEXT NOT NULL, mobile TEXT NOT NULL, dob TEXT NOT NULL,
  subjects TEXT, hobbies TEXT, picture TEXT, address TEXT,
  state TEXT, city TEXT, run_flag INTEGER DEFAULT 1
);`);

const ins = db.prepare(`INSERT INTO students
 (first_name,last_name,email,gender,mobile,dob,subjects,hobbies,picture,address,state,city)
 VALUES (@first_name,@last_name,@email,@gender,@mobile,@dob,@subjects,@hobbies,@picture,@address,@state,@city)`);

[
  { first_name:'Ali',   last_name:'Khan',   email:'ali.khan@example.com',   gender:'Male',   mobile:'3001234567', dob:'1995-03-15', subjects:'Maths,Physics',   hobbies:'Sports,Reading', picture:'test-data/profile.png', address:'House 12, Block 5, Karachi', state:'NCR',           city:'Delhi'  },
  { first_name:'Sara',  last_name:'Ahmed',  email:'sara.ahmed@example.com', gender:'Female', mobile:'3112223344', dob:'1998-11-02', subjects:'English,Biology', hobbies:'Music',          picture:'test-data/profile.png', address:'Flat 4, Gulshan, Karachi',   state:'Uttar Pradesh', city:'Agra'   },
  { first_name:'Hamza', last_name:'Sheikh', email:'hamza.s@example.com',    gender:'Other',  mobile:'3335556677', dob:'2000-07-21', subjects:'Computer Science',hobbies:'Reading,Music',  picture:'test-data/profile.png', address:'Street 9, Lahore',           state:'Haryana',       city:'Karnal' },
].forEach(r => ins.run(r));

const count = db.prepare('SELECT COUNT(*) AS c FROM students').get() as { c: number };
console.log('testdata.db created with', count.c, 'rows');
db.close();