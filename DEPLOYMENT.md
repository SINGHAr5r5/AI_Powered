# สรุปขั้นตอนทั้งหมด: Market Research Framework™ (AI Powered)

เอกสารนี้สรุปตั้งแต่ปัญหาต้นทาง ไปจนถึงตอนที่เว็บใช้งานได้จริง เผื่อไว้ทบทวนหรือทำซ้ำในโปรเจกต์อื่น

---

## 1. จุดเริ่มต้น: โค้ดที่ให้มารันไม่ได้

โค้ด HTML/JS ต้นฉบับมีปัญหา 3 อย่าง:

1. **Syntax error** — เขียน template literal โดยไม่ใส่ backtick (`` ` ``) ครอบ เช่น
   `const url = https://.../${apiKey};` ทำให้ JavaScript พังทั้งไฟล์ ปุ่มกดไม่ทำงานเลย
2. **ฟังก์ชันหาย** — ปุ่ม `onclick="startAiAnalysis()"` เรียกฟังก์ชันที่ไม่มีอยู่จริงในโค้ด
3. **ไม่มี render logic** — ไม่มีโค้ดส่วนที่แปลงผลลัพธ์จาก AI ให้ออกมาเป็น HTML บนหน้าเว็บ

**แก้ไข:** เขียน `index.html` ใหม่ทั้งไฟล์ ใส่ backtick ให้ถูก เติม `startAiAnalysis()`,
`renderReport()`, `fetchAiAnalysis()` ให้ครบ พร้อม error handling

---

## 2. Deploy ขึ้น GitHub Pages ครั้งแรก

```bash
cd AI_Powered
git init
git add index.html
git commit -m "..."
git branch -M main
gh repo create AI_Powered --public --source=. --remote=origin --push
gh api repos/SINGHAr5r5/AI_Powered/pages -X POST -f "source[branch]=main" -f "source[path]=/"
```

ผลลัพธ์: เว็บขึ้นที่ `https://singhar5r5.github.io/AI_Powered/`
แต่ตอนนั้นยังต้องให้ผู้ใช้กรอก Gemini API key เองในหน้าเว็บ (ช่อง password input)

---

## 3. ปัญหาความปลอดภัย: ห้ามฝัง API key ลงโค้ด

ผู้ใช้ขอให้ฝัง API key ลงในโค้ดโดยตรง — **ปฏิเสธ** เพราะ:

- โค้ดฝั่ง client (JavaScript ที่รันในเบราว์เซอร์) ใครก็ตามที่เข้าเว็บกด "View Source" ก็เห็น key ได้ทันที
- ไม่เกี่ยวว่า repo จะ public หรือ private เพราะตัวเว็บที่ deploy ออกไปต้อง public ถึงจะเปิดดูได้
- บอทสแกน GitHub หา API key รูปแบบนี้ตลอดเวลา จะโดนขโมยไปใช้ฟรีในไม่กี่ชั่วโมง

**ทางแก้ที่เลือก:** สร้าง **Cloudflare Worker** เป็นตัวกลาง (backend proxy)
- หน้าเว็บส่งแค่ "ชื่อสินค้า" ไปที่ Worker
- Worker เป็นคนแนบ Gemini API key (เก็บเป็น **secret** ฝั่งเซิร์ฟเวอร์) แล้วค่อยยิงต่อไป Gemini
- Browser ผู้ใช้ไม่มีวันเห็น key เลย

โครงสร้างไฟล์ที่เพิ่ม:
```
worker/
  ├─ index.js       # โค้ด Worker (proxy + prompt template)
  └─ wrangler.toml   # config สำหรับ deploy ด้วย wrangler
```

และแก้ `index.html`:
- ลบช่องกรอก API key ออก
- เปลี่ยนให้ยิง request ไปที่ `WORKER_URL` แทนการยิง Gemini ตรง ๆ

---

## 4. Deploy Worker ขึ้น Cloudflare

### 4.1 ติดตั้งเครื่องมือช่วย (ครั้งเดียว)
```bash
claude plugin marketplace add cloudflare/skills
claude plugin install cloudflare@cloudflare
/reload-plugins
```

### 4.2 ล็อกอิน Cloudflare ผ่าน wrangler
```bash
cd worker
npx wrangler login     # เปิดเบราว์เซอร์ให้กด Allow
```

### 4.3 ปัญหาที่เจอระหว่างทาง: บัญชียังไม่มี workers.dev subdomain
บัญชี Cloudflare ใหม่ต้องเข้าเมนู **Compute → Workers** ในหน้าเว็บ dashboard
**ครั้งแรก** ก่อน ระบบถึงจะสร้าง subdomain (เช่น `singhar5r5.workers.dev`) ให้อัตโนมัติ
— ขั้นตอนนี้ทำผ่าน API ไม่ได้ ต้องเปิดหน้าเว็บเอง

### 4.4 Deploy
```bash
npx wrangler deploy
```
ได้ URL: `https://ai-powered-market-research-proxy.singhar5r5.workers.dev`

### 4.5 อัปเดตหน้าเว็บให้ชี้ไปที่ Worker URL แล้ว push
แก้ค่า `WORKER_URL` ใน `index.html` ให้ตรงกับ URL จริง แล้ว commit + push ขึ้น GitHub

---

## 5. ตั้งค่า API Key เป็น Secret (ทำผ่าน Dashboard เท่านั้น)

**เหตุผลที่ไม่ทำผ่านแชท/ผ่าน Claude:** เพื่อไม่ให้ key ตัวจริงหลุดเข้าไปอยู่ในบทสนทนา/log ใด ๆ

ขั้นตอน:
1. สร้าง Gemini API key ใหม่ที่ https://aistudio.google.com/apikey
2. เข้า Cloudflare Dashboard → เลือก Worker (`ai-powered-market-research-proxy`) → **Settings**
3. ไปที่ **Variables and secrets** → กด **Add variable**
4. Name: `GEMINI_API_KEY`
5. **Type: ต้องเลือก "Secret"** (ไม่ใช่ "Text" — Text จะเก็บเป็นข้อความธรรมดา มองเห็นได้)
6. Value: วาง API key
7. กด **Save and deploy**

> ⚠️ ระวัง: ช่อง "Import variables" (ปุ่ม Import .env) ต้องพิมพ์ในรูปแบบ
> `GEMINI_API_KEY=ค่าคีย์` (มี `ชื่อตัวแปร=` นำหน้า) ถ้าวางแค่ค่า key เฉย ๆ จะขึ้น
> "No valid variables found" — ใช้ปุ่ม "Add variable" กรอกทีละช่องจะง่ายกว่า

---

## 6. Debug ที่เจอระหว่างทดสอบจริง

| อาการ | สาเหตุ | วิธีแก้ |
|---|---|---|
| `Load failed` ตอนกดวิเคราะห์ | `WORKER_URL` ในโค้ดยังเป็นค่า placeholder ไม่มีจริง | ใส่ URL จริงหลัง deploy Worker |
| หน้า Cloudflare ขึ้น `404` ตอนเปิดลิงก์ subdomain | ยังไม่เคยเปิดเมนู Workers ในบัญชีเลยสักครั้ง | เปิด Compute → Workers ให้ระบบสร้าง subdomain |
| Deploy ผ่าน MCP tool ขึ้น `Authentication error` | OAuth ที่เชื่อมผ่าน MCP มีสิทธิ์แค่ "อ่าน" ไม่ใช่ "เขียน" | เปลี่ยนไปใช้ `wrangler login` + `wrangler deploy` แทน (ได้สิทธิ์ `workers_scripts:write`) |
| หน้าเว็บขึ้น "เกิดข้อผิดพลาด 400 - [object Object]" | (1) โค้ดแสดง error ผิด object ซ้อน object ไม่ได้ unwrap message ออกมา (2) Gemini ตอบ "API key not valid" เพราะยังไม่ได้ตั้ง secret | แก้โค้ด parse error ให้ดึง `.error.message` ออกมาก่อน และไปตั้งค่า `GEMINI_API_KEY` ให้ครบตามข้อ 5 |
| Import .env ขึ้น "No valid variables found" | วางแค่ค่า key เฉย ๆ ไม่ได้ใส่ `GEMINI_API_KEY=` นำหน้า | ใช้ปุ่ม "Add variable" กรอกทีละช่องแทน |

---

## 7. โครงสร้างระบบตอนนี้ (สรุปภาพรวม)

```
ผู้ใช้เปิดเว็บ
   https://singhar5r5.github.io/AI_Powered/   (GitHub Pages, static HTML)
        │  กรอกชื่อสินค้า → fetch POST { productName }
        ▼
   https://ai-powered-market-research-proxy.singhar5r5.workers.dev  (Cloudflare Worker)
        │  แนบ GEMINI_API_KEY (secret, ไม่เปิดเผย) → สร้าง prompt → เรียก Gemini
        ▼
   Gemini 2.5 Flash API (generativelanguage.googleapis.com)
        │  ส่ง JSON วิเคราะห์ตลาดกลับมา
        ▼
   Worker ส่งต่อผลลัพธ์กลับไปหน้าเว็บ → render เป็น Framework 7 หมวด
```

**จุดสำคัญ:** API key อยู่แค่ในตัวแปร secret ของ Cloudflare Worker เท่านั้น
ไม่เคยถูกส่งไปที่ browser ผู้ใช้ และไม่เคยอยู่ในไฟล์ที่ push ขึ้น GitHub เลย

---

## 8. ถ้าจะแก้ไข/อัปเดตต่อในอนาคต

- **แก้หน้าตาเว็บ/ข้อความ:** แก้ `index.html` แล้ว `git add`, `git commit`, `git push` — GitHub Pages จะ build ให้อัตโนมัติ (ใช้เวลาประมาณ 30 วิ - 1 นาที)
- **แก้ prompt ที่ส่งให้ AI หรือ logic ฝั่งเซิร์ฟเวอร์:** แก้ `worker/index.js` แล้วรัน `cd worker && npx wrangler deploy`
- **เปลี่ยน/หมุน API key:** ไปที่ Cloudflare Dashboard → Worker → Settings → Variables and secrets → แก้ค่า `GEMINI_API_KEY` แล้ว Save and deploy (ไม่ต้องแก้โค้ดฝั่งไหนเลย)
- **เพิ่มโดเมนอื่นให้เรียก Worker ได้:** แก้ `ALLOWED_ORIGINS` ใน `worker/index.js` แล้ว deploy ใหม่
