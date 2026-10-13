# 🛡️ VeriFace AI — Multi-Layered Identity & Document Trust Engine

[![React 19](https://img.shields.io/badge/React-19.2-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-8.3-646CFF?logo=vite&logoColor=white)](https://vite.dev/)
[![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL-3ECF8E?logo=supabase&logoColor=white)](https://supabase.com/)
[![face--api.js](https://img.shields.io/badge/Biometrics-face--api.js-orange)](https://github.com/justadudewhohacks/face-api.js)
[![Tesseract.js](https://img.shields.io/badge/OCR-Tesseract.js-555555)](https://tesseract.projectnaptha.com/)
[![TailwindCSS](https://img.shields.io/badge/Tailwind-3.4-38B2AC?logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)
[![License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

> **VeriFace AI** is an enterprise-grade biometric, optical, and cryptographic identity trust engine. It unites client-side edge neural networks (face recognition, liveness detection, and OCR) with a **Two-Tier Hard Override Decision Engine** and a **SHA-256 Merkle Hash Chain** anchored to a PostgreSQL backend.

---

## 📑 Table of Contents

- [Key Features](#-key-features)
- [The 6-Layer Verification Pipeline](#-the-6-layer-verification-pipeline)
- [Four Operational Modes](#-four-operational-modes)
- [System Architecture](#-system-architecture)
- [Quick Start Guide](#-quick-start-guide)
  - [Prerequisites](#1-prerequisites)
  - [Installation](#2-installation)
  - [Environment Configuration](#3-environment-configuration)
  - [Database Setup & Seeding](#4-database-setup--seeding)
  - [Face AI Models](#5-face-ai-models)
  - [Running Locally](#6-running-locally)
- [Judge / Evaluator Quick-Test Guide](#-judge--evaluator-quick-test-guide)
- [Project Structure](#-project-structure)
- [Cryptographic Audit Ledger & Tamper Demo](#-cryptographic-audit-ledger--tamper-demo)
- [Full Documentation](#-full-documentation)

---

## ⚡ Key Features

1. **Edge Neural Biometrics (<30ms Inference):** Runs TinyFaceDetector and 68-point facial landmark analysis directly in the browser using WebGL—no facial vectors or images leave the user's device.
2. **Anti-Spoofing Liveness (EAR):** Computes Eye Aspect Ratio (EAR) across facial landmarks to detect micro-blinks and prevent photo-on-screen or printed spoofing attacks.
3. **Multi-Format Document OCR & Barcodes:** Extracts text, dates, roll numbers, and names via Tesseract.js; decodes QR codes, PDF417, and barcodes via ZXing.
4. **Two-Tier Hard Override Decision Engine:** Completely prevents catastrophic security bypasses. Missing database records or biometric mismatches immediately render a **"FAKE"** verdict regardless of high OCR or forensic scores.
5. **Zero-PII Cryptographic Audit Ledger:** Maintains a local SHA-256 hash chain and Merkle root. No raw documents or face images are stored in logs, fulfilling GDPR and Indian DPDP Act compliance.
6. **Interactive System Defense & Forensics Lab:** Explore every layer of the architecture, inspect threat model matrices, and simulate block tampering live.

---

## 🔬 The 6-Layer Verification Pipeline

```
┌────────────────────────────────────────────────────────────────────────┐
│  Layer 1: Capture          Dual-channel camera / HD card upload        │
├────────────────────────────────────────────────────────────────────────┤
│  Layer 2: Forensics        ISO aspect ratio, font anomalies, glare     │
├────────────────────────────────────────────────────────────────────────┤
│  Layer 3: OCR / QR / MRZ   Tesseract.js field parser + ZXing barcodes  │
├────────────────────────────────────────────────────────────────────────┤
│  Layer 4: Database Gate    Supabase PostgreSQL check + Levenshtein     │
│                            [HARD OVERRIDE: ID not found -> FAKE]       │
├────────────────────────────────────────────────────────────────────────┤
│  Layer 5: Live Face Match  68-Landmark EAR liveness + 128-D vector     │
│                            [HARD OVERRIDE: Distance > 0.50 -> FAKE]    │
├────────────────────────────────────────────────────────────────────────┤
│  Layer 6: Decision Engine  Two-Tier Score + SHA-256 Merkle Hash Chain  │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 🎯 Four Operational Modes

Switch modes dynamically via the top-bar selector to adjust pipeline weights and tolerance:

| Mode                        | Target Latency     | Face Threshold      | Primary Use Case                                                                                               |
| :-------------------------- | :----------------- | :------------------ | :------------------------------------------------------------------------------------------------------------- |
| **🎓 Campus Security**      | ~1.5s              | Strict ($\le 0.50$) | College gates, exam identity checks, hostel entry                                                              |
| **🚗 High-Speed Toll Gate** | <800ms             | Fast ($\le 0.58$)   | Toll plaza driver matching, logistics fleets                                                                   |
| **🛂 Standard Checkpoint**  | ~2.5s              | Strict ($\le 0.50$) | Border control, airport e-Gates, citizen verification                                                          |
| **🧠 AI Document Check**    | Detector-dependent | Score threshold     | Labels a document image AI-generated or human-captured; does not query Supabase or write the local audit chain |

---

## 🚀 Quick Start Guide

### 1. Prerequisites

- **Node.js**: v18.0.0 or higher
- **npm**: v9.0.0 or higher
- A modern web browser with WebGL & Webcam support (Chrome, Edge, Firefox, Brave)

### 2. Installation

Clone the repository and install dependencies:

```bash
git clone https://github.com/your-org/veriface-ai.git
cd veriface-ai
npm install
```

### 3. Environment Configuration

Copy the `.env.example` file to create `.env`:

```bash
cp .env.example .env
```

Inside `.env`, populate your Supabase credentials:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-public-key
VITE_API_URL=http://127.0.0.1:8001
VITE_DOCUMENT_AI_API_URL=http://127.0.0.1:8002/api/v1/detect
```

_(A pre-configured live Supabase demo instance is already included in the repository `.env` for zero-friction evaluation.)_

This setup uses separate ports: the existing AI Image Detector on `8000`, VeriFace Core on `8001`, and the dedicated document-detection API on `8002`.

Start VeriFace Core in one terminal:

```powershell
cd "C:\Users\Dell\OneDrive\Desktop\VERIFACE AI\backend"
python -m uvicorn main:app --host 127.0.0.1 --port 8001
```

Start the document-detection API in another terminal:

```powershell
cd "C:\Users\Dell\OneDrive\Desktop\AI Image Detector"
.venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8002
```

`VITE_API_URL` points to VeriFace Core on `8001`; `VITE_DOCUMENT_AI_API_URL` points to the separate detector on `8002`. The AI Document Check branch does not invoke the Supabase registry, face matcher, verification decision endpoint, or local audit hash-chain reads/writes. The uploaded image is sent to the detector service, which may forward it to its configured Sightengine/Hive provider if its local model is unavailable. Do not use sensitive documents unless you have authorization and accept that processing path.

If the detector runs on another host or port, set `VITE_DOCUMENT_AI_API_URL` in `.env` to its `/api/v1/detect` URL and restart Vite. Its API must allow browser CORS requests from the VeriFace origin.

### 4. Database Setup & Seeding

If setting up a fresh Supabase database:

1. Open your Supabase Dashboard $\to$ **SQL Editor**.
2. Run the SQL script located at [`scripts/schema.sql`](scripts/schema.sql) to create `people` and `verification_logs` tables with RLS policies.
3. Run the automated seed script to populate ~25 realistic demo records:

```bash
node scripts/seed.js
```

### 5. Face AI Models

The pre-trained weights for `face-api.js` are included under `public/models/`.  
If you ever need to re-download them:

- **Cross-Platform (Node.js):**
  ```bash
  node scripts/download-models.js
  ```
- **Windows (PowerShell):**
  ```powershell
  .\scripts\download-models.ps1
  ```

### 6. Running Locally

Start the Vite development server:

```bash
npm run dev
```

Open your browser at: **`http://localhost:5173/`**

---

## 🧪 Judge / Evaluator Quick-Test Guide

For immediate demonstration without needing a physical ID card or webcam, VeriFace AI includes **1-Click Interactive Demo Scenarios** in the Verification Studio:

| Preset Scenario           | Scenario Description                                             | Expected Outcome           | Hard Gate Triggered                   |
| :------------------------ | :--------------------------------------------------------------- | :------------------------- | :------------------------------------ |
| **🎓 Harshit Kanwal**     | Registered CGC Landran Campus ID + matching live face descriptor | **AUTHENTIC (Score ~95)**  | All Gates Pass                        |
| **🟢 1. Clean Match**     | Registered IIT-D Campus ID + matching live face descriptor       | **AUTHENTIC (Score ~95)**  | All Gates Pass                        |
| **🟡 2. DOB Mismatch**    | Valid Aadhaar with transposed date of birth                      | **SUSPICIOUS (Score ~70)** | Continuous score penalty              |
| **🔴 3. Face Mismatch**   | Valid registered card presented by a non-matching face           | **FAKE (Score ~20)**       | **Gate 2 Override (Distance > 0.50)** |
| **🔴 4. Unregistered ID** | High-quality card with unregistered ID number                    | **FAKE (Score ~15)**       | **Gate 1 Override (ID Not Found)**    |

### Testing with Real Webcam & ID:

1. Switch to **Capture Card** in the studio and hold any student ID or government card up to the camera (or upload an image).
2. Take a **Live Selfie** using the webcam.
3. Click **"Run Full 6-Layer Pipeline"** to watch the real-time stage progression.

---

## ⛓️ Cryptographic Audit Ledger & Tamper Demo

Navigate to the **Blockchain Ledger** tab (`⛓️`) in the header to view the live hash chain:

1. Every verification appends a new block containing:
   - Index, Timestamp, Trust Score, Verdict, and ID Number
   - Previous Block SHA-256 Hash
   - Current Block SHA-256 Hash
2. **Simulate Database Tamper:**
   - Click **"Tamper Block (Simulate Attack)"**.
   - Select any block and modify its Trust Score or Decision (e.g. change a "FAKE" to "AUTHENTIC").
   - Click **"Re-Verify Integrity"**.
   - The system mathematically detects the break: the altered block and all downstream blocks turn **RED**, highlighting cryptographic non-repudiation.

---

## 📂 Project Structure

```
veriface-ai/
├── data/
│   ├── sample_dataset.csv        # Pre-built dataset for bulk import
│   └── sample_dataset.json       # JSON dataset for API / registry tests
├── public/
│   ├── models/                   # Pre-trained face-api.js neural weights
│   │   ├── tiny_face_detector_model-*
│   │   ├── face_landmark_68_model-*
│   │   └── face_recognition_model-*
│   └── favicon.svg
├── scripts/
│   ├── download-models.js        # Cross-platform model weights downloader
│   ├── download-models.ps1       # PowerShell model weights downloader
│   ├── schema.sql                # Complete Supabase PostgreSQL schema & RLS
│   ├── seed.js                   # 25-record synthetic database seeder
│   └── add-person.js             # CLI utility to register a person
├── src/
│   ├── components/
│   │   ├── AuditLedger.jsx       # Blockchain hash-chain & tamper lab
│   │   ├── Capture.jsx           # Dual webcam/upload capture UI
│   │   ├── DefenseGuide.jsx      # Threat matrix & architectural defenses
│   │   ├── MasterRegistry.jsx    # Supabase person manager + CSV/Excel import
│   │   ├── ModeSelector.jsx      # Campus / Toll / Standard mode picker
│   │   ├── PipelineLab.jsx       # Interactive 6-layer forensic lab
│   │   ├── PipelineView.jsx      # Real-time animated verification visualizer
│   │   └── ResultScreen.jsx      # Trust score breakdown & verdict badge
│   ├── config/
│   │   └── modes.js              # Operational profile weight configurations
│   ├── lib/
│   │   ├── dbCheck.js            # Layer 4: Supabase lookup + Levenshtein
│   │   ├── decisionEngine.js     # Layer 6: Two-Tier Hard Override logic
│   │   ├── demoData.js           # 1-Click synthetic card & face generator
│   │   ├── faceMatch.js          # Layer 5: TinyFace + EAR Liveness + Euclidean
│   │   ├── forensics.js          # Layer 2: Tamper heuristics, glare, font check
│   │   ├── hashChain.js          # Layer 6b: Local SHA-256 hash chain
│   │   ├── merkle.js             # Layer 6b: Merkle tree calculation & proofs
│   │   ├── ocr.js                # Layer 3: Tesseract.js OCR & regex parsing
│   │   └── supabase.js           # Supabase client singleton
│   ├── App.jsx                   # Main orchestrator & navigation
│   └── main.jsx
├── .env.example                  # Environment variable template
├── PROJECT_REPORT.md             # In-depth technical report & architecture doc
├── package.json
└── README.md
```

---

## 📖 Full Documentation

For the comprehensive technical paper, mathematical formulations, threat modeling, and compliance analysis, refer to:
👉 [**PROJECT_REPORT.md**](PROJECT_REPORT.md)

---

## ⚖️ License

Released under the [MIT License](LICENSE). Built for academic, research, and enterprise biometric evaluation.
