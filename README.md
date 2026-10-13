# 🛡️ VeriFace AI — Multi-Layered Identity & Document Trust Engine

> **VeriFace AI** is an enterprise-grade AI-powered identity and document verification engine featuring a 6-layer verification pipeline, anti-spoofing biometrics, and a SHA-256 Merkle hash chain anchored to PostgreSQL.

---

## ⚡ Quick Start (Under 1 Minute)

### 1. Start Python + FastAPI Backend (Optional / Recommended)
```bash
# Double-click start_backend.bat OR run via terminal:
cd backend
python run.py
```
> FastAPI will be live at: **`http://localhost:8000`** (Swagger docs at `/docs`)

### 2. Start React Frontend
```bash
cd veriface-ai
npm run dev
```
> Open your browser at: **`http://localhost:5173/`**

---

## 🔐 Built-in Role-Based Access Control (RBAC) Accounts

| Role | Username | Password | Access Clearance |
| :--- | :--- | :--- | :--- |
| **System Admin** | `admin` | `admin123` | Full unrestricted access (Studio, Registry write, Ledger, Lab, Defense) |
| **Security Officer** | `officer` | `guard123` | Field gate operations (Live camera capture, Verification Studio & Lab) |
| **Compliance Auditor** | `auditor` | `audit123` | Read-only compliance (Blockchain Audit Ledger & Merkle proof inspection) |

> 💡 **Hackathon 1-Click Feature:** Click the **🔑 JWT** badge in the top navigation bar to switch between roles or inspect the active cryptographically signed JWT token in real time!

---

## 📂 Key Documentation & Resources

- 📘 [**Comprehensive Project Report & Technical Architecture**](veriface-ai/PROJECT_REPORT.md)
- 📗 [**Project README & Setup Instructions**](veriface-ai/README.md)
- 🗄️ [**Supabase PostgreSQL Database Schema**](veriface-ai/scripts/schema.sql)
- 📊 [**Sample CSV Dataset for Bulk Import**](veriface-ai/data/sample_dataset.csv)
- 📦 [**Sample JSON Dataset**](veriface-ai/data/sample_dataset.json)
- ⚙️ [**Environment Variables Example**](veriface-ai/.env.example)

---

## 🔬 Architecture Highlights

1. **Layer 1: Capture** — Dual-channel HD capture (webcam or document upload).
2. **Layer 2: Forensics** — ISO/IEC 7810 card aspect ratio, font anomaly, and glare analysis.
3. **Layer 3: OCR / QR / MRZ** — Field and date extraction via Tesseract.js and ZXing.
4. **Layer 4: Database Gate** — Exact PostgreSQL match + Levenshtein fuzzy name check (*Hard Gate 1*).
5. **Layer 5: Live Biometrics** — 68-point landmark Eye Aspect Ratio (EAR) liveness + Euclidean distance cutoff $\le 0.50$ (*Hard Gate 2*).
6. **Layer 6: Decision & Ledger** — Two-Tier Hard Override Engine + SHA-256 Merkle Hash Chain.
