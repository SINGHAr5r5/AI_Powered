# Market Research Framework™ — AI Powered

คู่มือสำหรับ AI ที่เข้ามาช่วยแก้ไข/พัฒนาโปรเจกต์นี้ต่อ อ่านไฟล์นี้ก่อนเริ่มแก้โค้ดทุกครั้ง

## โปรเจกต์นี้คืออะไร

เว็บวิเคราะห์ตลาดสินค้าด้วย AI (Gemini) ตามโครงสร้าง "Market Research Framework™" 7 หมวด
ผู้ใช้พิมพ์ชื่อสินค้า → ระบบส่งไปวิเคราะห์ → แสดงผลเป็นรายงานบนหน้าเว็บ

**Live site:** https://singhar5r5.github.io/AI_Powered/
**Worker (backend proxy):** https://ai-powered-market-research-proxy.singhar5r5.workers.dev

## สถาปัตยกรรม

```
Browser ผู้ใช้
   │  กรอกชื่อสินค้า → POST { productName }
   ▼
index.html (GitHub Pages, static site, ไม่มี build step)
   │  fetch(WORKER_URL, { method: POST, body: { productName } })
   ▼
worker/index.js (Cloudflare Worker — backend proxy)
   │  ต่อ prompt → แนบ GEMINI_API_KEY (secret) → เรียก Gemini
   ▼
Gemini 2.5 Flash API
   │  ส่ง JSON กลับ
   ▼
Worker ส่งต่อกลับไป index.html → renderReport() วาดผลลัพธ์
```

## โครงสร้างไฟล์

| ไฟล์ | หน้าที่ | แก้แล้วต้องทำอะไรต่อ |
|---|---|---|
| `index.html` | หน้าเว็บทั้งหมด (HTML+CSS+JS ในไฟล์เดียว, ไม่มี framework/build) | `git add`, `commit`, `push` → GitHub Pages build ให้เองใน ~1 นาที |
| `worker/index.js` | Cloudflare Worker: รับ productName, สร้าง prompt, เรียก Gemini, คืนผล, จัดการ CORS | `cd worker && npx wrangler deploy` |
| `worker/wrangler.toml` | config ของ Worker (ชื่อ script, compatibility date) | เหมือนกัน ต้อง `wrangler deploy` ใหม่ |
| `DEPLOYMENT.md` | บันทึกขั้นตอน setup ทั้งหมดตั้งแต่ต้น (สำหรับอ่านย้อนหลัง ไม่ต้องแก้) | — |

## กฎที่ห้ามฝ่าฝืนเด็ดขาด

1. **ห้ามฝัง Gemini API key ลงในโค้ดทุกกรณี** ทั้งใน `index.html` และ `worker/index.js`
   Key ต้องอยู่ใน Cloudflare Worker secret (`env.GEMINI_API_KEY`) เท่านั้น
   เหตุผล: `index.html` เป็นโค้ดฝั่ง client ที่ทุกคนเปิด View Source ดูได้ ถ้าฝัง key ลงไปจะถูกบอทขโมยไปใช้ฟรีภายในไม่กี่ชั่วโมง
2. **ห้ามขอให้ผู้ใช้พิมพ์ API key ลงในแชท/เทอร์มินัลที่ AI เห็นได้** ถ้าต้องตั้ง/เปลี่ยน key ให้บอกผู้ใช้ไปตั้งเองผ่าน Cloudflare Dashboard → Worker → Settings → Variables and secrets → Type ต้องเป็น **Secret** (ไม่ใช่ Text)
3. **`ALLOWED_ORIGINS` ใน `worker/index.js`** ต้องมี origin ของเว็บที่อนุญาตให้เรียก Worker ได้เท่านั้น ถ้าเพิ่มโดเมนใหม่ (เช่น custom domain) ต้องเพิ่มใน list นี้ด้วย ไม่งั้นเว็บนั้นจะเรียก Worker ไม่ได้ (CORS block)
4. **ห้าม commit ไฟล์ที่มี key จริงอยู่ในนั้น** เช็ค `git status`/`git diff` ก่อน commit เสมอถ้าแตะไฟล์ config

## วิธี Deploy หลังแก้โค้ด

**แก้หน้าเว็บ (`index.html`):**
```bash
git add index.html
git commit -m "..."
git push origin main
```

**แก้ backend (`worker/index.js`):**
```bash
cd worker
npx wrangler deploy
```
(ต้องเคย `npx wrangler login` ในเครื่องนี้มาก่อนแล้ว — ถ้ายัง ให้รันคำสั่งนี้ก่อน จะเปิดเบราว์เซอร์ให้ล็อกอิน)

## Environment / โครงสร้างข้อมูลที่ AI ต้องคืนกลับ

`worker/index.js` บังคับให้ Gemini ตอบเป็น JSON ตาม schema นี้เสมอ (ดูตัวแปร `FRAMEWORK_SCHEMA_HINT`
ในไฟล์นั้น) — ถ้าจะแก้โครงสร้างผลลัพธ์ ต้องแก้ทั้ง schema ใน Worker และ `FRAMEWORK_SECTIONS` /
`renderReport()` ใน `index.html` ให้ตรงกัน ไม่งั้นหน้าเว็บจะ render ไม่ครบ:

```
currentPhase, nextPhase, opportunity, risk, strategy,
framework: { opportunity, learning, trading, insight, rare, networking, platform } (แต่ละอันเป็น array 3 ข้อ),
moneyFlow (array)
```

## เวลาแก้ปัญหาไม่ได้

- **เว็บขึ้น "Load failed"** → เช็คว่า `WORKER_URL` ใน `index.html` ตรงกับ URL ของ Worker ที่ deploy จริงหรือไม่
- **เว็บขึ้น error 400/403 จาก Worker** → เช็ค `GEMINI_API_KEY` secret ใน Cloudflare Dashboard ว่าตั้งไว้ถูกต้องหรือยัง (ทดสอบตรงได้ด้วย `curl -X POST <WORKER_URL> -H "Origin: https://singhar5r5.github.io" -H "Content-Type: application/json" -d '{"productName":"test"}'`)
- **CORS error ใน console** → เพิ่ม origin ที่เรียกเข้ามาลงใน `ALLOWED_ORIGINS` ของ `worker/index.js` แล้ว deploy ใหม่
