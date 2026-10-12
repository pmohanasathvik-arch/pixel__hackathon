import React, { useEffect, useState } from 'react';
import { FileText, Send, Search, Download, RefreshCw, Inbox, CheckCircle2, Clock3, AlertCircle, Bot, MessageCircle, Sparkles } from 'lucide-react';
const API = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000';
function authHeaders(token){ return { Authorization: `Bearer ${token}` }; }
function prettyDate(value){ try{return new Date(value).toLocaleString();}catch{return value||'—';} }
function AcademicProfile({profile}) {
  if(!profile) return <div className="academic-profile"><div className="academic-profile-heading"><b>Student academic profile</b><span className="tag tag-warning">No imported record</span></div><p>No academic record matches this student's roll number. Ask the event in-charge to import the latest CSV/Excel profile.</p></div>;
  const attendance=profile.classes_conducted>0&&profile.classes_attended!==null?Math.round(profile.classes_attended/profile.classes_conducted*10000)/100:null;
  const fields=[['Roll number',profile.roll_number],['Student',profile.name],['Department',profile.department],['Year / Section',[profile.year,profile.section].filter(Boolean).join(' / ')||'—'],['Attendance',attendance===null?'Not imported':`${attendance}%`],['Classes attended',profile.classes_conducted===null||profile.classes_attended===null?'Not imported':`${profile.classes_attended} / ${profile.classes_conducted}`],['CGPA',profile.cgpa===null?'Not imported':`${profile.cgpa} / 10`],['Backlogs',profile.backlogs===null?'Not imported':profile.backlogs],['Data as of',profile.data_as_of||'—']];
  return <div className="academic-profile"><div className="academic-profile-heading"><b>Student academic profile</b><span className="tag tag-approved">Imported record</span></div><div className="academic-profile-grid">{fields.map(([label,value])=><div key={label}><small>{label}</small><strong>{value??'—'}</strong></div>)}</div><small className="academic-profile-updated">Last updated: {prettyDate(profile.updated_at)}</small></div>;
}
export default function LetterCenter({user}) {
  const [faculty,setFaculty]=useState([]), [letters,setLetters]=useState([]), [subject,setSubject]=useState('Request for event permission'), [purpose,setPurpose]=useState('Requesting permission to participate in a college event.'), [recipient,setRecipient]=useState(''), [file,setFile]=useState(null), [query,setQuery]=useState(''), [busy,setBusy]=useState(false), [error,setError]=useState(''), [message,setMessage]=useState(''), [remarks,setRemarks]=useState({}), [assistantOpen,setAssistantOpen]=useState({}), [assistantChats,setAssistantChats]=useState({}), [assistantQuestions,setAssistantQuestions]=useState({}), [assistantBusy,setAssistantBusy]=useState({});
  const token=user?.accessToken || localStorage.getItem('psyns_access_token');
  const isStudent=user?.role==='student'; const isFaculty=user?.role==='proctor';
  async function request(path, options={}){
    const response=await fetch(`${API}${path}`,{...options,headers:{...authHeaders(token),...(options.headers||{})}});
    const data=await response.json().catch(()=>({}));
    if(!response.ok) throw new Error(data.detail || `Request failed (${response.status})`);
    return data;
  }
  async function refresh(){
    setError('');
    try{
      if(isStudent){const f=await request('/api/faculty');setFaculty(f.items||[]);}
      const l=await request('/api/letters');setLetters(l.items||[]);
    }catch(e){setError(`${e.message}. Check that the PSYNS backend is running.`);}
  }
  useEffect(()=>{refresh();},[user?.id,user?.role]);
  async function sendLetter(e){
    e.preventDefault();setBusy(true);setError('');setMessage('');
    try{
      if(!file) throw new Error('Choose a PDF or DOCX letter to upload.');
      const form=new FormData();form.append('subject',subject);form.append('purpose',purpose);form.append('recipient_id',recipient);form.append('document',file);
      const data=await request('/api/letters',{method:'POST',body:form});
      setMessage(`${data.message} Reference: ${data.letter.id}`);setFile(null);setSubject('');setPurpose('');setRecipient('');
      const input=document.getElementById('psyns-letter-file');if(input)input.value='';await refresh();
    }catch(e){setError(e.message);}finally{setBusy(false);}
  }
  async function changeStatus(letter,status){
    setError('');setMessage('');
    try{await request(`/api/letters/${encodeURIComponent(letter.id)}/status`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({status,remarks:remarks[letter.id]||''})});setMessage(`Updated ${letter.id} to ${status}.`);await refresh();}
    catch(e){setError(e.message);}
  }
  async function download(letter){
    setError('');try{const res=await fetch(`${API}/api/letters/${encodeURIComponent(letter.id)}/document`,{headers:authHeaders(token)});if(!res.ok){const d=await res.json().catch(()=>({}));throw new Error(d.detail||'Could not download document.');}const blob=await res.blob();const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=letter.filename||`${letter.id}.pdf`;a.click();URL.revokeObjectURL(url);}catch(e){setError(e.message);}
  }
  async function askAssistant(letter){
    const question=(assistantQuestions[letter.id]||'').trim(); if(!question)return;
    const history=assistantChats[letter.id]||[];
    const next=[...history,{role:'user',content:question}];
    setAssistantChats(prev=>({...prev,[letter.id]:next}));setAssistantQuestions(prev=>({...prev,[letter.id]:''}));setAssistantBusy(prev=>({...prev,[letter.id]:true}));setError('');
    try{const data=await request(`/api/letters/${encodeURIComponent(letter.id)}/assistant`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({question,history})});setAssistantChats(prev=>({...prev,[letter.id]:[...next,{role:'assistant',content:data.answer,mode:data.mode}]}));}
    catch(e){setAssistantChats(prev=>({...prev,[letter.id]:[...next,{role:'assistant',content:`I couldn't answer right now: ${e.message}`}]}));}
    finally{setAssistantBusy(prev=>({...prev,[letter.id]:false}));}
  }
  const shown=letters.filter(l=>`${l.id} ${l.subject} ${l.student_name} ${l.recipient_name} ${l.status}`.toLowerCase().includes(query.toLowerCase()));
  return <div className="page-stack">
    <div className="page-heading"><div><div className="eyebrow">OFFICIAL COMMUNICATION</div><h1>{isStudent?'Submit a letter':isFaculty?'Faculty letter inbox':'Letters overview'}</h1><p>{isStudent?'Send an official letter to a registered faculty member and track its status.':isFaculty?'Review letters addressed to your account and record a decision.':'View letter submissions and their current status.'}</p></div><button className="btn btn-light" onClick={refresh}><RefreshCw size={16}/> Refresh</button></div>
    {error&&<div className="notice"><AlertCircle size={17}/><span>{error}</span></div>}{message&&<div className="last-import"><CheckCircle2 size={18}/><span><b>Success</b><small>{message}</small></span></div>}
    {isStudent&&<form className="panel letter-form" onSubmit={sendLetter}><div className="panel-header"><div><h2>New official letter</h2><p>Select a registered recipient before sending.</p></div><FileText size={21} className="muted"/></div><div className="letter-form-grid">
      <label className="field-label">Subject<input className="text-input" value={subject} maxLength={180} onChange={e=>setSubject(e.target.value)} required placeholder="Request for event permission"/></label>
      <label className="field-label">Registered faculty<select className="text-input" value={recipient} onChange={e=>setRecipient(e.target.value)} required><option value="">Choose faculty member…</option>{faculty.map(f=><option value={f.id} key={f.id}>{f.name} · {f.department||'Faculty'} · {f.email}</option>)}</select></label>
      <label className="field-label letter-full">Purpose / message<textarea className="text-input textarea" rows="4" maxLength={5000} value={purpose} onChange={e=>setPurpose(e.target.value)} required placeholder="Explain the reason for this letter."/></label>
      <label className="field-label letter-full">Attach letter (PDF or DOCX, max 10 MB)<input id="psyns-letter-file" className="text-input letter-file" type="file" accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document" onChange={e=>setFile(e.target.files?.[0]||null)} required/><small className="letter-help">Your document is stored privately and can only be downloaded by you and the addressed faculty member (or authorised event in-charge).</small></label>
    </div><div className="panel-footer"><span>{file?`${file.name} · ${(file.size/1024/1024).toFixed(2)} MB`:'No document selected'}</span><button className="btn btn-primary" type="submit" disabled={busy}>{busy?'Sending…':'Send letter'} <Send size={16}/></button></div></form>}
    <section className="panel"><div className="panel-header"><div><h2>{isStudent?'Your submitted letters':isFaculty?'Letters addressed to you':'Submitted letters'}</h2><p>Delivery is recorded by PSYNS; status updates appear here.</p></div><Inbox size={21} className="muted"/></div><div className="letter-toolbar"><div className="search-box"><Search size={16}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search subject, sender or status"/></div><span className="result-count">{shown.length} letter(s)</span></div>
      {shown.length===0?<div className="empty-state"><div className="empty-icon"><FileText size={24}/></div><b>No letters found</b><p>{isStudent?'Submit your first official letter using the form above.':'Letters addressed to your account will appear here.'}</p></div>:<div className="letter-list">{shown.map(l=><article className="letter-card" key={l.id}><div className="letter-card-top"><div className="letter-icon"><FileText size={20}/></div><div className="letter-title"><b>{l.subject}</b><small>{l.id} · {prettyDate(l.created_at)}</small></div><span className={`tag ${l.status==='Approved'?'tag-approved':l.status==='Rejected'?'tag-rejected':'tag-warning'}`}><Clock3 size={12}/>{l.status}</span></div><div className="letter-meta"><span><b>{isStudent?'To':'From'}:</b> {isStudent?l.recipient_name:l.student_name}</span><span><b>Attachment:</b> {l.filename} ({(l.size/1024/1024).toFixed(2)} MB)</span></div><p className="letter-purpose">{l.purpose}</p>{isFaculty&&<><AcademicProfile profile={l.academic_profile}/><div className="faculty-ai-tools"><button className="btn btn-light" onClick={()=>setAssistantOpen(p=>({...p,[l.id]:!p[l.id]}))}><Bot size={16}/><Sparkles size={14}/>{assistantOpen[l.id]?'Hide AI assistant':'Ask AI about this student'}</button><span>Uses only this letter and authorised imported academic data.</span></div>{assistantOpen[l.id]&&<section className="faculty-ai-panel"><div className="faculty-ai-heading"><div className="ai-avatar"><Bot size={18}/></div><div><b>PSYNS Faculty Assistant</b><small>Ask about attendance, CGPA, backlogs, missing data, or what to verify next.</small></div></div><div className="faculty-ai-messages">{(!assistantChats[l.id]||assistantChats[l.id].length===0)&&<div className="ai-welcome">Hi! I can explain the available academic record and flag missing information. I won't invent data or make the approval decision for you.</div>}{(assistantChats[l.id]||[]).map((m,i)=><div key={i} className={`ai-message ${m.role==='user'?'ai-user':'ai-assistant'}`}><small>{m.role==='user'?'You':'Assistant'}{m.mode==='basic'?' · basic mode':''}</small><p>{m.content}</p></div>)}{assistantBusy[l.id]&&<div className="ai-typing">Reviewing the available record…</div>}</div><form className="faculty-ai-compose" onSubmit={e=>{e.preventDefault();askAssistant(l);}}><input className="text-input" value={assistantQuestions[l.id]||''} onChange={e=>setAssistantQuestions(p=>({...p,[l.id]:e.target.value}))} maxLength={1500} placeholder="e.g. What information is missing before I decide?"/><button className="btn btn-primary" disabled={assistantBusy[l.id]||!(assistantQuestions[l.id]||'').trim()}><Send size={15}/> Ask</button></form><div className="ai-disclaimer">Decision support only. Verify records and apply official college policy before approving or rejecting.</div></section>}</>}{l.remarks&&<div className="notice"><span><b>Faculty remarks:</b> {l.remarks}</span></div>}<div className="letter-actions"><button className="btn btn-light" onClick={()=>download(l)}><Download size={15}/> Download letter</button>{isFaculty&&['Pending review','Viewed','More information requested'].includes(l.status)&&<><input className="text-input letter-remarks" placeholder="Optional remarks" value={remarks[l.id]||''} onChange={e=>setRemarks(p=>({...p,[l.id]:e.target.value}))}/><button className="btn btn-light" onClick={()=>changeStatus(l,'Viewed')}>Mark viewed</button><button className="btn btn-primary" onClick={()=>changeStatus(l,'Approved')}>Approve</button><button className="btn btn-light" onClick={()=>changeStatus(l,'Rejected')}>Reject</button><button className="btn btn-light" onClick={()=>changeStatus(l,'More information requested')}>Request info</button></>}</div></article>)}</div>}
    </section>
  </div>;
}
