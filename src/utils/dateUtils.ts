const SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const LONG = ['January','February','March','April','May','June','July','August','September','October','November','December'];

function parts(iso: string) {
  const [y, m, d] = iso.split('-').map(Number);
  return { y, m: m - 1, d };
}
/** "1995-03-15" -> "15 Mar 1995" (value typed into the date picker) */
export const toInputFormat = (iso: string) => { const p = parts(iso); return `${String(p.d).padStart(2,'0')} ${SHORT[p.m]} ${p.y}`; };
/** "1995-03-15" -> "15 March,1995" (format shown in the result modal) */
export const toModalFormat = (iso: string) => { const p = parts(iso); return `${String(p.d).padStart(2,'0')} ${LONG[p.m]},${p.y}`; };
