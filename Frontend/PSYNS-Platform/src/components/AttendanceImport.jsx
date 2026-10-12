import { useMemo, useState } from "react";
import * as XLSX from "xlsx";
import Papa from "papaparse";
import { UploadCloud, FileSpreadsheet, CheckCircle2, AlertTriangle, Download, X } from "lucide-react";
import { downloadText } from "../utils.js";

const aliases = {
  rollnumber: ["rollnumber","rollno","studentrollnumber","roll"],
  name: ["studentname","name"],
  department: ["department","dept"],
  year: ["year","academicyear"],
  section: ["section"],
  conducted: ["classesconducted","conducted","totalclasses","totalclassesconducted"],
  attended: ["classesattended","attended","presentclasses"],
  dataAsOf: ["dataasof","dateasof","attendanceasof","lastupdated"]
};
const normalize = (v) => String(v ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
function mapRow(row, index) {
  const keys = Object.keys(row);
  const get = (field) => {
    const match = keys.find(k => aliases[field].includes(normalize(k)));
    return match === undefined ? "" : row[match];
  };
  const conducted = Number(get("conducted")), attended = Number(get("attended"));
  const rollNumber = String(get("rollnumber") ?? "").trim().toUpperCase();
  const name = String(get("name") ?? "").trim();
  const errors = [];
  if (!rollNumber) errors.push("Missing roll number");
  if (!name) errors.push("Missing student name");
  if (!Number.isFinite(conducted) || conducted <= 0) errors.push("Classes conducted must be greater than 0");
  if (!Number.isFinite(attended) || attended < 0) errors.push("Classes attended must be 0 or more");
  if (Number.isFinite(conducted) && Number.isFinite(attended) && attended > conducted) errors.push("Attended classes cannot exceed conducted classes");
  return { rowNumber: index + 2, rollNumber, name, department: String(get("department") || "").trim(), year: String(get("year") || "").trim(), section: String(get("section") || "").trim(), conducted, attended, dataAsOf: String(get("dataAsOf") || "").slice(0,10), errors };
}
export default function AttendanceImport({ students, onImport, lastImport }) {
  const [rows,setRows] = useState([]), [fileName,setFileName] = useState(""), [message,setMessage] = useState(""), [busy,setBusy] = useState(false);
  const preview = useMemo(() => {
    const seen = new Set();
    return rows.map(r => {
      const errors = [...r.errors];
      if (seen.has(r.rollNumber) && r.rollNumber) errors.push("Duplicate roll number in file");
      seen.add(r.rollNumber);
      if (r.rollNumber && !students.some(s=>s.rollNumber.toUpperCase()===r.rollNumber)) errors.push("No matching student profile (new record will be added)");
      return {...r, errors};
    });
  },[rows,students]);
  const valid = preview.filter(r=>r.errors.length===0);
  const invalid = preview.filter(r=>r.errors.some(e=>!e.startsWith("No matching student profile")));
  const unmatched = preview.filter(r=>r.errors.some(e=>e.startsWith("No matching student profile")) && !r.errors.some(e=>!e.startsWith("No matching student profile")));
  async function handleFile(file) {
    if(!file) return;
    setBusy(true); setMessage(""); setFileName(file.name);
    try {
      const ext = file.name.split(".").pop().toLowerCase();
      let raw;
      if(ext==="csv") {
        const text = await file.text();
        const parsed = Papa.parse(text,{header:true,skipEmptyLines:true});
        if(parsed.errors.length) setMessage(`CSV warning: ${parsed.errors[0].message}`);
        raw = parsed.data;
      } else if(ext==="xlsx" || ext==="xls") {
        const wb = XLSX.read(await file.arrayBuffer(),{type:"array"});
        raw = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]],{defval:""});
      } else throw new Error("Choose a .csv or .xlsx file.");
      if(!raw.length) throw new Error("The selected file has no data rows.");
      setRows(raw.map(mapRow));
    } catch(e) { setRows([]); setMessage(e.message || "Could not read this file."); }
    finally { setBusy(false); }
  }
  function importRows() {
    const accepted = preview.filter(r=>!r.errors.some(e=>!e.startsWith("No matching student profile")));
    if(!accepted.length) { setMessage("There are no valid rows to import."); return; }
    onImport(accepted);
    setMessage(`Imported ${accepted.length} valid row(s). ${preview.length-accepted.length} invalid row(s) were skipped.`);
    setRows([]); setFileName("");
  }
  return <div className="page-stack">
    <div className="page-heading"><div><div className="eyebrow">DATA MANAGEMENT</div><h1>Import attendance</h1><p>Upload a department attendance sheet and review the data before it is saved.</p></div><button className="btn btn-light" onClick={()=>downloadText("psyns-attendance-template.csv","Roll Number,Student Name,Department,Year,Section,Classes Conducted,Classes Attended,Data As Of\n25AI001,Ananya Rao,AIML,II,A,100,86,2026-10-10")}><Download size={16}/> Download template</button></div>
    <div className="import-info"><div className="info-symbol"><FileSpreadsheet size={23}/></div><div><b>Supported formats: CSV and Excel (.xlsx)</b><p>Required columns: Roll Number, Student Name, Classes Conducted and Classes Attended. Department, year, section and data date are recommended.</p></div></div>
    <label className="upload-zone"><input type="file" accept=".csv,.xlsx,.xls" onChange={e=>handleFile(e.target.files?.[0])} hidden/><div className="upload-icon"><UploadCloud size={28}/></div><b>{busy?"Reading file…":"Click to upload or choose a file"}</b><span>CSV or XLSX · First worksheet is used</span><small>Choose a file to validate and preview it before importing</small></label>
    {message&&<div className="notice"><span>{message}</span><button className="plain-icon" onClick={()=>setMessage("")}><X size={16}/></button></div>}
    {lastImport&&<div className="last-import"><CheckCircle2 size={18}/><span><b>Last successful import</b><small>{lastImport.date} · {lastImport.count} rows accepted · {lastImport.fileName}</small></span></div>}
    {rows.length>0&&<section className="panel"><div className="panel-header"><div><h2>Import preview</h2><p>{fileName}</p></div><div className="preview-stats"><span className="good">{valid.length} valid</span><span className="bad">{invalid.length} invalid</span><span className="warn">{unmatched.length} unmatched</span></div></div>
      <div className="table-wrap"><table><thead><tr><th>Row</th><th>Roll number</th><th>Student name</th><th>Attendance</th><th>Data as of</th><th>Validation</th></tr></thead><tbody>{preview.map((r,i)=><tr key={`${r.rollNumber}-${i}`}><td>{r.rowNumber}</td><td><b>{r.rollNumber||"—"}</b></td><td>{r.name||"—"}</td><td>{r.conducted>0?`${Math.round(r.attended/r.conducted*10000)/100}%`:"—"}</td><td>{r.dataAsOf||"—"}</td><td>{r.errors.length===0?<span className="tag tag-approved">Valid</span>:<span className="validation-error" title={r.errors.join("; ")}><AlertTriangle size={13}/>{r.errors.join("; ")}</span>}</td></tr>)}</tbody></table></div>
      <div className="panel-footer"><span>Invalid rows are skipped. Unmatched roll numbers are added as new attendance records.</span><div><button className="btn btn-light" onClick={()=>{setRows([]);setFileName("");}}>Cancel</button><button className="btn btn-primary" disabled={!valid.length&&!unmatched.length} onClick={importRows}><CheckCircle2 size={16}/> Import {valid.length+unmatched.length} rows</button></div></div>
    </section>}
  </div>;
}