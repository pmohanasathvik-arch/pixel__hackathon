import os, sqlite3, secrets, hashlib, hmac, base64, json, time, uuid, mimetypes, re
from pathlib import Path
from datetime import datetime, timezone
from typing import Optional
from fastapi import FastAPI, Depends, HTTPException, UploadFile, File, Form, Header
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel
import urllib.request, urllib.error

ROOT = Path(__file__).resolve().parent
DB_PATH = Path(os.getenv('PSYNS_DB_PATH', str(ROOT / 'psyns.sqlite3')))
UPLOAD_DIR = Path(os.getenv('PSYNS_UPLOAD_DIR', str(ROOT / 'private_uploads')))
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
SECRET = os.getenv('PSYNS_TOKEN_SECRET', 'CHANGE_THIS_DEMO_SECRET_BEFORE_DEPLOYMENT')
MAX_FILE_BYTES = 10 * 1024 * 1024
ALLOWED_EXTS = {'.pdf', '.docx'}

app = FastAPI(title='PSYNS API', version='1.1.0')
app.add_middleware(CORSMiddleware, allow_origins=['http://localhost:5173','http://127.0.0.1:5173'], allow_credentials=True, allow_methods=['*'], allow_headers=['*'])

def db():
    con = sqlite3.connect(DB_PATH)
    con.row_factory = sqlite3.Row
    return con

def init_db():
    with db() as con:
        con.execute('''CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT UNIQUE NOT NULL, role TEXT NOT NULL, roll_number TEXT, department TEXT, password_hash TEXT NOT NULL, active INTEGER NOT NULL DEFAULT 1)''')
        con.execute('''CREATE TABLE IF NOT EXISTS letters (id TEXT PRIMARY KEY, student_id TEXT NOT NULL, student_name TEXT NOT NULL, recipient_id TEXT NOT NULL, recipient_name TEXT NOT NULL, subject TEXT NOT NULL, purpose TEXT NOT NULL, filename TEXT NOT NULL, stored_name TEXT NOT NULL, content_type TEXT NOT NULL, size INTEGER NOT NULL, status TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, remarks TEXT DEFAULT '')''')
        con.execute('''CREATE TABLE IF NOT EXISTS academic_profiles (roll_number TEXT PRIMARY KEY, name TEXT NOT NULL, department TEXT DEFAULT '', year TEXT DEFAULT '', section TEXT DEFAULT '', classes_conducted INTEGER, classes_attended INTEGER, cgpa REAL, backlogs INTEGER, data_as_of TEXT DEFAULT '', updated_at TEXT NOT NULL, updated_by TEXT NOT NULL)''')
        demo = [
            ('u-student','Demo Student','student@psyns.demo','student','25AI001','AIML','demo123'),
            ('u-proctor','Dr. Faculty Member 1','proctor@psyns.demo','proctor',None,'AIML','demo123'),
            ('u-incharge','Event In-charge','incharge@psyns.demo','incharge',None,'AIML','demo123'),
            ('u-faculty2','Faculty Member 2','faculty2@psyns.demo','proctor',None,'CSE','demo123'),
        ]
        for uid,name,email,role,roll,dept,pw in demo:
            con.execute('INSERT OR IGNORE INTO users(id,name,email,role,roll_number,department,password_hash) VALUES(?,?,?,?,?,?,?)',(uid,name,email,role,roll,dept,hashlib.sha256(pw.encode()).hexdigest()))
init_db()

def b64e(raw: bytes) -> str: return base64.urlsafe_b64encode(raw).decode().rstrip('=')
def make_token(user):
    payload = {'sub':user['id'],'email':user['email'],'exp':int(time.time())+60*60*8}
    body = b64e(json.dumps(payload,separators=(',',':')).encode())
    sig = b64e(hmac.new(SECRET.encode(),body.encode(),hashlib.sha256).digest())
    return body+'.'+sig

def current_user(authorization: Optional[str] = Header(default=None)):
    if not authorization or not authorization.startswith('Bearer '): raise HTTPException(401,'Please sign in again.')
    token=authorization[7:]
    try:
        body,sig=token.split('.',1)
        expected=b64e(hmac.new(SECRET.encode(),body.encode(),hashlib.sha256).digest())
        if not hmac.compare_digest(sig,expected): raise ValueError('signature')
        payload=json.loads(base64.urlsafe_b64decode(body+'='*((4-len(body)%4)%4)))
        if payload['exp'] < time.time(): raise ValueError('expired')
    except Exception: raise HTTPException(401,'Invalid or expired session.')
    with db() as con: row=con.execute('SELECT id,name,email,role,roll_number,department,active FROM users WHERE id=?',(payload['sub'],)).fetchone()
    if not row or not row['active']: raise HTTPException(401,'Account is inactive.')
    return dict(row)

class LoginInput(BaseModel):
    email: str
    password: str

@app.get('/api/health')
def health(): return {'status':'ok'}

@app.post('/api/auth/login')
def login(data: LoginInput):
    with db() as con: row=con.execute('SELECT * FROM users WHERE email=? AND active=1',(data.email.strip().lower(),)).fetchone()
    if not row or not hmac.compare_digest(row['password_hash'],hashlib.sha256(data.password.encode()).hexdigest()):
        raise HTTPException(401,'Invalid email or password. Demo accounts use password demo123.')
    user={k:row[k] for k in ['id','name','email','role','department']}
    user['rollNumber']=row['roll_number']
    return {'access_token':make_token(user),'token_type':'bearer','user':user}

@app.get('/api/faculty')
def faculty_list(user=Depends(current_user)):
    if user['role']!='student': raise HTTPException(403,'Only students can browse the faculty directory.')
    with db() as con: rows=con.execute("SELECT id,name,email,department FROM users WHERE role='proctor' AND active=1 ORDER BY name").fetchall()
    return {'items':[dict(r) for r in rows]}

class AcademicRecord(BaseModel):
    rollNumber: str
    name: str
    department: str = ''
    year: str = ''
    section: str = ''
    classesConducted: Optional[int] = None
    classesAttended: Optional[int] = None
    cgpa: Optional[float] = None
    backlogs: Optional[int] = None
    dataAsOf: str = ''

class AcademicImportInput(BaseModel):
    records: list[AcademicRecord]

@app.post('/api/academic/import')
def import_academic_profiles(data: AcademicImportInput, user=Depends(current_user)):
    if user['role'] != 'incharge':
        raise HTTPException(403, 'Only the authorised event in-charge can import academic profiles.')
    if not data.records or len(data.records) > 10000:
        raise HTTPException(400, 'Import between 1 and 10,000 records at a time.')
    seen = set(); valid = []
    for r in data.records:
        roll = r.rollNumber.strip().upper()
        if not roll or not r.name.strip():
            raise HTTPException(400, 'Every row must include a roll number and student name.')
        if roll in seen:
            raise HTTPException(400, f'Duplicate roll number in upload: {roll}')
        seen.add(roll)
        if r.classesConducted is not None and r.classesConducted < 0: raise HTTPException(400, f'Invalid classes conducted for {roll}.')
        if r.classesAttended is not None and r.classesAttended < 0: raise HTTPException(400, f'Invalid classes attended for {roll}.')
        if r.classesConducted is not None and r.classesAttended is not None and r.classesAttended > r.classesConducted: raise HTTPException(400, f'Classes attended exceed classes conducted for {roll}.')
        if r.cgpa is not None and not 0 <= r.cgpa <= 10: raise HTTPException(400, f'CGPA must be between 0 and 10 for {roll}.')
        if r.backlogs is not None and r.backlogs < 0: raise HTTPException(400, f'Backlogs cannot be negative for {roll}.')
        valid.append((roll,r.name.strip(),r.department.strip(),r.year.strip(),r.section.strip(),r.classesConducted,r.classesAttended,r.cgpa,r.backlogs,r.dataAsOf[:40],datetime.now(timezone.utc).isoformat(),user['id']))
    with db() as con:
        for row in valid:
            con.execute("INSERT INTO academic_profiles(roll_number,name,department,year,section,classes_conducted,classes_attended,cgpa,backlogs,data_as_of,updated_at,updated_by) VALUES(?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(roll_number) DO UPDATE SET name=excluded.name,department=excluded.department,year=excluded.year,section=excluded.section,classes_conducted=excluded.classes_conducted,classes_attended=excluded.classes_attended,cgpa=excluded.cgpa,backlogs=excluded.backlogs,data_as_of=excluded.data_as_of,updated_at=excluded.updated_at,updated_by=excluded.updated_by", row)
    return {'message':'Academic profiles imported securely.','imported':len(valid)}

@app.get('/api/academic/me')
def my_academic_profile(user=Depends(current_user)):
    if user['role'] != 'student': raise HTTPException(403, 'This endpoint is for student accounts.')
    if not user.get('roll_number'): return {'profile': None}
    with db() as con: row=con.execute('SELECT roll_number,name,department,year,section,classes_conducted,classes_attended,cgpa,backlogs,data_as_of,updated_at FROM academic_profiles WHERE roll_number=?',(user['roll_number'].strip().upper(),)).fetchone()
    return {'profile':dict(row) if row else None}

@app.post('/api/letters')
async def submit_letter(subject: str=Form(...), purpose: str=Form(...), recipient_id: str=Form(...), document: UploadFile=File(...), user=Depends(current_user)):
    if user['role']!='student': raise HTTPException(403,'Only student accounts can submit letters.')
    subject=subject.strip(); purpose=purpose.strip()
    if not subject or len(subject)>180: raise HTTPException(400,'Subject is required and must be under 180 characters.')
    if not purpose or len(purpose)>5000: raise HTTPException(400,'Purpose is required and must be under 5000 characters.')
    ext=Path(document.filename or '').suffix.lower()
    if ext not in ALLOWED_EXTS: raise HTTPException(400,'Upload a PDF or DOCX file.')
    if document.content_type not in {'application/pdf','application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/octet-stream'}: raise HTTPException(400,'Unsupported document content type.')
    data=await document.read(MAX_FILE_BYTES+1)
    if not data or len(data)>MAX_FILE_BYTES: raise HTTPException(400,'File is empty or exceeds the 10 MB limit.')
    if ext=='.pdf' and not data.startswith(b'%PDF-'): raise HTTPException(400,'The file does not appear to be a valid PDF.')
    if ext=='.docx' and not data.startswith(b'PK'): raise HTTPException(400,'The file does not appear to be a valid DOCX.')
    with db() as con: recipient=con.execute("SELECT id,name FROM users WHERE id=? AND role='proctor' AND active=1",(recipient_id,)).fetchone()
    if not recipient: raise HTTPException(400,'Select an active registered faculty member.')
    lid='LTR-'+uuid.uuid4().hex[:10].upper(); stored=lid+ext; path=UPLOAD_DIR/stored
    path.write_bytes(data)
    now=datetime.now(timezone.utc).isoformat()
    try:
        with db() as con:
            con.execute('INSERT INTO letters(id,student_id,student_name,recipient_id,recipient_name,subject,purpose,filename,stored_name,content_type,size,status,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)', (lid,user['id'],user['name'],recipient['id'],recipient['name'],subject,purpose,Path(document.filename).name,stored,document.content_type,len(data),'Pending review',now,now))
    except Exception:
        path.unlink(missing_ok=True); raise
    return {'message':'Letter sent to the selected faculty member.','letter':{'id':lid,'subject':subject,'recipient_name':recipient['name'],'status':'Pending review','created_at':now}}

@app.get('/api/letters')
def my_letters(user=Depends(current_user)):
    with db() as con:
        if user['role']=='student': rows=con.execute('SELECT id,student_name,recipient_name,subject,purpose,filename,size,status,created_at,updated_at,remarks FROM letters WHERE student_id=? ORDER BY created_at DESC',(user['id'],)).fetchall()
        elif user['role']=='proctor': rows=con.execute('SELECT id,student_name,recipient_name,subject,purpose,filename,size,status,created_at,updated_at,remarks FROM letters WHERE recipient_id=? ORDER BY created_at DESC',(user['id'],)).fetchall()
        else: rows=con.execute('SELECT id,student_name,recipient_name,subject,purpose,filename,size,status,created_at,updated_at,remarks FROM letters ORDER BY created_at DESC').fetchall()
    items = [dict(r) for r in rows]
    # Academic data is only attached for the addressed faculty/in-charge view.
    if user['role'] in {'proctor', 'incharge'}:
        with db() as profiles_db:
            for item in items:
                profile = profiles_db.execute('''SELECT ap.roll_number,ap.name,ap.department,ap.year,ap.section,ap.classes_conducted,ap.classes_attended,ap.cgpa,ap.backlogs,ap.data_as_of,ap.updated_at FROM academic_profiles ap JOIN users u ON UPPER(TRIM(u.roll_number))=ap.roll_number JOIN letters l ON l.student_id=u.id WHERE l.id=?''',(item['id'],)).fetchone()
                item['academic_profile'] = dict(profile) if profile else None
    return {'items':items}

class StatusInput(BaseModel):
    status: str
    remarks: str = ''

@app.patch('/api/letters/{letter_id}/status')
def update_letter_status(letter_id: str, data: StatusInput, user=Depends(current_user)):
    if user['role']!='proctor': raise HTTPException(403,'Only the addressed faculty member can update this letter.')
    if data.status not in {'Viewed','Approved','Rejected','More information requested'}: raise HTTPException(400,'Invalid status.')
    with db() as con:
        row=con.execute('SELECT id FROM letters WHERE id=? AND recipient_id=?',(letter_id,user['id'])).fetchone()
        if not row: raise HTTPException(404,'Letter not found in your inbox.')
        con.execute('UPDATE letters SET status=?,remarks=?,updated_at=? WHERE id=?',(data.status,data.remarks[:2000],datetime.now(timezone.utc).isoformat(),letter_id))
    return {'message':'Letter status updated.','status':data.status}


class LetterAssistantInput(BaseModel):
    question: str
    history: list[dict] = []

@app.post('/api/letters/{letter_id}/assistant')
def letter_assistant(letter_id: str, data: LetterAssistantInput, user=Depends(current_user)):
    # Only the faculty member addressed by this letter may ask about its student profile.
    if user['role'] != 'proctor':
        raise HTTPException(403, 'The academic review assistant is available to the addressed faculty member only.')
    question = data.question.strip()
    if not question or len(question) > 1500:
        raise HTTPException(400, 'Enter a question up to 1,500 characters.')
    with db() as con:
        letter = con.execute('SELECT id,student_id,student_name,subject,purpose,status,recipient_id FROM letters WHERE id=? AND recipient_id=?', (letter_id,user['id'])).fetchone()
        if not letter:
            raise HTTPException(404, 'Letter not found in your authorised inbox.')
        student = con.execute('SELECT roll_number,department FROM users WHERE id=?', (letter['student_id'],)).fetchone()
        profile = None
        if student and student['roll_number']:
            profile = con.execute('SELECT roll_number,name,department,year,section,classes_conducted,classes_attended,cgpa,backlogs,data_as_of,updated_at FROM academic_profiles WHERE roll_number=?', (student['roll_number'].strip().upper(),)).fetchone()
    profile = dict(profile) if profile else None
    attendance = None
    if profile and profile.get('classes_conducted') and profile.get('classes_attended') is not None:
        attendance = round(profile['classes_attended'] / profile['classes_conducted'] * 100, 2)
    context = {
        'letter': {'subject': letter['subject'], 'purpose': letter['purpose'], 'status': letter['status']},
        'student': {'name': letter['student_name'], 'roll_number': (student['roll_number'] if student else None), 'department': (student['department'] if student else None)},
        'academic_profile': profile, 'calculated_attendance_percent': attendance
    }
    api_key = os.getenv('OPENAI_API_KEY', '').strip()
    if api_key:
        try:
            import httpx
            messages = [{'role':'system','content': 'You are PSYNS Faculty Academic Review Assistant. Help faculty understand the student profile and letter. Use only facts in the supplied JSON context; clearly say when data is missing or stale. Never invent attendance, CGPA, backlogs, or policy. Explain evidence and uncertainty. Do not make the approval decision; the faculty decides. Do not infer character, health, caste, religion, or other sensitive traits. Be concise, interactive, and answer the faculty question. Context JSON: ' + json.dumps(context, ensure_ascii=False)}]
            for item in data.history[-8:]:
                role = item.get('role')
                content = str(item.get('content',''))[:1500]
                if role in {'user','assistant'} and content:
                    messages.append({'role':role,'content':content})
            messages.append({'role':'user','content':question})
            with httpx.Client(timeout=25.0) as client:
                resp = client.post('https://api.openai.com/v1/chat/completions', headers={'Authorization':f'Bearer {api_key}','Content-Type':'application/json'}, json={'model':os.getenv('OPENAI_MODEL','gpt-4o-mini'),'messages':messages,'temperature':0.2})
                resp.raise_for_status()
                answer = resp.json()['choices'][0]['message']['content'].strip()
            return {'answer':answer,'mode':'ai','profile_available':bool(profile)}
        except Exception:
            # Do not leak provider errors or credentials to the client.
            raise HTTPException(502, 'The AI assistant could not connect. Check the server AI configuration and try again.')
    # Local, no-key fallback is transparent and never pretends to be GPT.
    if not profile:
        answer = 'I cannot find an imported academic record for this student. Ask the event in-charge to import the correct registered roll number. Until then, attendance, CGPA, and backlog details are unverified, so do not assume they are zero.'
    else:
        parts = [f"Student: {profile.get('name') or letter['student_name']} (roll number {profile.get('roll_number') or 'not available'})."]
        parts.append(f"Attendance: {attendance}% ({profile.get('classes_attended')} of {profile.get('classes_conducted')} classes)." if attendance is not None else 'Attendance: not available in the imported record.')
        parts.append(f"CGPA: {profile['cgpa']} / 10." if profile.get('cgpa') is not None else 'CGPA: not available in the imported record.')
        parts.append(f"Backlogs: {profile['backlogs']}." if profile.get('backlogs') is not None else 'Backlogs: not available in the imported record.')
        parts.append(f"Data date: {profile.get('data_as_of') or 'not specified'}. Verify freshness with the event in-charge if needed.")
        parts.append('I am running in basic mode because OPENAI_API_KEY is not configured; configure it on the backend for GPT-style conversation. I can only summarise imported facts, not decide whether to approve the letter.')
        answer = ' '.join(parts)
    return {'answer':answer,'mode':'basic','profile_available':bool(profile)}

@app.get('/api/letters/{letter_id}/document')
def get_letter_document(letter_id: str, user=Depends(current_user)):
    with db() as con: row=con.execute('SELECT * FROM letters WHERE id=?',(letter_id,)).fetchone()
    if not row: raise HTTPException(404,'Document not found.')
    if user['id'] not in {row['student_id'],row['recipient_id']} and user['role']!='incharge': raise HTTPException(403,'You are not allowed to view this document.')
    path=UPLOAD_DIR/row['stored_name']
    if not path.exists(): raise HTTPException(404,'Stored document is missing.')
    return FileResponse(path,media_type=row['content_type'],filename=row['filename'],content_disposition_type='attachment')
