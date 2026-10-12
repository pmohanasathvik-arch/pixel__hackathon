import React, { useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import Papa from 'papaparse';
import { UploadCloud, FileSpreadsheet, CheckCircle2, AlertTriangle, Download } from 'lucide-react';
import { downloadText } from '../utils.js';

const aliases = {
  rollNumber: ['rollnumber','rollno','studentrollnumber','roll','id'],
  name: ['studentname','name'], department: ['department','dept'], year: ['year','academicyear'], section: ['section'],
  classesConducted: ['classesconducted','conducted','totalclasses','totalclassesconducted'],
  classesAttended: ['classesattended','attended','presentclasses'],
  cgpa: ['cgpa','gpa','cumulativegpa'], backlogs: ['backlogs','activebacklogs','pendingbacklogs','arrears'],
  dataAsOf: ['dataasof','dateasof','attendanceasof','lastupdated']
};
const norm = v => String(v ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');
function mapRow(row) {
  const keys = Object.keys(row); const get = f => { const key=keys.find(k=>aliases[f].includes(norm(k))); return key===undefined?'':row[key]; };
  const optionalNumber = v => String(v??'').trim()==='' ? null : Number(v);
  const record = {rollNumber:String(get('rollNumber')??'').trim().toUpperCase(),name:String(get('name')??'').trim(),department:String(get('department')||'').trim(),year:String(get('year')||'').trim(),section:String(get('section')||'').trim(),classesConducted:optionalNumber(get('classesConducted')),classesAttended:optionalNumber(get('classesAttended')),cgpa:optionalNumber(get('cgpa')),backlogs:optionalNumber(get('backlogs')),dataAsOf:String(get('dataAsOf')||'').slice(0,40)};
  const errors=[];
  if(!record.rollNumber) errors.push('Missing roll number'); if(!record.name) errors.push('Missing student name');
  if(record.classesConducted!==null&&(!Number.isInteger(record.classesConducted)||record.classesConducted<0)) errors.push('Classes conducted must be a non-negative whole number');
  if(record.classesAttended!==null&&(!Number.isInteger(record.classesAttended)||record.classesAttended<0)) errors.push('Classes attended must be a non-negative whole number');
  if(record.classesConducted!==null&&record.classesAttended!==null&&record.classesAttended>record.classesConducted) errors.push('Attended exceeds conducted');
  if(record.cgpa!==null&&(!Number.isFinite(record.cgpa)||record.cgpa<0||record.cgpa>10)) errors.push('CGPA must be between 0 and 10');
  if(record.backlogs!==null&&(!Number.isInteger(record.backlogs)||record.backlogs<0)) errors.push('Backlogs must be a non-negative whole number');
  return {...record,errors};
}
export default function AcademicProfileImport({user}) {
 const [rows,setRows]=useState([]),[fileName,setFileName]=useState(''),[error,setError]=useState(''),[message,setMessage]=useState(''),[busy,setBusy]=useState(false);
 const preview=useMemo(()=>{const seen=new Set();return rows.map(r=>{const errors=[...r.errors];if(r.rollNumber&&seen.has(r.rollNumber))errors.push('Duplicate roll number');seen.add(r.rollNumber);return {...r,errors};});},[rows]);
 async function chooseFile(file){if(!file)return;setError('');setMessage('');setBusy(true);setFileName(file.name);try{const ext=file.name.split('.').pop().toLowerCase();let raw;if(ext==='csv'){const parsed=Papa.parse(await file.text(),{header:true,skipEmptyLines:true});if(parsed.errors.length)throw new Error(parsed.errors[0].message);raw=parsed.data;}else if(['xlsx','xls'].includes(ext)){const wb=XLSX.read(await file.arrayBuffer(),{type:'array'});raw=XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]],{defval:''});}else throw new Error('Choose a CSV or Excel file (.xlsx/.xls).');if(!raw.length)throw new Error('The file has no data rows.');setRows(raw.map(mapRow));}catch(e){setRows([]);setError(e.message||'Could not read file.');}finally{setBusy(false);}}
 async function importRows(){const valid=preview.filter(r=>!r.errors.length);if(!valid.length){setError('There are no valid rows to import.');return;}setBusy(true);setError('');setMessage('');try{const token=user?.accessToken||localStorage.getItem('psyns_access_token');const response=await fetch(`${import.meta.env.VITE_API_URL||'http://127.0.0.1:8000'}/api/academic/import`,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},body:JSON.stringify({records:valid.map(({errors,...r})=>r)})});const data=await response.json().catch(()=>({}));if(!response.ok)throw new Error(data.detail||`Import failed (${response.status})`);setMessage(`${data.message} ${data.imported} record(s) saved.`);setRows([]);setFileName('');}catch(e){setError(e.message||'Import failed.');}finally{setBusy(false);}}
 return <div className="page-stack"><div className="page-heading"><div><div className="eyebrow">ACADEMIC DATA</div><h1>Import academic profiles</h1><p>Upload verified student details for faculty review. Data is stored by roll number in the backend.</p></div><button className="btn btn-light" onClick={()=>downloadText('psyns-academic-profile-template.csv','Roll Number,Student Name,Department,Year,Section,Classes Conducted,Classes Attended,CGPA,Backlogs,Data As Of\n25AI001,Demo Student,AIML,II,A,100,86,8.6,0,2026-10-12')}><Download size={16}/> Download template</button></div>
 <div className="import-info"><div className="info-symbol"><FileSpreadsheet size={23}/></div><div><b>Supported formats: CSV and Excel (.xlsx/.xls)</b><p>Required: Roll Number and Student Name. Optional: department, year, section, classes conducted/attended, CGPA (0–10), backlogs and data date. Imported records are available only to the matching student and authorised faculty/in-charge views.</p></div></div>
 <label className="upload-zone"><input type="file" accept=".csv,.xlsx,.xls" hidden onChange={e=>chooseFile(e.target.files?.[0])}/><div className="upload-icon"><UploadCloud size={28}/></div><b>{busy?'Processing…':'Click to upload or choose a file'}</b><span>CSV or XLSX · First worksheet is used</span><small>Review and validate all rows before importing to the backend</small></label>
 {error&&<div className="notice"><AlertTriangle size={17}/><span>{error}</span></div>}{message&&<div className="last-import"><CheckCircle2 size={18}/><span><b>Import complete</b><small>{message}</small></span></div>}
 {rows.length>0&&<section className="panel"><div className="panel-header"><div><h2>Import preview</h2><p>{fileName}</p></div><span className="result-count">{preview.filter(r=>!r.errors.length).length} valid / {preview.filter(r=>r.errors.length).length} invalid</span></div><div className="table-wrap"><table><thead><tr><th>Roll number</th><th>Student</th><th>Attendance</th><th>CGPA</th><th>Backlogs</th><th>Validation</th></tr></thead><tbody>{preview.map((r,i)=><tr key={`${r.rollNumber}-${i}`}><td><b>{r.rollNumber||'—'}</b></td><td>{r.name||'—'}<small className="cell-sub">{r.department} · {r.year} / {r.section}</small></td><td>{r.classesConducted>0&&r.classesAttended!==null?`${Math.round(r.classesAttended/r.classesConducted*10000)/100}%`:'—'}</td><td>{r.cgpa??'—'}</td><td>{r.backlogs??'—'}</td><td>{r.errors.length?<span className="validation-error"><AlertTriangle size={13}/>{r.errors.join('; ')}</span>:<span className="tag tag-approved">Valid</span>}</td></tr>)}</tbody></table></div><div className="panel-footer"><span>Import updates matching roll numbers and creates missing profiles.</span><div><button className="btn btn-light" onClick={()=>{setRows([]);setFileName('');}}>Cancel</button><button className="btn btn-primary" disabled={busy||!preview.some(r=>!r.errors.length)} onClick={importRows}>{busy?'Importing…':`Import ${preview.filter(r=>!r.errors.length).length} records`}</button></div></div></section>}</div>;
}
